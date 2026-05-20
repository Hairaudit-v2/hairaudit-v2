/** Shown in draft form fields until save; stripped before persisting review text. */
export const AI_INSERT_SOURCE_LABEL = "AI draft suggestion — faculty edited/confirmed";

const LABEL_LINE = `[${AI_INSERT_SOURCE_LABEL}]`;

export function wrapAiInsertText(text: string): string {
  const body = text.trim();
  if (!body) return "";
  if (body.includes(AI_INSERT_SOURCE_LABEL)) return body;
  return `${LABEL_LINE}\n${body}`;
}

export function appendAiInsertText(existing: string | null | undefined, incoming: string): string {
  const wrapped = wrapAiInsertText(incoming);
  if (!wrapped) return existing?.trim() ?? "";
  const prev = (existing ?? "").trim();
  if (!prev) return wrapped;
  return `${prev}\n\n${wrapped}`;
}

/** Remove AI source label lines before saving to the database (trainee-facing text stays clean). */
export function stripAiInsertLabels(text: string | null | undefined): string | null {
  if (text == null) return null;
  const lines = text.split("\n");
  const filtered = lines.filter((line) => !line.includes(AI_INSERT_SOURCE_LABEL));
  const out = filtered.join("\n").trim();
  return out || null;
}

export type AiInsertAuditEntry = {
  aiDraftId: string;
  sectionKey?: string;
  field?: string;
  action: string;
  at: string;
};

export function createAiInsertAuditEntry(
  aiDraftId: string,
  action: string,
  opts?: { sectionKey?: string; field?: string },
): AiInsertAuditEntry {
  return {
    aiDraftId,
    action,
    sectionKey: opts?.sectionKey,
    field: opts?.field,
    at: new Date().toISOString(),
  };
}

export type DraftDisplayState =
  | "ready"
  | "not_configured"
  | "no_images"
  | "failed"
  | "placeholder";

export function resolveAiDraftDisplayState(draft: {
  status: string;
  image_count: number;
  structured_feedback?: { placeholder?: boolean } | null;
  error_message?: string | null;
} | null): DraftDisplayState {
  if (!draft) return "ready";
  if (draft.status === "failed") return "failed";
  if (draft.structured_feedback?.placeholder) return "not_configured";
  if (draft.image_count === 0) return "no_images";
  return "ready";
}

export const CONFIDENCE_CAUTION_COPY = "Use with caution — image evidence may be limited.";
