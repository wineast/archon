import { functions, functionTestCases } from "@/db/schema";
import { and, isNull, eq } from "drizzle-orm";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import type { JsonSchema7 } from "@/lib/schemas/types";

type DbLike = PostgresJsDatabase<typeof schema>;

/* ── builtin function definitions ── */

interface BuiltinFunctionDef {
  key: string;
  name: string;
  description: string;
  code: string;
  parametersSchema: JsonSchema7;
  returnParametersSchema: JsonSchema7;
  testCases: {
    name: string;
    input: Record<string, unknown>;
    expectedOutput: unknown;
    showAsExample: boolean;
  }[];
}

const BUILTIN_DEFS: BuiltinFunctionDef[] = [
  {
    key: "compileExpression",
    name: "Compile Expression",
    description:
      "Compiles a string expression (e.g. math formulas, conditional logic) into an executable function. Powered by the filtrex library.",
    code: `export default function(input) {
  const expr = compileExpression(input.expression);
  return expr(input.data);
}`,
    parametersSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description:
            'The expression string to compile, e.g. "x + y * 2", "if score >= 700 then 1 else 0"',
        },
        data: {
          type: "object",
          description:
            "An object whose keys are the variable names used in the expression",
        },
      },
      required: ["expression", "data"],
    },
    returnParametersSchema: {
      type: "object",
      properties: {
        result: {
          type: "object",
          description:
            "The evaluation result. Type depends on the expression: number for arithmetic, boolean for comparisons/logical.",
        },
      },
      required: ["result"],
    },
    testCases: [
      {
        name: "Arithmetic",
        input: { expression: "x + y * 2", data: { x: 10, y: 5 } },
        expectedOutput: 20,
        showAsExample: true,
      },
      {
        name: "Comparison",
        input: { expression: "score >= 700", data: { score: 740 } },
        expectedOutput: true,
        showAsExample: true,
      },
      {
        name: "Conditional",
        input: {
          expression: "if ltv > 80 then 1 else 0",
          data: { ltv: 95 },
        },
        expectedOutput: 1,
        showAsExample: true,
      },
      {
        name: "Math functions",
        input: {
          expression: "max(a, b) + floor(c)",
          data: { a: 3, b: 7, c: 2.9 },
        },
        expectedOutput: 9,
        showAsExample: true,
      },
      {
        name: "Logical AND",
        input: { expression: "x > 0 and y > 0", data: { x: 5, y: 3 } },
        expectedOutput: true,
        showAsExample: true,
      },
    ],
  },
];

/* ── public API ── */

/**
 * Ensure all builtin functions exist as pool resources
 * (agentId = NULL, origin = "builtin").
 * Also seeds their test cases.
 * Idempotent — uses onConflictDoNothing.
 */
export async function ensureBuiltinPoolFunctions(
  db: DbLike,
): Promise<void> {
  for (const def of BUILTIN_DEFS) {
    // Upsert the pool function
    const [inserted] = await db
      .insert(functions)
      .values({
        agentId: null as unknown as undefined,
        key: def.key,
        name: def.name,
        description: def.description,
        code: def.code,
        parametersSchema: def.parametersSchema,
        returnParametersSchema: def.returnParametersSchema,
        origin: "builtin" as const,
      })
      .onConflictDoNothing()
      .returning({ id: functions.id });

    // Resolve the function ID (either just inserted, or already exists)
    let functionId: string;
    if (inserted) {
      functionId = inserted.id;
    } else {
      const [existing] = await db
        .select({ id: functions.id })
        .from(functions)
        .where(
          and(isNull(functions.agentId), eq(functions.key, def.key)),
        );
      if (!existing) continue;
      functionId = existing.id;
    }

    // Seed test cases
    if (def.testCases.length > 0) {
      await db
        .insert(functionTestCases)
        .values(
          def.testCases.map((tc) => ({
            functionId,
            name: tc.name,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            showAsExample: tc.showAsExample,
          })),
        )
        .onConflictDoNothing();
    }
  }
}
