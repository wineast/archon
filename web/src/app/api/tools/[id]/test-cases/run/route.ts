import { NextResponse } from "next/server";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { eq } from "drizzle-orm";
import deepEqual from "fast-deep-equal";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import { createToolContext } from "@/lib/tools/tool-context";
import { executeToolHandler } from "@/lib/tools/execute-handler";
import { getDefsMap, resolveInlineSchema } from "@/lib/schemas/resolve-inline";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Load tool from DB
  const [tool] = await db
    .select()
    .from(tools)
    .where(eq(tools.id, id));

  if (!tool) {
    return NextResponse.json(
      { error: "Tool not found" },
      { status: 404 }
    );
  }

  if (tool.executionTarget === "client" || tool.executionTarget === "host") {
    return NextResponse.json({
      success: false,
      error: tool.executionTarget === "host"
        ? "宿主端工具无法在服务端测试，请在嵌入页面中测试"
        : "浏览器端工具无法在服务端测试，请在聊天页面中测试",
      durationMs: 0,
      passed: false,
    });
  }

  if (!tool.handler?.trim() && !tool.url?.trim()) {
    return NextResponse.json({
      success: false,
      error: "Tool has no handler defined",
      durationMs: 0,
      passed: false,
    });
  }

  const { input, expectedOutput } = (await req.json()) as {
    input: Record<string, unknown>;
    expectedOutput?: unknown;
  };

  const start = Date.now();

  // Resolve $ref in parameters schema and validate input
  const defsMap = tool.agentId ? await getDefsMap(tool.agentId) : {};
  let validatedInput = input ?? {};
  if (tool.parametersSchema) {
    try {
      const schema = resolveInlineSchema(tool.parametersSchema, defsMap) ?? tool.parametersSchema;
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        const parsedSchema = buildInputSchema(schema, undefined, { defsMap });
        validatedInput = parsedSchema.parse(input ?? {});
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({
        success: false,
        error: `Validation error: ${msg}`,
        durationMs: Date.now() - start,
        passed: false,
      });
    }
  }

  // Execute handler
  let result: unknown;
  try {
    const url = tool.url?.trim();
    if (url) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedInput),
      });
      if (!res.ok) {
        throw new Error(`Handler returned ${res.status}: ${await res.text()}`);
      }
      result = await res.json();
    } else {
      const context = createToolContext(tool.agentId ?? undefined);
      result = await executeToolHandler(tool.handler!, validatedInput, context);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      success: false,
      error: `Execution error: ${msg}`,
      durationMs: Date.now() - start,
      passed: false,
    });
  }

  const durationMs = Date.now() - start;

  // Exact match comparison
  const passed =
    expectedOutput == null ||
    deepEqual(result, expectedOutput);

  return NextResponse.json({
    success: true,
    result,
    durationMs,
    passed,
  });
}
