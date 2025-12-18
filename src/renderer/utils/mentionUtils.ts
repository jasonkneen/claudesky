/**
 * Utilities for @ mention detection and processing
 */

export interface Mention {
  id: string;
  type: 'file';
  label: string;
  value: string; // filepath
}

/**
 * Detect if we're at a mention trigger point
 * Returns the trigger character, query text, and position if found
 */
export function detectMentionTrigger(
  text: string,
  cursorPos: number
): { trigger: '@' | '/'; query: string; start: number } | null {
  if (cursorPos === 0) return null;

  // Look backwards from cursor to find @ or /
  let i = cursorPos - 1;

  // Skip any word characters
  while (i >= 0 && /[a-zA-Z0-9._\-/\\]/.test(text[i])) {
    i--;
  }

  // Check if we found @ or /
  if (i >= 0 && (text[i] === '@' || text[i] === '/')) {
    const trigger = text[i] as '@' | '/';
    const query = text.slice(i + 1, cursorPos);

    // Only show if we're at the trigger or have reasonable query length
    if (query.length === 0 || /^[a-zA-Z0-9._\-/\\]*$/.test(query)) {
      return { trigger, query, start: i };
    }
  }

  return null;
}

/**
 * Calculate popover position based on textarea rect and cursor position
 */
export function calculatePopoverPosition(
  textareaRect: DOMRect,
  cursorPos: number,
  textContent: string
): { top: number; left: number } {
  // Estimate cursor position within textarea
  // Get text up to cursor and measure its width
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { top: textareaRect.bottom + 8, left: textareaRect.left };
  }

  // Get computed style from textarea
  const textarea = document.querySelector('textarea');
  if (!textarea) {
    return { top: textareaRect.bottom + 8, left: textareaRect.left };
  }

  const style = window.getComputedStyle(textarea);
  ctx.font = `${style.fontSize} ${style.fontFamily}`;

  const textBeforeCursor = textContent.substring(0, cursorPos);
  const lastLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
  const lastLine = textBeforeCursor.substring(lastLineStart);

  const metrics = ctx.measureText(lastLine);
  const estimatedLeft = textareaRect.left + parseInt(style.paddingLeft) + metrics.width;
  const estimatedTop = textareaRect.bottom + 8;

  return { top: estimatedTop, left: Math.max(textareaRect.left, estimatedLeft) };
}

/**
 * Fuzzy filter items by query
 */
export function fuzzyFilter<T>(items: T[], query: string, getLabel: (item: T) => string): T[] {
  if (!query) return items;

  const queryLower = query.toLowerCase();
  const scored = items
    .map((item) => {
      const label = getLabel(item).toLowerCase();
      const score = calculateFuzzyScore(label, queryLower);
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ item }) => item);
}

/**
 * Simple fuzzy score calculation
 * Higher score = better match
 */
function calculateFuzzyScore(str: string, query: string): number {
  let score = 0;
  let queryIdx = 0;
  let consecutiveMatches = 0;

  for (let i = 0; i < str.length && queryIdx < query.length; i++) {
    if (str[i] === query[queryIdx]) {
      score += 10 + consecutiveMatches;
      consecutiveMatches++;
      queryIdx++;
    } else {
      consecutiveMatches = 0;
    }
  }

  // Bonus for query at start
  if (str.startsWith(query)) {
    score += 50;
  }

  return queryIdx === query.length ? score : 0;
}

/**
 * Remove mention from text and return cleaned text
 */
export function removeMentionFromText(text: string, mentionStart: number): string {
  // Find the @ or / character
  let i = mentionStart;
  while (i < text.length && /[a-zA-Z0-9._\-/\\]/.test(text[i])) {
    i++;
  }
  return text.slice(0, mentionStart) + text.slice(i);
}
