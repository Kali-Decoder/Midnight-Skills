export interface KnowledgeArticle {
  slug: string;
  title: string;
  description: string;
  body: string;
  kbMd: string;
  path: string;
  meta: {
    category: string;
    author: string;
    version: string;
    tags: string[];
  };
}
