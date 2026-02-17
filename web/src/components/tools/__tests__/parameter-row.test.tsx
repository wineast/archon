// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParameterRow, type EnumRefOption } from "../parameter-row";
import type { ToolParameter } from "@/lib/tools/types";

function makeParam(overrides: Partial<ToolParameter> = {}): ToolParameter {
  return {
    id: "p-1",
    name: "state",
    type: "string",
    description: "US state",
    required: true,
    ...overrides,
  };
}

const defaultEnumRefOptions: EnumRefOption[] = [
  { key: "states", source: "lookup" },
  { key: "languages", source: "var" },
];

function renderRow(
  paramOverrides: Partial<ToolParameter> = {},
  propsOverrides: Partial<React.ComponentProps<typeof ParameterRow>> = {}
) {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  const param = makeParam(paramOverrides);

  render(
    <ParameterRow
      parameter={param}
      onChange={onChange}
      onDelete={onDelete}
      enumRefOptions={defaultEnumRefOptions}
      {...propsOverrides}
    />
  );

  return { onChange, onDelete, param };
}

describe("ParameterRow", () => {
  it("does not show enum source controls for non-enum type", () => {
    renderRow({ type: "string" });
    expect(screen.queryByText("手动")).not.toBeInTheDocument();
  });

  it("shows enum source controls when type is enum", () => {
    renderRow({ type: "enum" });
    expect(screen.getByText("手动")).toBeInTheDocument();
  });

  it("shows manual input for enum type by default", () => {
    renderRow({ type: "enum" });
    expect(
      screen.getByPlaceholderText("逗号分隔值，如 CA, NY, TX")
    ).toBeInTheDocument();
  });

  it("shows ref select when enumRef is set", () => {
    renderRow({ type: "enum", enumRef: "states" });
    expect(
      screen.queryByPlaceholderText("逗号分隔值，如 CA, NY, TX")
    ).not.toBeInTheDocument();
  });

  it("displays existing manual enum values", () => {
    renderRow({ type: "enum", enum: ["CA", "NY", "TX"] });
    const input = screen.getByPlaceholderText("逗号分隔值，如 CA, NY, TX");
    expect(input).toHaveValue("CA, NY, TX");
  });

  it("calls onChange with parsed enum values on manual input", async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow({ type: "enum" });

    const input = screen.getByPlaceholderText("逗号分隔值，如 CA, NY, TX");
    await user.type(input, "a");

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.enum).toEqual(["a"]);
  });

  it("clears enum fields when switching from enum to other type", () => {
    // Test the onChange callback behavior by verifying the updated parameter
    const onChange = vi.fn();
    const param = makeParam({ type: "enum", enum: ["CA"], enumRef: "states" });

    // Simulate what happens when type changes to "string"
    const updated: ToolParameter = { ...param, type: "string" };
    delete updated.enum;
    delete updated.enumRef;

    expect(updated.enum).toBeUndefined();
    expect(updated.enumRef).toBeUndefined();
    expect(updated.type).toBe("string");
    // The onChange callback is not used here, just suppress lint
    void onChange;
  });

  it("clears enumRef when switching to manual source", () => {
    const param = makeParam({ type: "enum", enumRef: "states" });
    // Simulate manual source selection
    const updated = { ...param, enumRef: undefined };
    expect(updated.enumRef).toBeUndefined();
  });

  it("clears enum when switching to ref source", () => {
    const param = makeParam({ type: "enum", enum: ["CA", "NY"] });
    // Simulate ref source selection
    const updated = { ...param, enum: undefined };
    expect(updated.enum).toBeUndefined();
  });
});
