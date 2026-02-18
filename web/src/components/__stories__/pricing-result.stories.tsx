import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DynamicToolRenderer } from "@/tool-ui";
import { DynamicComponentErrorBoundary } from "@/tool-ui";
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

// Minimal dynamic component for storybook — delegates to full component source at runtime
const STORY_SOURCE = `function Component({ output, isLoading }) {
  if (isLoading || !output) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Spinner className="h-3 w-3" />
        <span>Calculating pricing...</span>
      </div>
    );
  }
  if (!output.success) {
    return <div className="text-xs text-muted-foreground">Pricing Error: {output.error || "Unknown error"}</div>;
  }
  var options = output.options || [];
  if (options.length === 0) {
    return <div className="text-xs text-muted-foreground">No options available</div>;
  }
  var productName = output.productName || "Options";
  return (
    <div className="border rounded-lg overflow-hidden divide-y">
      <div className="px-4 pt-3 pb-2 text-sm font-semibold">{productName} Pricing</div>
      <ResultSection>
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Rate</TableHead>
              <TableHead className="text-xs text-right">Price</TableHead>
              <TableHead className="text-xs">{options[0].category || productName}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {options.slice(0, 10).map(function(opt, i) {
              return (
                <TableRow key={i}>
                  <TableCell className="text-xs font-mono">{opt.finalRate.toFixed(3)}%</TableCell>
                  <TableCell className="text-xs text-right font-mono">{opt.finalPrice.toFixed(3)}</TableCell>
                  <TableCell className="text-xs">{opt.category || productName}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {options.length > 10 && (
          <div className="text-xs text-muted-foreground p-2 text-center">
            + {options.length - 10} more options
          </div>
        )}
      </ResultSection>
    </div>
  );
}`;

function PricingStory({
  args: input,
  result: output,
  state = "output-available",
}: {
  args?: Record<string, unknown>;
  result?: unknown;
  state?: string;
}) {
  return (
    <DynamicComponentErrorBoundary fallbackToolName="pricing-story">
      <DynamicToolRenderer
        toolName="pricing_universe"
        state={state}
        input={input ?? {}}
        output={output ?? null}
        source={STORY_SOURCE}
      />
    </DynamicComponentErrorBoundary>
  );
}

const meta = {
  title: "Tools/Pricing/PricingSOPResultUI",
  component: PricingStory,
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
} satisfies Meta<typeof PricingStory>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// Universe
// ============================================================================

export const Universe: Story = {
  args: { result: successMultiCategoryResult, args: successMultiCategoryArgs, state: "output-available" },
};

export const UniverseWithAdjustments: Story = {
  args: { result: withAdjustmentsResult, args: withAdjustmentsArgs, state: "output-available" },
};

export const UniverseNYSpecial: Story = {
  args: { result: nySpecialResult, args: nySpecialArgs, state: "output-available" },
};

export const UniverseSkippedAdjustments: Story = {
  args: { result: skippedAdjustmentsResult, args: skippedAdjustmentsArgs, state: "output-available" },
};

// ============================================================================
// Ocean
// ============================================================================

export const Ocean: Story = {
  args: { result: oceanResult, args: oceanArgs, state: "output-available" },
};

// ============================================================================
// Hermes CA
// ============================================================================

export const HermesCA: Story = {
  args: { result: hermesCaResult, args: hermesCaArgs, state: "output-available" },
};

// ============================================================================
// Thunder
// ============================================================================

export const Thunder: Story = {
  args: { result: thunderResult, args: thunderArgs, state: "output-available" },
};

// ============================================================================
// Fabulous
// ============================================================================

export const Fabulous: Story = {
  args: { result: fabulousResult, args: fabulousArgs, state: "output-available" },
};

// ============================================================================
// Celebrity
// ============================================================================

export const CelebrityConforming: Story = {
  args: { result: celebrityConformingResult, args: celebrityConformingArgs, state: "output-available" },
};

export const CelebrityNonConformingARM: Story = {
  args: { result: celebrityNonConformingResult, args: celebrityNonConformingArgs, state: "output-available" },
};

// ============================================================================
// Radiant CRA
// ============================================================================

export const RadiantCRA: Story = {
  args: { result: radiantCraResult, args: radiantCraArgs, state: "output-available" },
};

// ============================================================================
// Radiant AU
// ============================================================================

export const RadiantAU: Story = {
  args: { result: radiantAuResult, args: radiantAuArgs, state: "output-available" },
};

// ============================================================================
// Shared states
// ============================================================================

export const Error: Story = {
  args: { result: errorResult, args: errorArgs, state: "output-available" },
};

export const Loading: Story = {
  args: { result: undefined, state: "input-streaming" },
};
