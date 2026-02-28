import { migration0002 } from "./0002_normalize_optional_fields";

export interface ExportMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}

export const CURRENT_EXPORT_VERSION = 2;

const migrations: ExportMigration[] = [migration0002];

// Validate migration chain completeness at module load time
(function validateMigrationChain() {
  for (let i = 0; i < migrations.length; i++) {
    const m = migrations[i];
    const expectedFrom = i + 1; // first migration: from=1
    const expectedTo = i + 2;   // first migration: to=2
    if (m.fromVersion !== expectedFrom || m.toVersion !== expectedTo) {
      throw new Error(
        `Migration chain broken: expected migration from ${expectedFrom} to ${expectedTo}, ` +
          `got from ${m.fromVersion} to ${m.toVersion}`
      );
    }
  }
  const lastTo = migrations.length > 0 ? migrations[migrations.length - 1].toVersion : 1;
  if (lastTo !== CURRENT_EXPORT_VERSION) {
    throw new Error(
      `Migration chain incomplete: last migration reaches v${lastTo}, ` +
        `but CURRENT_EXPORT_VERSION is ${CURRENT_EXPORT_VERSION}`
    );
  }
})();

/**
 * Migrate export data from its current version to CURRENT_EXPORT_VERSION.
 * Returns a deep-cloned copy; the original is not mutated.
 */
export function migrateExportData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const version = data.exportVersion as number;
  if (version === CURRENT_EXPORT_VERSION) return data;

  // Deep clone to avoid mutating the original
  const cloned = structuredClone(data);

  let current = version;
  for (const m of migrations) {
    if (m.fromVersion === current) {
      m.migrate(cloned);
      current = m.toVersion;
    }
    if (current === CURRENT_EXPORT_VERSION) break;
  }

  cloned.exportVersion = CURRENT_EXPORT_VERSION;
  return cloned;
}
