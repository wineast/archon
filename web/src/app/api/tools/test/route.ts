import { NextRequest, NextResponse } from "next/server";
import { createToolContext } from "@/lib/tools/tool-context";
import { executeToolHandler } from "@/lib/tools/execute-handler";

export async function POST(req: NextRequest) {
  try {
    const { handler, args } = await req.json();

    if (!handler || typeof handler !== "string") {
      return NextResponse.json(
        { success: false, error: "handler is required" },
        { status: 400 }
      );
    }

    const context = createToolContext();
    const result = await executeToolHandler(handler, args ?? {}, context);

    return NextResponse.json({ success: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      success: false,
      error: `Execution error: ${msg}`,
    });
  }
}
