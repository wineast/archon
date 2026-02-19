// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
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
  { id: "ds-states", key: "states", name: "States", source: "dataset" },
  { id: "ds-languages", key: "languages", name: "Languages", source: "dataset" },
];

/** Wrapper that provides FormProvider context for ParameterRow. */
function FormWrapper({
  defaultParam,
  children,
}: {
  defaultParam: ToolParameter;
  children: React.ReactNode;
}) {
  const form = useForm({ defaultValues: { items: [defaultParam] } });
  return <FormProvider {...form}>{children}</FormProvider>;
}

function renderRow(
  paramOverrides: Partial<ToolParameter> = {},
  propsOverrides: Partial<
    Omit<React.ComponentProps<typeof ParameterRow>, "fieldPath" | "onDelete">
  > = {}
) {
  const onDelete = vi.fn();
  const param = makeParam(paramOverrides);

  render(
    <FormWrapper defaultParam={param}>
      <ParameterRow
        fieldPath="items.0"
        onDelete={onDelete}
        enumRefOptions={defaultEnumRefOptions}
        {...propsOverrides}
      />
    </FormWrapper>
  );

  return { onDelete, param };
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

  it("shows ref select when enumDatasetId is set", () => {
    renderRow({ type: "enum", enumDatasetId: "ds-states" });
    expect(
      screen.queryByPlaceholderText("逗号分隔值，如 CA, NY, TX")
    ).not.toBeInTheDocument();
  });

  it("displays existing manual enum values", () => {
    renderRow({ type: "enum", enum: ["CA", "NY", "TX"] });
    const input = screen.getByPlaceholderText("逗号分隔值，如 CA, NY, TX");
    expect(input).toHaveValue("CA, NY, TX");
  });

  it("updates enum values on manual input", async () => {
    const user = userEvent.setup();
    renderRow({ type: "enum" });

    const input = screen.getByPlaceholderText("逗号分隔值，如 CA, NY, TX");
    await user.type(input, "a");
    expect(input).toHaveValue("a");
  });

  it("clears enum fields when switching from enum to other type", () => {
    const param = makeParam({ type: "enum", enum: ["CA"] });
    const updated: ToolParameter = { ...param, type: "string" };
    delete updated.enum;

    expect(updated.enum).toBeUndefined();
    expect(updated.type).toBe("string");
  });

  it("clears enum when switching to ref source", () => {
    const param = makeParam({ type: "enum", enum: ["CA", "NY"] });
    const updated = { ...param, enum: undefined };
    expect(updated.enum).toBeUndefined();
  });
});
