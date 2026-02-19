import { NextRequest, NextResponse } from "next/server";
import { compileAndExecFn, SandboxCompilationError } from "@/lib/functions/sandbox";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import type { ToolParameter } from "@/lib/tools/types";

export async function POST(req: NextRequest) {
  try {
    const { code, parameters, input } = (await req.json()) as {
      code: string;
      parameters?: ToolParameter[];
      input?: unknown;
    };

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "code is required" },
        { status: 400 }
      );
    }

    // Validate input against parameters schema (host-side, before sandbox)
    let validatedInput = input ?? {};
    if (parameters && parameters.length > 0) {
      try {
        const schema = buildInputSchema(parameters);
        validatedInput = schema.parse(input ?? {});
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({
          success: false,
          error: `Validation error: ${msg}`,
        });
      }
    }

    const result = await compileAndExecFn(code, validatedInput);

    return NextResponse.json({ success: true, result });
  } catch (e) {
    if (e instanceof SandboxCompilationError) {
      return NextResponse.json({
        success: false,
        error: `Compilation error: ${e.message}`,
      });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      success: false,
      error: `Execution error: ${msg}`,
    });
  }
}
