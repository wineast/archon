import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compileSourceWithDeps } from "../_dynamic-renderer";
import type { ComponentRendererProps } from "../_registry";

// ── Helper: render component and return HTML string ──

function render(
  source: string,
  props: Partial<ComponentRendererProps> & { data?: unknown },
  extraDeps?: Record<string, unknown>
): string {
  const Comp = compileSourceWithDeps(source, extraDeps);
  const fullProps: ComponentRendererProps = { data: undefined, ...props };
  return renderToStaticMarkup(createElement(Comp, fullProps));
}

// ---------------------------------------------------------------------------
// Module format — tool prop
// ---------------------------------------------------------------------------
describe("compileSourceWithDeps (module format) — tool prop", () => {
  it("receives tool prop and renders tool.output", () => {
    const source = `
import React from "archon:react";
export default function({ tool }) {
  return <div>{tool.output.message}</div>;
}`;
    const html = render(source, {
      data: undefined,
      tool: { name: "greet", input: {}, output: { message: "hello" } },
    });
    expect(html).toContain("hello");
  });

  it("receives tool.name and tool.input", () => {
    const source = `
import React from "archon:react";
export default function({ tool }) {
  return <span>{tool.name}:{JSON.stringify(tool.input)}</span>;
}`;
    const html = render(source, {
      data: undefined,
      tool: { name: "search", input: { q: "test" }, output: {} },
    });
    expect(html).toContain("search");
    expect(html).toContain("&quot;q&quot;:&quot;test&quot;");
  });

  it("tool is undefined in component scenario", () => {
    const source = `
import React from "archon:react";
export default function({ tool, data }) {
  if (tool) return <div>tool</div>;
  return <div>data:{data.title}</div>;
}`;
    const html = render(source, {
      data: { title: "MyTitle" },
      tool: undefined,
    });
    expect(html).toContain("data:MyTitle");
    expect(html).not.toContain("tool");
  });

  it("isLoading / isComplete / isError are properly derived", () => {
    const source = `
import React from "archon:react";
export default function({ isLoading, isComplete, isError }) {
  return <div>L:{String(isLoading)} C:{String(isComplete)} E:{String(isError)}</div>;
}`;
    // output-available state
    const html = render(source, {
      data: undefined,
      state: "output-available",
      isLoading: false,
      isComplete: true,
      isError: false,
    });
    expect(html).toContain("L:false");
    expect(html).toContain("C:true");
    expect(html).toContain("E:false");
  });
});

// ---------------------------------------------------------------------------
// Module format — data prop (component scenario)
// ---------------------------------------------------------------------------
describe("compileSourceWithDeps (module format) — data prop", () => {
  it("receives data prop for component scenario", () => {
    const source = `
import React from "archon:react";
export default function({ data }) {
  return <div>{data.title}</div>;
}`;
    const html = render(source, {
      data: { title: "hello world" },
    });
    expect(html).toContain("hello world");
  });

  it("data is undefined in tool scenario", () => {
    const source = `
import React from "archon:react";
export default function({ data, tool }) {
  if (data) return <div>has data</div>;
  return <div>tool:{tool.name}</div>;
}`;
    const html = render(source, {
      data: undefined,
      tool: { name: "my_tool", input: {}, output: {} },
    });
    expect(html).toContain("tool:my_tool");
    expect(html).not.toContain("has data");
  });
});

// ---------------------------------------------------------------------------
// Legacy format — tool prop
// ---------------------------------------------------------------------------
describe("compileSourceWithDeps (legacy format) — tool prop", () => {
  it("receives tool prop via the inner function", () => {
    const source = `
function Component({ React }) {
  return function({ tool }) {
    return React.createElement("div", null, tool.output.result);
  };
}`;
    const html = render(source, {
      data: undefined,
      tool: { name: "calc", input: { x: 1 }, output: { result: 42 } },
    });
    expect(html).toContain("42");
  });

  it("renders data prop in legacy component scenario", () => {
    const source = `
function Component({ React }) {
  return function({ data }) {
    return React.createElement("span", null, data.label);
  };
}`;
    const html = render(source, {
      data: { label: "Price" },
    });
    expect(html).toContain("Price");
  });
});

// ---------------------------------------------------------------------------
// Both props coexist
// ---------------------------------------------------------------------------
describe("compileSourceWithDeps — dual prop coexistence", () => {
  it("component can check both tool and data to determine scenario", () => {
    const source = `
import React from "archon:react";
export default function({ tool, data }) {
  if (tool) return <div>tool-scenario:{tool.name}</div>;
  if (data) return <div>component-scenario:{data.label}</div>;
  return <div>empty</div>;
}`;
    // Tool scenario
    const toolHtml = render(source, {
      data: undefined,
      tool: { name: "lookup", input: {}, output: {} },
    });
    expect(toolHtml).toContain("tool-scenario:lookup");

    // Component scenario
    const dataHtml = render(source, {
      data: { label: "info" },
      tool: undefined,
    });
    expect(dataHtml).toContain("component-scenario:info");

    // Neither
    const emptyHtml = render(source, {
      data: undefined,
      tool: undefined,
    });
    expect(emptyHtml).toContain("empty");
  });
});

// ---------------------------------------------------------------------------
// JSX fragment format — module with tool prop
// ---------------------------------------------------------------------------
describe("compileSourceWithDeps — module format tool access", () => {
  it("can access tool variable in module format", () => {
    const source = `
import React from "archon:react";
export default function({ tool }) {
  return <p>{tool ? tool.name : "none"}</p>;
}`;
    const html = render(source, {
      data: undefined,
      tool: { name: "test_tool", input: {}, output: {} },
    });
    expect(html).toContain("test_tool");
  });
});
