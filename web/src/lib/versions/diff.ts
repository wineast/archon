import type { AgentSnapshot } from "./types";

/* ═══════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════ */

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ResourceItemDiff {
  key: string;
  name: string;
  changes: FieldChange[];
}

export interface ResourceCategoryDiff {
  added: Array<{ key: string; name: string }>;
  removed: Array<{ key: string; name: string }>;
  modified: ResourceItemDiff[];
}

export interface SingletonDiff {
  status: "added" | "removed" | "modified" | "unchanged";
  changes: FieldChange[];
}

export interface SnapshotDiff {
  tools: ResourceCategoryDiff;
  functions: ResourceCategoryDiff;
  components: ResourceCategoryDiff;
  schemas: ResourceCategoryDiff;
  wikiDocuments: ResourceCategoryDiff;
  datasets: ResourceCategoryDiff;
  modelConfigs: ResourceCategoryDiff;
  evalCases: ResourceCategoryDiff;
  judgeConfigs: ResourceCategoryDiff;
  objectTypes: ResourceCategoryDiff;
  objectRelations: ResourceCategoryDiff;
  mcpServers: ResourceCategoryDiff;
  skills: ResourceCategoryDiff;
  resourceRefs: ResourceCategoryDiff;
  chatConfig: SingletonDiff;
  memoryConfig: SingletonDiff;
}

/** Summary for a single category in the overview */
export interface CategorySummary {
  label: string;
  key: keyof SnapshotDiff;
  added: number;
  removed: number;
  modified: number;
  hasChanges: boolean;
}

/* ═══════════════════════════════════════════════
   Deep equal (value comparison, skips functions)
   ═══════════════════════════════════════════════ */

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => Object.hasOwn(bObj, k) && deepEqual(aObj[k], bObj[k]));
}

/* ═══════════════════════════════════════════════
   Diff computation helpers
   ═══════════════════════════════════════════════ */

/** Fields to skip when comparing resources (too noisy / nested arrays) */
const SKIP_FIELDS = new Set(["testCases"]);

type KeyedItem = { key: string; name: string };

function diffArray<T extends KeyedItem>(
  fromItems: T[],
  toItems: T[]
): ResourceCategoryDiff {
  const fromMap = new Map(fromItems.map((item) => [item.key, item]));
  const toMap = new Map(toItems.map((item) => [item.key, item]));

  const added: Array<{ key: string; name: string }> = [];
  const removed: Array<{ key: string; name: string }> = [];
  const modified: ResourceItemDiff[] = [];

  // Find removed and modified
  for (const [key, fromItem] of fromMap) {
    const toItem = toMap.get(key);
    if (!toItem) {
      removed.push({ key, name: fromItem.name });
      continue;
    }
    // Compare fields
    const changes: FieldChange[] = [];
    const fromRec = fromItem as unknown as Record<string, unknown>;
    const toRec = toItem as unknown as Record<string, unknown>;
    const allFields = new Set([
      ...Object.keys(fromRec),
      ...Object.keys(toRec),
    ]);
    for (const field of allFields) {
      if (field === "key" || SKIP_FIELDS.has(field)) continue;
      const fromVal = fromRec[field];
      const toVal = toRec[field];
      if (!deepEqual(fromVal, toVal)) {
        changes.push({ field, from: fromVal, to: toVal });
      }
    }
    if (changes.length > 0) {
      modified.push({ key, name: toItem.name, changes });
    }
  }

  // Find added
  for (const [key, toItem] of toMap) {
    if (!fromMap.has(key)) {
      added.push({ key, name: toItem.name });
    }
  }

  return { added, removed, modified };
}

function diffSingleton(
  from: Record<string, unknown> | null,
  to: Record<string, unknown> | null
): SingletonDiff {
  if (!from && !to) return { status: "unchanged", changes: [] };
  if (!from && to) return { status: "added", changes: [] };
  if (from && !to) return { status: "removed", changes: [] };

  const changes: FieldChange[] = [];
  const allFields = new Set([
    ...Object.keys(from!),
    ...Object.keys(to!),
  ]);
  for (const field of allFields) {
    const fromVal = from![field];
    const toVal = to![field];
    if (!deepEqual(fromVal, toVal)) {
      changes.push({ field, from: fromVal, to: toVal });
    }
  }

  return {
    status: changes.length > 0 ? "modified" : "unchanged",
    changes,
  };
}

