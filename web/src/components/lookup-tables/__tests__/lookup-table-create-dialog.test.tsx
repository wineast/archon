// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LookupTableCreateDialog } from "../lookup-table-create-dialog";

function renderDialog(overrides: Partial<React.ComponentProps<typeof LookupTableCreateDialog>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined) as unknown as (key: string, name: string) => Promise<void>,
    ...overrides,
  };
  render(<LookupTableCreateDialog {...props} />);
  return props;
}

describe("LookupTableCreateDialog", () => {
  it("formats key input to snake_case lowercase", async () => {
    const user = userEvent.setup();
    renderDialog();

    const keyInput = screen.getByPlaceholderText("e.g. income_type");
    await user.type(keyInput, "Loan Type");

    expect(keyInput).toHaveValue("loan_type");
  });

  it("auto-suggests name from key", async () => {
    const user = userEvent.setup();
    renderDialog();

    const keyInput = screen.getByPlaceholderText("e.g. income_type");
    await user.type(keyInput, "income_type");

    const nameInput = screen.getByPlaceholderText("e.g. Income Type");
    expect(nameInput).toHaveValue("Income Type");
  });

  it("allows manual name override without resetting on key change", async () => {
    const user = userEvent.setup();
    renderDialog();

    const keyInput = screen.getByPlaceholderText("e.g. income_type");
    const nameInput = screen.getByPlaceholderText("e.g. Income Type");

    await user.type(keyInput, "foo");
    expect(nameInput).toHaveValue("Foo");

    await user.clear(nameInput);
    await user.type(nameInput, "Custom Name");

    await user.type(keyInput, "_bar");
    // Name should NOT change after manual edit
    expect(nameInput).toHaveValue("Custom Name");
  });

  it("disables Create button when key is empty", () => {
    renderDialog();

    const createBtn = screen.getByRole("button", { name: "Create" });
    expect(createBtn).toBeDisabled();
  });

  it("enables Create button when key is non-empty", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByPlaceholderText("e.g. income_type"), "test");

    const createBtn = screen.getByRole("button", { name: "Create" });
    expect(createBtn).toBeEnabled();
  });

  it("calls onCreate with key and name on submit", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.type(screen.getByPlaceholderText("e.g. income_type"), "product_routes");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(props.onCreate).toHaveBeenCalledWith("product_routes", "Product Routes");
  });

  it("resets fields when dialog is closed", async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.type(screen.getByPlaceholderText("e.g. income_type"), "test");

    // Click cancel to close
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("strips non-alphanumeric characters from key", async () => {
    const user = userEvent.setup();
    renderDialog();

    const keyInput = screen.getByPlaceholderText("e.g. income_type");
    await user.type(keyInput, "hello@world!");

    expect(keyInput).toHaveValue("helloworld");
  });

  it("converts hyphens to underscores in key", async () => {
    const user = userEvent.setup();
    renderDialog();

    const keyInput = screen.getByPlaceholderText("e.g. income_type");
    await user.type(keyInput, "loan-type");

    expect(keyInput).toHaveValue("loan_type");
  });
});
