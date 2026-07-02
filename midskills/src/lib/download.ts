import JSZip from "jszip";

export async function downloadSkillZip(slug: string, skillMd: string, readmeMd: string) {
  const zip = new JSZip();
  const folder = zip.folder(slug)!;
  folder.file("SKILL.md", skillMd);
  if (readmeMd) folder.file("README.md", readmeMd);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
