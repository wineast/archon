/**
 * Pricing Storybook mock data
 *
 * Uses the real pricing engine + product rules to generate realistic data
 */

import { runPricingSOPCore } from "@/lib/pricing/engine";
import type { SOPCoreInput } from "@/lib/pricing/engine";
import type { ProductPricingConfig } from "@/lib/pricing/types";
import type { PricingOutput } from "@/lib/pricing/output-types";
import { UNIVERSE_PRICING_CONFIG } from "@/lib/pricing/universe/rules";
import { OCEAN_PRICING_CONFIG } from "@/lib/pricing/ocean/rules";
import { HERMES_CA_PRICING_CONFIG } from "@/lib/pricing/hermes-ca/rules";
import { THUNDER_PRICING_CONFIG } from "@/lib/pricing/thunder/rules";
import { FABULOUS_PRICING_CONFIG } from "@/lib/pricing/fabulous/rules";
import { CELEBRITY_PRICING_CONFIG } from "@/lib/pricing/celebrity/rules";
import { RADIANT_CRA_PRICING_CONFIG } from "@/lib/pricing/radiant-cra/rules";
import { RADIANT_AU_PRICING_CONFIG } from "@/lib/pricing/radiant-au/rules";

// ============================================================================
// Helper: run engine and wrap as PricingOutput
// ============================================================================

function generatePricingOutput(
  config: ProductPricingConfig,
  fieldValues: Record<string, unknown>,
  overrides?: Partial<PricingOutput>
): PricingOutput {
  const input: SOPCoreInput = {
    baseRates: config.baseRates,
    adjustments: config.adjustments,
    llpaMatrices: config.llpaMatrices,
    stackingRules: config.stackingRules,
    extensionCosts: config.extensionCosts,
    fieldValues,
  };

  const result = runPricingSOPCore(input);
  const options = result.options ?? [];
  const bestOption = options.length > 0
    ? options.reduce((min, opt) => (opt.finalRate < min.finalRate ? opt : min))
    : null;

  const name = config.productName;

  return {
    success: result.success,
    productName: name,
    options: result.options,
    error: result.error,
    rateSheets: [...config.rateSheets],
    skippedAdjustments: result.skippedAdjustments,
    _uiRendered: true,
    _message: result.success
      ? options.length > 0
        ? `${name}: ${options.length} options. Best rate: ${bestOption!.finalRate.toFixed(3)}%`
        : `${name}: No options available`
      : `${name} Error: ${result.error}`,
    ...overrides,
  };
}

// ============================================================================
// Universe: Success with multiple categories (CA, high FICO)
// ============================================================================

export const successMultiCategoryArgs = {
  ficoScore: 750,
  state: "CA",
  isUniverseRefinance: false,
  docSigningLocation: "insideUS",
  hasShortSaleOrForeclosureWithin5Years: false,
};

export const successMultiCategoryResult = generatePricingOutput(
  UNIVERSE_PRICING_CONFIG,
  successMultiCategoryArgs,
);

// ============================================================================
// Universe: With adjustments triggered (low FICO + outside US signing)
// ============================================================================

export const withAdjustmentsArgs = {
  ficoScore: 650,
  state: "TX",
  isUniverseRefinance: false,
  docSigningLocation: "outsideUS",
  hasShortSaleOrForeclosureWithin5Years: true,
};

export const withAdjustmentsResult = generatePricingOutput(
  UNIVERSE_PRICING_CONFIG,
  withAdjustmentsArgs,
);

// ============================================================================
// Universe: NY Special rate
// ============================================================================

export const nySpecialArgs = { ficoScore: 720, state: "NY" };

export const nySpecialResult = generatePricingOutput(
  UNIVERSE_PRICING_CONFIG,
  nySpecialArgs,
);

// ============================================================================
// Universe: Skipped adjustments (partial fields)
// ============================================================================

export const skippedAdjustmentsArgs = { ficoScore: 700, state: "CA" };

export const skippedAdjustmentsResult = generatePricingOutput(
  UNIVERSE_PRICING_CONFIG,
  skippedAdjustmentsArgs,
);

// ============================================================================
// Universe: Error result
// ============================================================================

export const errorArgs = { ficoScore: 200, state: "CA" };

export const errorResult: PricingOutput = {
  success: false,
  productName: "Universe",
  error: "Invalid input: FICO score must be between 300 and 850",
  _uiRendered: true,
  _message: "Universe Error: Invalid input: FICO score must be between 300 and 850",
};

