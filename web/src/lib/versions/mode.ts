/**
 * Version mode used by hooks and ChatPageContent.
 * - undefined → editing version (Build page)
 * - "published" → published version (Chat page)
 * - { versionId: string } → specific version (Version chat)
 */
export type VersionMode = "published" | { versionId: string };
