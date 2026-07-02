export interface SkillProfile {
  slug: string;
  skillMd: string;
  readmeMd: string;
  meta: {
    name: string;
    description: string;
    category: string;
    difficulty: string;
    featured: boolean;
    templatePath?: string;
    taskHint?: string;
    skills: string[];
    author: string;
    version: string;
    allowedTools: string[];
  };
  body: string;
  rawPath: string;
  folderName: string;
}
