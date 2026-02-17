import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PricingSOPResultUI } from "@/tool-ui/pricing-result";
import {
  // Universe
  successMultiCategoryArgs,
  successMultiCategoryResult,
  withAdjustmentsArgs,
  withAdjustmentsResult,
  nySpecialArgs,
  nySpecialResult,
  skippedAdjustmentsArgs,
  skippedAdjustmentsResult,
  errorArgs,
  errorResult,
  // Ocean
  oceanArgs,
  oceanResult,
  // Hermes CA
  hermesCaArgs,
  hermesCaResult,
  // Thunder
  thunderArgs,
  thunderResult,
  // Fabulous
  fabulousArgs,
  fabulousResult,
  // Celebrity
  celebrityConformingArgs,
  celebrityConformingResult,
  celebrityNonConformingArgs,
  celebrityNonConformingResult,
  // Radiant CRA
  radiantCraArgs,
  radiantCraResult,
  // Radiant AU
  radiantAuArgs,
  radiantAuResult,
} from "./pricing-mock-data";

const meta = {
  title: "Tools/Pricing/PricingSOPResultUI",
  component: PricingSOPResultUI,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl mx-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PricingSOPResultUI>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// Universe
// ============================================================================

/** Universe: Full result with multiple categories (30 Yr Fixed, 10/1 ARM) */
export const Universe: Story = {
  args: {
    result: successMultiCategoryResult,
    args: successMultiCategoryArgs,
    state: "result",
  },
};

/** Universe: Low FICO + outside US doc signing + short sale — multiple adjustments triggered */
export const UniverseWithAdjustments: Story = {
  args: {
    result: withAdjustmentsResult,
    args: withAdjustmentsArgs,
    state: "result",
  },
};

/** Universe: New York uses special CRA-only rate */
export const UniverseNYSpecial: Story = {
  args: {
    result: nySpecialResult,
    args: nySpecialArgs,
    state: "result",
  },
};

/** Universe: Partial input — some adjustments skipped due to missing fields */
export const UniverseSkippedAdjustments: Story = {
  args: {
    result: skippedAdjustmentsResult,
    args: skippedAdjustmentsArgs,
    state: "result",
  },
};

// ============================================================================
// Ocean
// ============================================================================

/** Ocean: ARM-only product (5/6 ARM + 7/6 ARM) */
export const Ocean: Story = {
  args: {
    result: oceanResult,
    args: oceanArgs,
    state: "result",
  },
};

// ============================================================================
// Hermes CA
// ============================================================================

/** Hermes CA: Non-QM with LLPA matrices and income doc adjustments */
export const HermesCA: Story = {
  args: {
    result: hermesCaResult,
    args: hermesCaArgs,
    state: "result",
  },
};

// ============================================================================
// Thunder
// ============================================================================

/** Thunder: Conforming 30yr Fixed with LLPA */
export const Thunder: Story = {
  args: {
    result: thunderResult,
    args: thunderArgs,
    state: "result",
  },
};

// ============================================================================
// Fabulous
// ============================================================================

/** Fabulous: Florida ARM product (5/6, 7/6, 10/6 ARM) with LLPA */
export const Fabulous: Story = {
  args: {
    result: fabulousResult,
    args: fabulousArgs,
    state: "result",
  },
};

// ============================================================================
// Celebrity
// ============================================================================

/** Celebrity: Conforming Fixed — largest product with many LLPA matrices */
export const CelebrityConforming: Story = {
  args: {
    result: celebrityConformingResult,
    args: celebrityConformingArgs,
    state: "result",
  },
};

/** Celebrity: Non-Conforming ARM with FICO/LTV rate adjustments */
export const CelebrityNonConformingARM: Story = {
  args: {
    result: celebrityNonConformingResult,
    args: celebrityNonConformingArgs,
    state: "result",
  },
};

// ============================================================================
// Radiant CRA
// ============================================================================

/** Radiant CRA: Community lending (30yr Fixed + 7/6 ARM), rate adjustments */
export const RadiantCRA: Story = {
  args: {
    result: radiantCraResult,
    args: radiantCraArgs,
    state: "result",
  },
};

// ============================================================================
// Radiant AU
// ============================================================================

/** Radiant AU: Asset utilization (3/6 + 5/6 ARM), no income verification */
export const RadiantAU: Story = {
  args: {
    result: radiantAuResult,
    args: radiantAuArgs,
    state: "result",
  },
};

// ============================================================================
// Shared states
// ============================================================================

/** Engine returned an error */
export const Error: Story = {
  args: {
    result: errorResult,
    args: errorArgs,
    state: "result",
  },
};

/** Loading state — tool call in progress */
export const Loading: Story = {
  args: {
    result: undefined,
    state: "input-streaming",
  },
};
