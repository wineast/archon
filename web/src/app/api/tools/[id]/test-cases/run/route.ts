import { NextResponse } from "next/server";
import { db } from "@/db";
import { tools, schemas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import { createToolContext } from "@/lib/tools/tool-context";

/** Stable JSON stringify with sorted keys for deep equality comparison. */
function stableStringify(val: unknown): string {
  if (val === undefined) return "null";
  if (val === null) return "null";
  if (typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val))
    return "[" + val.map(stableStringify).join(",") + "]";
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

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

  if (!tool.handler?.trim()) {
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

  // Compile handler
  let handlerFn: (args: unknown, context: unknown) => unknown;
  try {
    handlerFn = new Function("return (" + tool.handler + ")")() as typeof handlerFn;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      success: false,
      error: `Compilation error: ${msg}`,
      durationMs: Date.now() - start,
      passed: false,
    });
  }

  if (typeof handlerFn !== "function") {
    return NextResponse.json({
      success: false,
      error: "Handler must evaluate to a function",
      durationMs: Date.now() - start,
      passed: false,
    });
  }

  // Validate input against schema parameters
  let validatedInput = input ?? {};
  if (tool.parametersSchemaId) {
    try {
      const [schemaRow] = await db
        .select()
        .from(schemas)
        .where(eq(schemas.id, tool.parametersSchemaId));
      if (schemaRow && schemaRow.parameters.length > 0) {
        const inputSchema = buildInputSchema(schemaRow.parameters);
        validatedInput = inputSchema.parse(input ?? {});
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

  // Execute
  let result: unknown;
  try {
    const context = createToolContext(tool.agentId ?? undefined);
    result = await handlerFn(validatedInput, context);
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
    stableStringify(result) === stableStringify(expectedOutput);

  return NextResponse.json({
    success: true,
    result,
    durationMs,
    passed,
  });
}
