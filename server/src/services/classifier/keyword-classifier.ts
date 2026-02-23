import type { ClassificationRule } from 'shared/src/types.js';

export interface ClassificationResult {
  categoryId: number | null;
  method: 'keyword' | 'ai' | 'manual' | null;
  matchedRule?: string;
}

export function classifyByKeyword(
  description: string,
  rules: ClassificationRule[]
): ClassificationResult {
  const normalized = description.trim().toLowerCase();

  // Rules should already be sorted by priority DESC
  for (const rule of rules) {
    if (rule.is_regex) {
      try {
        const regex = new RegExp(rule.keyword, 'i');
        if (regex.test(normalized)) {
          return {
            categoryId: rule.category_id,
            method: 'keyword',
            matchedRule: rule.keyword,
          };
        }
      } catch {
        // Invalid regex, skip
        continue;
      }
    } else {
      if (normalized.includes(rule.keyword.toLowerCase())) {
        return {
          categoryId: rule.category_id,
          method: 'keyword',
          matchedRule: rule.keyword,
        };
      }
    }
  }

  return { categoryId: null, method: null };
}
