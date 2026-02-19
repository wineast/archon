import type { BuiltinFunction } from "./types";

const builtinCompileExpression: BuiltinFunction = {
  key: "compileExpression",
  name: "Compile Expression",
  description:
    "Compiles a string expression (e.g. math formulas, conditional logic) into an executable function. Powered by the filtrex library.",
  source: "filtrex",
  parameters: [
    {
      id: "expression",
      name: "expression",
      type: "string",
      description: "The expression string to compile, e.g. \"x + y * 2\", \"if score >= 700 then 1 else 0\"",
      required: true,
    },
    {
      id: "data",
      name: "data",
      type: "object",
      description: "An object whose keys are the variable names used in the expression",
      required: true,
    },
  ],
  returnParameters: [
    {
      id: "result",
      name: "result",
      type: "object",
      description: "The evaluation result. Type depends on the expression: number for arithmetic, boolean for comparisons/logical.",
      required: true,
    },
  ],
  code: `// filtrex compileExpression
// Compiles a string expression into a callable function.
//
// Usage in your function:
//   function fn(compileExpression) {
//     const expr = compileExpression("x + y * 2");
//     const result = expr({ x: 10, y: 5 }); // => 20
//     return result;
//   }
//
// Supported operators: +, -, *, /, ^, ==, !=, <, >, <=, >=
// Logical: and, or, not, if..then..else
// Functions: abs, ceil, floor, round, min, max, sqrt, etc.
`,
  testCases: [
    {
      name: "Arithmetic",
      description: "Basic math: x + y * 2",
      input: { expression: "x + y * 2", data: { x: 10, y: 5 } },
      expectedOutput: 20,
    },
    {
      name: "Comparison",
      description: "Boolean comparison: score >= 700",
      input: { expression: "score >= 700", data: { score: 740 } },
      expectedOutput: true,
    },
    {
      name: "Conditional",
      description: "if..then..else: if ltv > 80 then 1 else 0",
      input: { expression: "if ltv > 80 then 1 else 0", data: { ltv: 95 } },
      expectedOutput: 1,
    },
    {
      name: "Math functions",
      description: "Built-in functions: max(a, b) + floor(c)",
      input: { expression: "max(a, b) + floor(c)", data: { a: 3, b: 7, c: 2.9 } },
      expectedOutput: 9,
    },
    {
      name: "Logical AND",
      description: "Logical operators: x > 0 and y > 0",
      input: { expression: "x > 0 and y > 0", data: { x: 5, y: 3 } },
      expectedOutput: true,
    },
  ],
};

export default builtinCompileExpression;
