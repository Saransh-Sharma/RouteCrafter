import type { Project } from "@/lib/types";

/** Render the five image prompts as a Markdown document. */
export function exportImagePromptsMarkdown(project: Project): string {
  const country = project.country || "Country";
  const header = `# ${country} — Portfolio Image Prompts\n\n_Five listing visuals for the ${project.name}._\n`;

  const sections = project.imagePrompts.map((p, i) => {
    return [
      `## ${i + 1}. ${p.title}${p.isFinal ? " ✅" : ""}`,
      `**Goal:** ${p.goal}`,
      `**Canvas:** ${p.canvas}`,
      `**Layout:** ${p.layout}`,
      `**Visual Elements:** ${p.visualElements}`,
      `**Text Overlay:**\n\n${p.textOverlay}`,
      `**Style:** ${p.style}`,
      `**Negative Prompt:** ${p.negativePrompt}`,
      `**Country Accuracy Notes:** ${p.countryAccuracyNotes}`,
      `**Readability Notes:** ${p.readabilityNotes}`,
    ].join("\n\n");
  });

  return [header, ...sections].join("\n\n---\n\n");
}

/** Trigger a browser download of the Markdown export. */
export function downloadImagePromptsMarkdown(project: Project): void {
  const md = exportImagePromptsMarkdown(project);
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(project.country || "project").toLowerCase()}-image-prompts.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
