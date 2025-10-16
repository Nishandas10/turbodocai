export function selectDocTextForClassification(
  data: Record<string, any>
): string {
  const title = String(data.title || "").slice(0, 200);
  const summary = String(data.summary || "").slice(0, 4000);
  const processed = String(data.content?.processed || "").slice(0, 4000);
  const raw = String(data.content?.raw || "").slice(0, 4000);
  const meta = [data.type, data.metadata?.fileName, data.metadata?.mimeType]
    .filter(Boolean)
    .join(" ");
  const base = [title, summary, processed, raw, meta]
    .filter(Boolean)
    .join("\n");
  return base || title || meta || "";
}

export function mergeTags(existing: any, computed: string[]): string[] {
  const base = Array.isArray(existing) ? existing.map(String) : [];
  const set = new Set<string>(base);
  for (const t of computed) set.add(t);
  set.delete("uploaded");
  return Array.from(set);
}
