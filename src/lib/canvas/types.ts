import type { ResourceType } from "@/lib/subjects";

export type CanvasResourceKind =
  | "file"
  | "external_link"
  | "canvas_internal"
  | "missing"
  | "unsupported";

export type CanvasInventoryItem = {
  /** Stable id within this scan (hash of path / href). */
  localId: string;
  kind: CanvasResourceKind;
  title: string;
  /** Path inside the archive when a file is present. */
  archivePath: string | null;
  /** External http(s) URL when applicable. */
  externalUrl: string | null;
  modulePath: string | null;
  suggestedResourceType: ResourceType;
  mimeHint: string | null;
  sizeBytes: number | null;
  /** Why skipped / inaccessible. */
  note: string | null;
};

export type CanvasScanResult = {
  courseTitle: string | null;
  format: "imscc" | "zip";
  items: CanvasInventoryItem[];
  warnings: string[];
  entryCount: number;
  uncompressedBytes: number;
};

export type CanvasClassification = {
  localId: string;
  topicId: string | null;
  confidence: "high" | "medium" | "low" | "none";
  explanation: string;
};

/** Existing subject topic (or subtopic) offered to Gemini for matching. */
export type TopicNodeForAi = {
  id: string;
  title: string;
  parentTitle: string | null;
};

export type CanvasReviewItem = CanvasInventoryItem & {
  selected: boolean;
  topicId: string | null;
  confidence: CanvasClassification["confidence"];
  explanation: string;
  renamedTitle: string;
  duplicateOfMaterialId: string | null;
};
