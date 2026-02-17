/**
 * Pricing tool implementation.
 *
 * Wraps lib/pricing engine for use as a registered tool.
 * Each product config registers its own executor under a key like "pricing_universe".
 */

import { registerTool } from "./_registry";
import { createPricingExecute } from "@/lib/pricing";

// Universe
import {
  UNIVERSE_PRICING_CONFIG,
  UNIVERSE_REQUIRED_FIELDS,
} from "@/lib/pricing/universe/rules";

const universeFieldKeys = Object.keys(UNIVERSE_REQUIRED_FIELDS);
registerTool(
  "pricing_universe",
  createPricingExecute(UNIVERSE_PRICING_CONFIG, universeFieldKeys),
);

// Ocean
import {
  OCEAN_PRICING_CONFIG,
  OCEAN_REQUIRED_FIELDS,
} from "@/lib/pricing/ocean/rules";

const oceanFieldKeys = Object.keys(OCEAN_REQUIRED_FIELDS);
registerTool(
  "pricing_ocean",
  createPricingExecute(OCEAN_PRICING_CONFIG, oceanFieldKeys),
);

// Hermes (CA)
import {
  HERMES_CA_PRICING_CONFIG,
  HERMES_CA_REQUIRED_FIELDS,
} from "@/lib/pricing/hermes-ca/rules";

const hermesCaFieldKeys = Object.keys(HERMES_CA_REQUIRED_FIELDS);
registerTool(
  "pricing_hermes_ca",
  createPricingExecute(HERMES_CA_PRICING_CONFIG, hermesCaFieldKeys),
);

// Hermes (Non-CA)
import {
  HERMES_NON_CA_PRICING_CONFIG,
  HERMES_NON_CA_REQUIRED_FIELDS,
} from "@/lib/pricing/hermes-non-ca/rules";

const hermesNonCaFieldKeys = Object.keys(HERMES_NON_CA_REQUIRED_FIELDS);
registerTool(
  "pricing_hermes_non_ca",
  createPricingExecute(HERMES_NON_CA_PRICING_CONFIG, hermesNonCaFieldKeys),
);

// Thunder
import {
  THUNDER_PRICING_CONFIG,
  THUNDER_REQUIRED_FIELDS,
} from "@/lib/pricing/thunder/rules";

const thunderFieldKeys = Object.keys(THUNDER_REQUIRED_FIELDS);
registerTool(
  "pricing_thunder",
  createPricingExecute(THUNDER_PRICING_CONFIG, thunderFieldKeys),
);

// Fabulous
import {
  FABULOUS_PRICING_CONFIG,
  FABULOUS_REQUIRED_FIELDS,
} from "@/lib/pricing/fabulous/rules";

const fabulousFieldKeys = Object.keys(FABULOUS_REQUIRED_FIELDS);
registerTool(
  "pricing_fabulous",
  createPricingExecute(FABULOUS_PRICING_CONFIG, fabulousFieldKeys),
);

// Celebrity
import {
  CELEBRITY_PRICING_CONFIG,
  CELEBRITY_REQUIRED_FIELDS,
} from "@/lib/pricing/celebrity/rules";

const celebrityFieldKeys = Object.keys(CELEBRITY_REQUIRED_FIELDS);
registerTool(
  "pricing_celebrity",
  createPricingExecute(CELEBRITY_PRICING_CONFIG, celebrityFieldKeys),
);

// Radiant CRA
import {
  RADIANT_CRA_PRICING_CONFIG,
  RADIANT_CRA_REQUIRED_FIELDS,
} from "@/lib/pricing/radiant-cra/rules";

const radiantCraFieldKeys = Object.keys(RADIANT_CRA_REQUIRED_FIELDS);
registerTool(
  "pricing_radiant_cra",
  createPricingExecute(RADIANT_CRA_PRICING_CONFIG, radiantCraFieldKeys),
);

// Radiant Portfolio
import {
  RADIANT_PORTFOLIO_PRICING_CONFIG,
  RADIANT_PORTFOLIO_REQUIRED_FIELDS,
} from "@/lib/pricing/radiant-portfolio/rules";

const radiantPortfolioFieldKeys = Object.keys(RADIANT_PORTFOLIO_REQUIRED_FIELDS);
registerTool(
  "pricing_radiant_portfolio",
  createPricingExecute(RADIANT_PORTFOLIO_PRICING_CONFIG, radiantPortfolioFieldKeys),
);

// Radiant AU
import {
  RADIANT_AU_PRICING_CONFIG,
  RADIANT_AU_REQUIRED_FIELDS,
} from "@/lib/pricing/radiant-au/rules";

const radiantAuFieldKeys = Object.keys(RADIANT_AU_REQUIRED_FIELDS);
registerTool(
  "pricing_radiant_au",
  createPricingExecute(RADIANT_AU_PRICING_CONFIG, radiantAuFieldKeys),
);