// ============================================================================
// Ocean: ARM product with adjustments
// ============================================================================

export const oceanArgs = {
  ficoScore: 720,
  ltv: 65,
  loanPurpose: "purchase",
  occupancy: "primary",
  propertyType: "sfr",
  units: 1,
  isForeignNational: false,
};

export const oceanResult = generatePricingOutput(
  OCEAN_PRICING_CONFIG,
  oceanArgs,
);

// ============================================================================
// Hermes CA: LLPA matrices + many adjustments
// ============================================================================

export const hermesCaArgs = {
  ficoScore: 740,
  ltv: 70,
  loanAmount: 1500000,
  loanPurpose: "purchase",
  occupancy: "primary",
  propertyType: "sfr",
  units: 1,
  hasADU: false,
  incomeDocType: "altDoc",
  isForeignNational: false,
};

export const hermesCaResult = generatePricingOutput(
  HERMES_CA_PRICING_CONFIG,
  hermesCaArgs,
);

// ============================================================================
// Thunder: Multi-program (Conforming + Jumbo, Fixed + ARM)
// ============================================================================

export const thunderArgs = {
  ficoScore: 760,
  ltv: 75,
  loanAmount: 500000,
  loanPurpose: "purchase",
  loanType: "fixed",
  loanTerm: 30,
  occupancy: "primary",
  propertyType: "sfr",
  hasSubordinateFinancing: false,
  isInterestOnly: false,
};

export const thunderResult = generatePricingOutput(
  THUNDER_PRICING_CONFIG,
  thunderArgs,
);

// ============================================================================
// Fabulous: Florida ARM product with LLPA
// ============================================================================

export const fabulousArgs = {
  ficoScore: 740,
  ltv: 70,
  loanAmount: 600000,
  loanPurpose: "purchase",
};

export const fabulousResult = generatePricingOutput(
  FABULOUS_PRICING_CONFIG,
  fabulousArgs,
);

// ============================================================================
// Celebrity: Conforming program (large, complex)
// ============================================================================

export const celebrityConformingArgs = {
  ficoScore: 740,
  ltv: 75,
  loanAmount: 500000,
  loanProgram: "conforming",
  loanPurpose: "purchase",
  loanType: "fixed",
  occupancy: "primary",
  propertyType: "sfr",
  propertyState: "CA",
  units: 1,
  hasSubordinateFinancing: false,
  escrowWaiver: false,
  isHighBalance: false,
  isLMIB: false,
  isLMIT: false,
  isMMCT: false,
  isInterestOnly: false,
};

export const celebrityConformingResult = generatePricingOutput(
  CELEBRITY_PRICING_CONFIG,
  celebrityConformingArgs,
);

// ============================================================================
// Celebrity: Non-Conforming ARM
// ============================================================================

export const celebrityNonConformingArgs = {
  ficoScore: 720,
  ltv: 70,
  loanAmount: 1200000,
  loanProgram: "nonConforming",
  loanPurpose: "purchase",
  loanType: "arm",
  occupancy: "primary",
  propertyType: "sfr",
  propertyState: "NC",
  units: 1,
  hasSubordinateFinancing: false,
  escrowWaiver: false,
  isHighBalance: false,
  isLMIB: false,
  isLMIT: false,
  isMMCT: false,
  isInterestOnly: false,
};

export const celebrityNonConformingResult = generatePricingOutput(
  CELEBRITY_PRICING_CONFIG,
  celebrityNonConformingArgs,
);

// ============================================================================
// Radiant CRA: Community lending with rate adjustments
// ============================================================================

export const radiantCraArgs = {
  ficoScore: 680,
  loanPurpose: "purchase",
  occupancy: "primary",
  propertyType: "sfr",
  units: 1,
  hasShortEmploymentHistory: false,
  hasNonTraditionalCreditDerogatories: false,
  hasException: false,
};

export const radiantCraResult = generatePricingOutput(
  RADIANT_CRA_PRICING_CONFIG,
  radiantCraArgs,
);

// ============================================================================
// Radiant AU: Asset utilization with stacking rules
// ============================================================================

export const radiantAuArgs = {
  ficoScore: 720,
  ltv: 55,
  loanPurpose: "purchase",
  occupancy: "primary",
  propertyType: "sfr",
  isNoFico: false,
  financedProperties: 0,
  reserveAdjustmentMonths: 0,
  waiveCdMonths: 0,
};

export const radiantAuResult = generatePricingOutput(
  RADIANT_AU_PRICING_CONFIG,
  radiantAuArgs,
);
