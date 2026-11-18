/**
 * Fuzzy search utilities — supports partial matches, subsequence matching,
 * and multi-word queries. Typo-tolerant via subsequence fallback.
 */

/**
 * Check if query fuzzy-matches a single target string.
 * - Exact substring match always passes
 * - Multi-word: each word must match as substring or subsequence in target
 * - Single word: subsequence match (chars in order, not necessarily consecutive)
 */
export function fuzzyMatch(query, target) {
  if (!query || !target) return true;
  const q = String(query).toLowerCase().trim();
  const t = String(target).toLowerCase();
  if (!q) return true;
  if (t.includes(q)) return true;

  const qWords = q.split(/\s+/).filter(w => w.length > 0);
  return qWords.every(word => {
    if (t.includes(word)) return true;
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < word.length; ti++) {
      if (t[ti] === word[qi]) qi++;
    }
    return qi === word.length;
  });
}

/**
 * Fuzzy match against multiple target fields — true if ANY field matches.
 */
export function fuzzyMatchAny(query, ...targets) {
  if (!query) return true;
  return targets.some(t => fuzzyMatch(query, t));
}

/**
 * Fuzzy relevance score for ranking — higher is better, 0 = no match.
 */
export function fuzzyScore(query, target) {
  if (!query || !target) return 0;
  const q = String(query).toLowerCase().trim();
  const t = String(target).toLowerCase();
  if (!q) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 500;
  const idx = t.indexOf(q);
  if (idx >= 0) return 300 - idx;

  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      consecutive++;
      score += consecutive > 1 ? consecutive * 2 : 1;
      qi++;
    } else {
      consecutive = 0;
    }
  }
  return qi === q.length ? score : 0;
}