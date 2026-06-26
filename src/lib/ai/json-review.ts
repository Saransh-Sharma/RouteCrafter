export type AiReviewChoice = "keep-current" | "use-ai" | "merge";

export interface AiReviewRow {
  path: string;
  currentValue: unknown;
  aiValue: unknown;
}

export function parseJsonValue(text: string): unknown | null {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function stringifyJsonValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function isEmptyJsonValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

export function defaultReviewChoice(row: AiReviewRow): AiReviewChoice {
  return isEmptyJsonValue(row.currentValue) ? "use-ai" : "keep-current";
}

export function initialReviewChoices(
  rows: AiReviewRow[],
): Record<string, AiReviewChoice> {
  return Object.fromEntries(
    rows.map((row) => [row.path, defaultReviewChoice(row)]),
  );
}

export function initialMergeValues(rows: AiReviewRow[]): Record<string, string> {
  return Object.fromEntries(
    rows.map((row) => [
      row.path,
      typeof row.currentValue === "string" && typeof row.aiValue === "string"
        ? [row.currentValue, row.aiValue].filter(Boolean).join("\n\n")
        : stringifyJsonValue(row.aiValue),
    ]),
  );
}

export function flattenJsonRows(
  ai: unknown,
  current: unknown,
  prefix = "",
): AiReviewRow[] {
  if (ai && typeof ai === "object" && !Array.isArray(ai)) {
    return Object.entries(ai as Record<string, unknown>).flatMap(([key, value]) =>
      flattenJsonRows(
        value,
        getJsonPath(current, key),
        prefix ? `${prefix}.${key}` : key,
      ),
    );
  }
  if (Array.isArray(ai)) {
    if (ai.every((item) => !item || typeof item !== "object")) {
      return [{ path: prefix, currentValue: getJsonPath(current, ""), aiValue: ai }];
    }
    return ai.flatMap((value, index) =>
      flattenJsonRows(
        value,
        getJsonPath(current, String(index)),
        `${prefix}.${index}`,
      ),
    );
  }
  return [{ path: prefix, currentValue: current, aiValue: ai }];
}

export function getJsonPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) return current[Number(part)];
    if (typeof current === "object") {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, value);
}

export function setJsonPath(target: unknown, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = target as Record<string, unknown> | unknown[];
  parts.forEach((part, index) => {
    const last = index === parts.length - 1;
    if (last) {
      if (Array.isArray(current)) current[Number(part)] = value;
      else current[part] = value;
      return;
    }
    const nextPart = parts[index + 1];
    const existing = Array.isArray(current)
      ? current[Number(part)]
      : current[part];
    const next =
      existing && typeof existing === "object"
        ? existing
        : /^\d+$/.test(nextPart)
          ? []
          : {};
    if (Array.isArray(current)) current[Number(part)] = next;
    else current[part] = next;
    current = next as Record<string, unknown> | unknown[];
  });
}

export function applyJsonReviewChoices({
  current,
  rows,
  choices,
  mergeValues,
}: {
  current: unknown;
  rows: AiReviewRow[];
  choices: Record<string, AiReviewChoice>;
  mergeValues: Record<string, string>;
}): unknown {
  const base = cloneJson(
    current && typeof current === "object" ? current : {},
  ) as Record<string, unknown>;
  for (const row of rows) {
    const choice = choices[row.path] ?? defaultReviewChoice(row);
    if (choice === "keep-current") continue;
    setJsonPath(
      base,
      row.path,
      choice === "merge" ? mergeValues[row.path] : row.aiValue,
    );
  }
  return base;
}
