import { describe, it, expect } from "vitest";
import wikiFixture from "./fixtures/wiki-agent.json";
import type { AgentExportData, AgentSnapshot, WikiDocumentSnapshotItem } from "../types";
import { validateExportData } from "../types";

const exportData = wikiFixture as unknown as AgentExportData;
const snapshot = exportData.versions[0].snapshot;
const wikiDocs = snapshot.wikiDocuments as WikiDocumentSnapshotItem[];

describe("wiki fixture — structure", () => {
  it("is valid AgentExportData", () => {
    expect(validateExportData(exportData)).toBe(true);
  });

  it("has 3 wiki documents", () => {
    expect(wikiDocs).toHaveLength(3);
  });

  it("each document has required fields", () => {
    for (const doc of wikiDocs) {
      expect(doc).toHaveProperty("key");
      expect(doc).toHaveProperty("name");
      expect(doc).toHaveProperty("content");
      expect(typeof doc.order).toBe("number");
      expect("parentKey" in doc).toBe(true);
    }
  });
});

describe("wiki fixture — hierarchy", () => {
  it("has one root document (parentKey === null)", () => {
    const roots = wikiDocs.filter((d) => d.parentKey === null);
    expect(roots).toHaveLength(1);
    expect(roots[0].key).toBe("getting-started");
  });

  it("child parentKey references exist in the document set", () => {
    const keys = new Set(wikiDocs.map((d) => d.key));
    for (const doc of wikiDocs) {
      if (doc.parentKey !== null) {
        expect(keys.has(doc.parentKey)).toBe(true);
      }
    }
  });
});

describe("wiki fixture — key uniqueness", () => {
  it("all keys are unique", () => {
    const keys = wikiDocs.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("wiki fixture — JSON round-trip", () => {
  it("preserves wiki data through stringify/parse", () => {
    const parsed = JSON.parse(JSON.stringify(snapshot)) as AgentSnapshot;
    expect(parsed.wikiDocuments).toEqual(snapshot.wikiDocuments);
  });
});

describe("wiki — backward compatibility", () => {
  it("optional chaining safely skips missing wikiDocuments", () => {
    // Simulate an old snapshot that lacks the wikiDocuments field
    const oldSnapshot = { ...snapshot } as Record<string, unknown>;
    delete oldSnapshot.wikiDocuments;

    // This is the exact pattern used in restoreSnapshot after the fix
    const hasWiki = (oldSnapshot as unknown as AgentSnapshot).wikiDocuments?.length;
    expect(hasWiki).toBeFalsy();
  });

  it("optional chaining works when wikiDocuments is undefined", () => {
    const partial = { wikiDocuments: undefined } as unknown as AgentSnapshot;
    expect(partial.wikiDocuments?.length).toBeUndefined();
  });

  it("optional chaining works when wikiDocuments is empty array", () => {
    const empty = { wikiDocuments: [] } as unknown as AgentSnapshot;
    expect(empty.wikiDocuments?.length).toBe(0);
    // The truthy check (used in restoreSnapshot) should skip empty arrays too
    expect(!!empty.wikiDocuments?.length).toBe(false);
  });
});
