import type { Template } from "@/lib/types";
import { requestJsonResult, type ClientApiResult } from "./http";

export type TemplateApiResult<T> = ClientApiResult<T>;

export function listTemplates(): Promise<
  TemplateApiResult<{ templates?: Template[] }>
> {
  return requestJsonResult("/api/templates");
}

export function saveTemplate(
  template: Template,
): Promise<TemplateApiResult<{ template?: Template }>> {
  return requestJsonResult("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template),
  });
}

export function deleteTemplate(
  id: string,
): Promise<TemplateApiResult<{ ok?: boolean }>> {
  return requestJsonResult(`/api/templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
