import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "../button";
import { ConfirmDialog } from "../confirm-dialog";

const meta = {
  title: "UI/ConfirmDialog",
  component: ConfirmDialog,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ---------- helpers ---------- */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ---------- stories ---------- */

/** Default destructive delete confirmation. */
export const Default: Story = {
  args: {
    open: false,
    onOpenChange: () => {},
    onConfirm: async () => sleep(800),
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete Item
        </Button>
        <ConfirmDialog {...args} open={open} onOpenChange={setOpen} />
      </>
    );
  },
};

/** Custom title, description, and labels. */
export const CustomLabels: Story = {
  args: {
    open: false,
    onOpenChange: () => {},
    title: "永久删除",
    description: "确定永久删除此资源？此操作不可撤销。",
    cancelLabel: "取消",
    confirmLabel: "永久删除",
    onConfirm: async () => sleep(800),
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          永久删除
        </Button>
        <ConfirmDialog {...args} open={open} onOpenChange={setOpen} />
      </>
    );
  },
};

/** Non-destructive confirm variant (e.g. ownership transfer). */
export const NonDestructive: Story = {
  args: {
    open: false,
    onOpenChange: () => {},
    title: "Transfer Ownership",
    description:
      "Are you sure you want to transfer ownership to user@example.com? You will become an Admin.",
    cancelLabel: "Cancel",
    confirmLabel: "Transfer",
    confirmVariant: "default",
    onConfirm: async () => sleep(800),
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Transfer Ownership</Button>
        <ConfirmDialog {...args} open={open} onOpenChange={setOpen} />
      </>
    );
  },
};

/** Shows the loading spinner during async confirm. */
export const WithAsyncConfirm: Story = {
  args: {
    open: false,
    onOpenChange: () => {},
    title: "Delete Schema",
    description:
      'Are you sure you want to delete "user_profile"? This action cannot be undone.',
    onConfirm: async () => sleep(2000),
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete Schema (2s delay)
        </Button>
        <ConfirmDialog {...args} open={open} onOpenChange={setOpen} />
      </>
    );
  },
};
