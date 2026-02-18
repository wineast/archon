import { NextRequest, NextResponse } from "next/server";
import { compileFn } from "@/lib/functions/compile";
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

    // Compile the function (without parameter wrapping — we validate separately)
    let fn: unknown;
    try {
      fn = compileFn(code);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({
        success: false,
        error: `Compilation error: ${msg}`,
      });
    }

    if (typeof fn !== "function") {
      return NextResponse.json({
        success: false,
        error: "Function code must return a callable (e.g. `return function pricingEngine(input) { ... }`)",
      });
    }

    // Validate input against parameters schema
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

    const result = await (fn as (input: unknown) => unknown)(validatedInput);

    return NextResponse.json({ success: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      success: false,
      error: `Execution error: ${msg}`,
    });
  }
}
