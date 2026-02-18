import { nanoid } from "nanoid";
import { toast } from "sonner";
import type { KeyedMutator } from "swr";
import { resolveTitle } from "./frontmatter";
import type { WikiDocument } from "./types";

export const WIKI_API_KEY = "/api/wiki";

export const wikiFetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to load documents");
    return res.json() as Promise<WikiDocument[]>;
  });

export async function createDocument(
  docs: WikiDocument[],
  mutate: KeyedMutator<WikiDocument[]>
): Promise<string | null> {
  const id = nanoid();
  const now = Date.now();
  const order =
    docs.length === 0 ? 0 : Math.max(...docs.map((d) => d.order)) + 1;
  const doc: WikiDocument = {
    id,
    title: "Untitled",
    content: "",
    order,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const res = await fetch("/api/wiki", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content: "", order }),
    });
    if (!res.ok) throw new Error("Failed to create document");
    await mutate([...docs, doc], { revalidate: false });
    return id;
  } catch (e) {
    console.error("createDocument failed:", e);
    toast.error("Failed to create document");
    return null;
  }
}

export async function updateDocument(
  id: string,
  updates: { content: string },
  docs: WikiDocument[],
  mutate: KeyedMutator<WikiDocument[]>
): Promise<boolean> {
  try {
    const res = await fetch(`/api/wiki/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update document");
    await mutate(
      docs.map((d) =>
        d.id === id
          ? { ...d, ...updates, title: resolveTitle(updates.content), updatedAt: Date.now() }
          : d
      ),
      { revalidate: false }
    );
    return true;
  } catch (e) {
    console.error("updateDocument failed:", e);
    toast.error("Failed to save document");
    return false;
  }
}

export async function deleteDocument(
  id: string,
  docs: WikiDocument[],
  mutate: KeyedMutator<WikiDocument[]>
): Promise<boolean> {
  try {
    const res = await fetch(`/api/wiki/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete document");
    await mutate(
      docs.filter((d) => d.id !== id),
      { revalidate: false }
    );
    return true;
  } catch (e) {
    console.error("deleteDocument failed:", e);
    toast.error("Failed to delete document");
    return false;
  }
}

export async function reorderDocument(
  id: string,
  direction: "up" | "down",
  docs: WikiDocument[],
  mutate: KeyedMutator<WikiDocument[]>
): Promise<void> {
  const sorted = [...docs].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((d) => d.id === id);
  if (idx < 0) return;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return;

  const doc = sorted[idx];
  const swapDoc = sorted[swapIdx];

  try {
    const res = await fetch("/api/wiki/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [
          { id: doc.id, order: swapDoc.order },
          { id: swapDoc.id, order: doc.order },
        ],
      }),
    });
    if (!res.ok) throw new Error("Failed to reorder document");
    await mutate(
      docs.map((d) => {
        if (d.id === doc.id) return { ...d, order: swapDoc.order };
        if (d.id === swapDoc.id) return { ...d, order: doc.order };
        return d;
      }),
      { revalidate: false }
    );
  } catch (e) {
    console.error("reorderDocument failed:", e);
    toast.error("Failed to reorder document");
  }
}
