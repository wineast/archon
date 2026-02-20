import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BoldIcon, ItalicIcon, UnderlineIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default size tabs. */
export const Default: Story = {
  render: () => (
    <Tabs defaultValue="edit" className="w-[300px]">
      <TabsList>
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="edit">
        <p className="text-sm p-2">Edit content here.</p>
      </TabsContent>
      <TabsContent value="preview">
        <p className="text-sm p-2">Preview content here.</p>
      </TabsContent>
    </Tabs>
  ),
};

/** Small size tabs for form-embedded usage (h-7 + text-xs). */
export const Small: Story = {
  render: () => (
    <Tabs defaultValue="edit" className="w-[300px]">
      <TabsList className="h-7">
        <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
        <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="edit">
        <p className="text-sm p-2">Edit content here.</p>
      </TabsContent>
      <TabsContent value="preview">
        <p className="text-sm p-2">Preview content here.</p>
      </TabsContent>
    </Tabs>
  ),
};

/** Line variant tabs for top-level navigation. */
export const Line: Story = {
  render: () => (
    <Tabs defaultValue="general" className="w-[400px]">
      <TabsList variant="line">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <p className="text-sm p-2">General settings.</p>
      </TabsContent>
      <TabsContent value="settings">
        <p className="text-sm p-2">Settings content.</p>
      </TabsContent>
      <TabsContent value="advanced">
        <p className="text-sm p-2">Advanced options.</p>
      </TabsContent>
    </Tabs>
  ),
};

/** Default size with icons in triggers. */
export const WithIcons: Story = {
  render: () => (
    <Tabs defaultValue="bold" className="w-[300px]">
      <TabsList>
        <TabsTrigger value="bold">
          <BoldIcon /> Bold
        </TabsTrigger>
        <TabsTrigger value="italic">
          <ItalicIcon /> Italic
        </TabsTrigger>
        <TabsTrigger value="underline">
          <UnderlineIcon /> Underline
        </TabsTrigger>
      </TabsList>
      <TabsContent value="bold">
        <p className="text-sm p-2 font-bold">Bold text preview.</p>
      </TabsContent>
      <TabsContent value="italic">
        <p className="text-sm p-2 italic">Italic text preview.</p>
      </TabsContent>
      <TabsContent value="underline">
        <p className="text-sm p-2 underline">Underline text preview.</p>
      </TabsContent>
    </Tabs>
  ),
};

/** Small size with icons — typical form-embedded usage. */
export const SmallWithIcons: Story = {
  render: () => (
    <Tabs defaultValue="bold" className="w-[300px]">
      <TabsList className="h-7">
        <TabsTrigger value="bold" className="text-xs">
          <BoldIcon /> Bold
        </TabsTrigger>
        <TabsTrigger value="italic" className="text-xs">
          <ItalicIcon /> Italic
        </TabsTrigger>
        <TabsTrigger value="underline" className="text-xs">
          <UnderlineIcon /> Underline
        </TabsTrigger>
      </TabsList>
      <TabsContent value="bold">
        <p className="text-sm p-2 font-bold">Bold text preview.</p>
      </TabsContent>
      <TabsContent value="italic">
        <p className="text-sm p-2 italic">Italic text preview.</p>
      </TabsContent>
      <TabsContent value="underline">
        <p className="text-sm p-2 underline">Underline text preview.</p>
      </TabsContent>
    </Tabs>
  ),
};
