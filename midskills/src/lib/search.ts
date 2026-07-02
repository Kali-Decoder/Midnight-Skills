export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return q.length / t.length + 1;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? qi / q.length : 0;
}

export function bestMatch(query: string, items: { name: string; slug: string }[]): string | null {
  let best: { name: string; score: number } | null = null;
  for (const item of items) {
    const score = fuzzyScore(query, item.name);
    if (score > 0 && (!best || score > best.score)) {
      best = { name: item.name, score };
    }
  }
  return best?.name ?? null;
}
