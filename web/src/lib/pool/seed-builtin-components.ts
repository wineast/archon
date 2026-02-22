import { components } from "@/db/schema";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import type { JsonSchema7 } from "@/lib/schemas/types";

type DbLike = PostgresJsDatabase<typeof schema>;

/** Metadata for a builtin UI component. */
interface BuiltinComponentMeta {
  key: string;
  name: string;
  description: string;
  componentInputSchema?: JsonSchema7;
}

/** The 4 builtin UI components available via `archon:ui`. */
const BUILTIN_COMPONENT_DEFS: BuiltinComponentMeta[] = [
  {
    key: "badge",
    name: "Badge",
    description: "Inline status indicator with multiple color variants.",
    componentInputSchema: {
      type: "object",
      properties: {
        children: { type: "string", description: "Badge content" },
        variant: {
          type: "string",
          enum: ["default", "secondary", "destructive", "outline", "ghost", "link"],
          description: "Visual style variant",
        },
        className: { type: "string", description: "Additional CSS classes" },
      },
    },
  },
  {
    key: "spinner",
    name: "Spinner",
    description: "Animated loading indicator with customizable size.",
    componentInputSchema: {
      type: "object",
      properties: {
        className: { type: "string", description: 'CSS classes for sizing (e.g. "size-8")' },
      },
    },
  },
  {
    key: "table",
    name: "Table",
    description:
      "Composite table components with responsive scrolling, hover states, and border styling.",
    componentInputSchema: {
      type: "object",
      properties: {
        children: { type: "string", description: "Table sub-components (TableHeader, TableBody, etc.)" },
        className: { type: "string", description: "Additional CSS classes" },
      },
    },
  },
  {
    key: "tooltip",
    name: "Tooltip",
    description:
      "Radix-based tooltip with smooth animation, configurable placement, and arrow indicator.",
    componentInputSchema: {
      type: "object",
      properties: {
        children: { type: "string", description: "TooltipTrigger + TooltipContent" },
        delayDuration: { type: "number", description: "Delay before showing (ms)", default: 200 },
      },
    },
  },
];

/**
 * Ensure all builtin UI components exist as pool resources
 * (agentId = NULL, origin = "builtin").
 * Idempotent — uses onConflictDoNothing.
 */
export async function ensureBuiltinPoolComponents(db: DbLike): Promise<void> {
  const rows = BUILTIN_COMPONENT_DEFS.map((def) => ({
    agentId: null as unknown as undefined,
    key: def.key,
    name: def.name,
    description: def.description,
    componentSource: "",
    generatedCss: "",
    componentInputSchema: def.componentInputSchema ?? null,
    origin: "builtin" as const,
  }));

  if (rows.length > 0) {
    await db.insert(components).values(rows).onConflictDoNothing();
  }
}

/** Exported for testing. */
export { BUILTIN_COMPONENT_DEFS };