/* ═══════════════════════════════════════════════
   Main diff function
   ═══════════════════════════════════════════════ */

/**
 * Compute the diff between two AgentSnapshot objects.
 * `from` is the base (older), `to` is the target (newer).
 */
export function computeSnapshotDiff(
  from: AgentSnapshot,
  to: AgentSnapshot
): SnapshotDiff {
  // For resourceRefs, synthesize a "name" from resourceType + resourceKey
  const refsWithName = (refs: AgentSnapshot["resourceRefs"]) =>
    refs.map((r) => ({
      ...r,
      key: `${r.resourceType}:${r.resourceKey}`,
      name: `${r.resourceType}:${r.resourceKey}`,
    }));

  return {
    tools: diffArray(from.tools, to.tools),
    functions: diffArray(from.functions, to.functions),
    components: diffArray(from.components, to.components),
    schemas: diffArray(from.schemas, to.schemas),
    wikiDocuments: diffArray(from.wikiDocuments, to.wikiDocuments),
    datasets: diffArray(from.datasets, to.datasets),
    modelConfigs: diffArray(from.modelConfigs, to.modelConfigs),
    evalCases: diffArray(from.evalCases, to.evalCases),
    judgeConfigs: diffArray(from.judgeConfigs, to.judgeConfigs),
    objectTypes: diffArray(from.objectTypes, to.objectTypes),
    objectRelations: diffArray(from.objectRelations, to.objectRelations),
    mcpServers: diffArray(from.mcpServers, to.mcpServers),
    skills: diffArray(from.skills, to.skills),
    resourceRefs: diffArray(
      refsWithName(from.resourceRefs ?? []),
      refsWithName(to.resourceRefs ?? [])
    ),
    chatConfig: diffSingleton(
      from.chatConfig as Record<string, unknown> | null,
      to.chatConfig as Record<string, unknown> | null
    ),
    memoryConfig: diffSingleton(
      from.memoryConfig as Record<string, unknown> | null,
      to.memoryConfig as Record<string, unknown> | null
    ),
  };
}

/* ═══════════════════════════════════════════════
   Summary helpers (for overview layer)
   ═══════════════════════════════════════════════ */

const CATEGORY_LABELS: Array<{ key: keyof SnapshotDiff; label: string }> = [
  { key: "tools", label: "Tools" },
  { key: "functions", label: "Functions" },
  { key: "components", label: "Components" },
  { key: "schemas", label: "Schemas" },
  { key: "wikiDocuments", label: "Wiki" },
  { key: "datasets", label: "Datasets" },
  { key: "modelConfigs", label: "Models" },
  { key: "chatConfig", label: "Chat Config" },
  { key: "memoryConfig", label: "Memory Config" },
  { key: "evalCases", label: "Eval Cases" },
  { key: "judgeConfigs", label: "Judges" },
  { key: "objectTypes", label: "Object Types" },
  { key: "objectRelations", label: "Relations" },
  { key: "mcpServers", label: "MCP Servers" },
  { key: "skills", label: "Skills" },
  { key: "resourceRefs", label: "Resource Refs" },
];

export function buildDiffSummary(diff: SnapshotDiff): CategorySummary[] {
  return CATEGORY_LABELS.map(({ key, label }) => {
    const cat = diff[key];
    if ("added" in cat) {
      // ResourceCategoryDiff
      const d = cat as ResourceCategoryDiff;
      return {
        label,
        key,
        added: d.added.length,
        removed: d.removed.length,
        modified: d.modified.length,
        hasChanges:
          d.added.length > 0 || d.removed.length > 0 || d.modified.length > 0,
      };
    }
    // SingletonDiff
    const s = cat as SingletonDiff;
    return {
      label,
      key,
      added: s.status === "added" ? 1 : 0,
      removed: s.status === "removed" ? 1 : 0,
      modified: s.status === "modified" ? 1 : 0,
      hasChanges: s.status !== "unchanged",
    };
  });
}
