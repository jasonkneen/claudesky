// History management for sent messages per conversation

const HISTORY_STORAGE_PREFIX = 'chat-history-';
const MAX_HISTORY_PER_CONVERSATION = 500;
const INITIAL_PAGE_SIZE = 20;

export interface HistoryItem {
  id: string;
  text: string;
  timestamp: number;
}

function getHistoryKey(conversationId: string | null): string {
  const id = conversationId || 'global';
  return `${HISTORY_STORAGE_PREFIX}${id}`;
}

export function loadHistory(conversationId: string | null, limit?: number): HistoryItem[] {
  try {
    const key = getHistoryKey(conversationId);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const all = JSON.parse(stored);
    return limit ? all.slice(0, limit) : all;
  } catch {
    return [];
  }
}

export function loadMoreHistory(
  conversationId: string | null,
  offset: number,
  limit: number
): HistoryItem[] {
  try {
    const key = getHistoryKey(conversationId);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const all = JSON.parse(stored);
    return all.slice(offset, offset + limit);
  } catch {
    return [];
  }
}

export function getTotalHistoryCount(conversationId: string | null): number {
  try {
    const key = getHistoryKey(conversationId);
    const stored = localStorage.getItem(key);
    if (!stored) return 0;
    return JSON.parse(stored).length;
  } catch {
    return 0;
  }
}

export function saveToHistory(text: string, conversationId: string | null): void {
  if (!text.trim()) return;

  const history = loadHistory(conversationId);

  // Don't add duplicate of the last item
  if (history.length > 0 && history[0].text === text) {
    return;
  }

  const newItem: HistoryItem = {
    id: crypto.randomUUID?.() || `history-${Date.now()}`,
    text: text.trim(),
    timestamp: Date.now()
  };

  // Add to front and trim to max size
  const updated = [newItem, ...history].slice(0, MAX_HISTORY_PER_CONVERSATION);
  const key = getHistoryKey(conversationId);
  localStorage.setItem(key, JSON.stringify(updated));
}

export function fuzzySearchHistory(items: HistoryItem[], query: string): HistoryItem[] {
  if (!query.trim()) {
    return items;
  }

  const q = query.toLowerCase();
  return items
    .map((item) => ({
      item,
      score: calculateFuzzyScore(item.text.toLowerCase(), q)
    }))
    .filter(({ score }) => score > 0)
    .sort(({ score: a }, { score: b }) => b - a) // Higher score first
    .map(({ item }) => item);
}

export const INITIAL_LOAD_SIZE = INITIAL_PAGE_SIZE;

function calculateFuzzyScore(str: string, query: string): number {
  let score = 0;
  let queryIndex = 0;

  for (let i = 0; i < str.length && queryIndex < query.length; i++) {
    if (str[i] === query[queryIndex]) {
      // Bonus for match at start or after space
      if (i === 0 || str[i - 1] === ' ') {
        score += 10;
      } else {
        score += 5;
      }
      queryIndex++;
    }
  }

  // Only match if we found all characters of the query
  return queryIndex === query.length ? score : 0;
}
