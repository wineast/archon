import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CollapsibleSection,
  InputsSection,
  ResultHeader,
  ResultSection,
  RateSheetLinks,
} from "../tool-result";

// ============================================================================
// CollapsibleSection
// ============================================================================

const collapsibleMeta = {
  title: "Tools/Shared/CollapsibleSection",
  component: CollapsibleSection,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CollapsibleSection>;

export default collapsibleMeta;
type CollapsibleStory = StoryObj<typeof collapsibleMeta>;

export const DefaultCollapsed: CollapsibleStory = {
  args: {
    title: "Adjustments",
    badge: 3,
    children: (
      <div className="p-3 text-sm text-muted-foreground">
        Three adjustments applied to pricing.
      </div>
    ),
  },
};

export const DefaultOpen: CollapsibleStory = {
  args: {
    title: "Rate Details",
    defaultOpen: true,
    children: (
      <div className="p-3 text-sm">
        <p>Base Rate: 6.125%</p>
        <p>Final Rate: 6.125%</p>
      </div>
    ),
  },
};

export const Borderless: CollapsibleStory = {
  args: {
    title: "Parameters",
    defaultOpen: true,
    borderless: true,
    children: (
      <div className="px-3 pb-3 text-sm text-muted-foreground">
        Borderless mode for embedding inside divide-y containers.
      </div>
    ),
  },
};

// ============================================================================
// InputsSection
// ============================================================================

export const InputsSectionStory: CollapsibleStory = {
  args: {
    title: "InputsSection",
    children: null,
  },
  render: () => (
    <InputsSection
      title="Input Parameters"
      args={{
        ficoScore: 720,
        state: "CA",
        isUniverseRefinance: false,
        docSigningLocation: "insideUS",
        lockDays: 30,
      }}
      fieldDescriptions={{
        ficoScore: "Borrower FICO score",
        state: "Property state (NY uses special CRA rate)",
        isUniverseRefinance: "Whether this is a refinance of an existing Universe loan",
        docSigningLocation: "Where documents will be signed",
      }}
    />
  ),
};

// ============================================================================
// ResultHeader + ResultSection
// ============================================================================

export const HeaderAndSection: CollapsibleStory = {
  args: {
    title: "ResultHeader + ResultSection",
    children: null,
  },
  render: () => (
    <div className="border rounded-lg divide-y">
      <ResultHeader title="Universe Pricing" />
      <ResultSection>
        <p className="text-sm text-muted-foreground">
          Content goes here inside a ResultSection.
        </p>
      </ResultSection>
    </div>
  ),
};

// ============================================================================
// RateSheetLinks
// ============================================================================

export const SingleRateSheet: CollapsibleStory = {
  args: {
    title: "RateSheetLinks (Single)",
    children: null,
  },
  render: () => (
    <RateSheetLinks
      rateSheets={[
        {
          type: "pdf",
          url: "/products/universe/rate-sheets/GMCC Universe 12-22-2025 Snow.pdf",
          title: "GMCC Universe 12-22-2025 Snow",
        },
      ]}
      onSelect={(sheet) => console.log("Selected:", sheet.title)}
    />
  ),
};

export const MultipleRateSheets: CollapsibleStory = {
  args: {
    title: "RateSheetLinks (Multiple)",
    children: null,
  },
  render: () => (
    <RateSheetLinks
      rateSheets={[
        {
          type: "pdf",
          url: "/sheet1.pdf",
          title: "Rate Sheet v1",
        },
        {
          type: "pdf",
          url: "/sheet2.pdf",
          title: "Rate Sheet v2 (Updated)",
        },
      ]}
      onSelect={(sheet) => console.log("Selected:", sheet.title)}
    />
  ),
};
