import { NextRequest, NextResponse } from "next/server";
import { createToolContext } from "@/lib/tools/tool-context";

export async function POST(req: NextRequest) {
  try {
    const { handler, args } = await req.json();

    if (!handler || typeof handler !== "string") {
      return NextResponse.json(
        { success: false, error: "handler is required" },
        { status: 400 }
      );
    }

    // Parse the handler function
    let fn: (args: unknown, context: unknown) => unknown;
    try {
      fn = new Function("return (" + handler + ")")() as typeof fn;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({
        success: false,
        error: `Failed to parse JS handler: ${msg}`,
      });
    }

    if (typeof fn !== "function") {
      return NextResponse.json({
        success: false,
        error: "Handler must be a function expression (arrow function or function expression)",
      });
    }

    const context = createToolContext();
    const result = await fn(args ?? {}, context);

    return NextResponse.json({ success: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      success: false,
      error: `Execution error: ${msg}`,
    });
  }
}
