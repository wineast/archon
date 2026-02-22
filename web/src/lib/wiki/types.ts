import type { ResourceOrigin } from "@/db/schema";

export interface WikiDocument {
  id: string;
  parentId: string | null;
  key: string;
  name: string;
  content: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  origin?: ResourceOrigin;
}
