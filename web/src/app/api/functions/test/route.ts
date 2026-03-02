import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { compileAndExecFn, CompilationError } from "@/lib/functions/exec";
import { ALL_BASE_DEPS } from "@/lib/functions/compile";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import type { JsonSchema7 } from "@/lib/schemas/types";

export async function POST(req: NextRequest) {
  try {
    const { code, parameters, input, agentId } = (await req.json()) as {
      code: string;
      parameters?: JsonSchema7;
      input?: unknown;
      agentId: string;
    };

    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json(
        { success: false, error: "agentId is required" },
        { status: 400 }
      );
    }

    const ctx = await requireAgentRole(agentId, "editor");
    if (ctx instanceof NextResponse) return ctx;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "code is required" },
        { status: 400 }
      );
    }

    // Validate input against parameters schema (host-side, before exec)
    let validatedInput = input ?? {};
    if (parameters && Object.keys(parameters.properties ?? {}).length > 0) {
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

    const result = await compileAndExecFn(code, validatedInput, ALL_BASE_DEPS);

    return NextResponse.json({ success: true, result });
  } catch (e) {
    if (e instanceof CompilationError) {
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
