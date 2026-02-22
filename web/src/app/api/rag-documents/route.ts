import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { ragDocuments, ragChunks, ragConfigs, agents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { parseDocument } from "@/lib/rag/parse-document";
import { chunkText } from "@/lib/rag/chunk-text";
import { generateEmbedding } from "@/lib/ai/embedding";

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select()
    .from(ragDocuments)
    .where(eq(ragDocuments.agentId, agentId))
    .orderBy(desc(ragDocuments.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const agentId = formData.get("agentId") as string | null;

  if (!file || !agentId) {
    return NextResponse.json(
      { error: "file and agentId are required" },
      { status: 400 }
    );
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Allowed: PDF, TXT, DOCX` },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds 10MB limit" },
      { status: 400 }
    );
  }

  // Get agent's orgId
  const [agentRow] = await db
    .select({ orgId: agents.orgId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);
  const orgId = agentRow?.orgId ?? null;

  // Get or create RAG config
  let [config] = await db
    .select()
    .from(ragConfigs)
    .where(eq(ragConfigs.agentId, agentId))
    .limit(1);

  if (!config) {
    [config] = await db
      .insert(ragConfigs)
      .values({ agentId })
      .returning();
  }

  // Upload to Vercel Blob
  const blob = await put(`rag/${agentId}/${file.name}`, file, {
    access: "public",
  });

  // Insert document record
  const [doc] = await db
    .insert(ragDocuments)
    .values({
      agentId,
      name: file.name,
      url: blob.url,
      size: file.size,
      contentType: file.type,
      status: "processing",
    })
    .returning();

  // Process: parse → chunk → embed → insert chunks
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseDocument(buffer, file.type);
    const chunks = chunkText(text, {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    });

    if (chunks.length === 0) {
      await db
        .update(ragDocuments)
        .set({ status: "ready", chunkCount: 0 })
        .where(eq(ragDocuments.id, doc.id));
      return NextResponse.json({ ...doc, status: "ready", chunkCount: 0 });
    }

    // Generate embeddings in batches
    const BATCH_SIZE = 10;
    const chunkValues: Array<{
      documentId: string;
      agentId: string;
      content: string;
      chunkIndex: number;
      embedding: number[] | null;
      metadata: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await Promise.all(
        batch.map((c) =>
          generateEmbedding(c.content, orgId, config.embeddingModel).catch(
            () => null
          )
        )
      );

      for (let j = 0; j < batch.length; j++) {
        chunkValues.push({
          documentId: doc.id,
          agentId,
          content: batch[j].content,
          chunkIndex: batch[j].index,
          embedding: embeddings[j],
          metadata: batch[j].metadata,
        });
      }
    }

    // Batch insert chunks
    await db.insert(ragChunks).values(chunkValues);

    // Update document status
    const [updated] = await db
      .update(ragDocuments)
      .set({ status: "ready", chunkCount: chunks.length })
      .where(eq(ragDocuments.id, doc.id))
      .returning();

    return NextResponse.json(updated);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    const [updated] = await db
      .update(ragDocuments)
      .set({ status: "error", error: errorMsg.slice(0, 500) })
      .where(eq(ragDocuments.id, doc.id))
      .returning();

    return NextResponse.json(updated, { status: 500 });
  }
}
