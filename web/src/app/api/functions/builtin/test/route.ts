import { NextResponse } from "next/server";
import { compileExpression } from "filtrex";

/**
 * Registry of builtin function runners.
 * Each runner takes the test case input and returns the result.
 */
const BUILTIN_RUNNERS: Record<
  string,
  (input: Record<string, unknown>) => unknown
> = {
  compileExpression: (input) => {
    const expr = compileExpression(input.expression as string);
    return expr(input.data as Record<string, unknown>);
  },
};

export async function POST(req: Request) {
  const { key, input } = (await req.json()) as {
    key: string;
    input: Record<string, unknown>;
  };

  const runner = BUILTIN_RUNNERS[key];
  if (!runner) {
    return NextResponse.json(
      { error: `Unknown builtin: ${key}` },
      { status: 400 }
    );
  }

  const start = Date.now();
  try {
    const result = runner(input);
    return NextResponse.json({
      success: true,
      result,
      durationMs: Date.now() - start,
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - start,
    });
  }
}
