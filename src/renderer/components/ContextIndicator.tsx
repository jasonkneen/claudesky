import { encodingForModel } from 'js-tiktoken';
import { useEffect, useState } from 'react';

import type { Message } from '@/types/chat';

import type { ChatModelPreference } from '../../shared/types/ipc';

interface ContextIndicatorProps {
  messages: Message[];
  modelPreference: ChatModelPreference;
}

interface TokenCounts {
  context: number;
  limit: number;
  percentage: number;
}

const MODEL_TOKEN_LIMITS: Record<ChatModelPreference, number> = {
  fast: 8000, // Claude 3.5 Haiku
  'smart-sonnet': 100000, // Claude 3.5 Sonnet
  'smart-opus': 200000 // Claude 3.5 Opus
};

const MODEL_NAMES: Record<ChatModelPreference, string> = {
  fast: 'Haiku',
  'smart-sonnet': 'Sonnet',
  'smart-opus': 'Opus'
};

function getModelId(preference: ChatModelPreference): string {
  switch (preference) {
    case 'fast':
      return 'claude-3-5-haiku-20241022';
    case 'smart-sonnet':
      return 'claude-3-5-sonnet-20241022';
    case 'smart-opus':
      return 'claude-3-opus-20250219';
    default:
      return 'claude-3-5-sonnet-20241022';
  }
}

function countTokens(text: string, modelId: string): number {
  try {
    const enc = encodingForModel(modelId as any);
    return enc.encode(text).length;
  } catch {
    // Fallback: rough estimate of 1 token per 4 characters
    return Math.ceil(text.length / 4);
  }
}

function calculateTokenCount(messages: Message[], modelId: string): number {
  let totalTokens = 0;

  // System prompt tokens (rough estimate)
  const systemPrompt =
    'You are Claude, an AI assistant made by Anthropic. You are helpful, harmless, and honest.';
  totalTokens += countTokens(systemPrompt, modelId);

  // Message tokens
  messages.forEach((message) => {
    const role = message.role === 'user' ? 'user' : 'assistant';
    totalTokens += countTokens(`${role}: ${message.content}`, modelId);

    // Add tokens for attachments
    if (message.attachments) {
      message.attachments.forEach((attachment) => {
        // Rough estimate: 100 tokens per attachment metadata
        totalTokens += countTokens(`[${attachment.name}]`, modelId) + 100;
      });
    }
  });

  // Add buffer for formatting (messages, separators, etc.)
  totalTokens += messages.length * 10;

  return totalTokens;
}

export default function ContextIndicator({ messages, modelPreference }: ContextIndicatorProps) {
  const [tokenCounts, setTokenCounts] = useState<TokenCounts>({
    context: 0,
    limit: MODEL_TOKEN_LIMITS[modelPreference],
    percentage: 0
  });

  useEffect(() => {
    const modelId = getModelId(modelPreference);
    const limit = MODEL_TOKEN_LIMITS[modelPreference];
    const context = calculateTokenCount(messages, modelId);
    const percentage = Math.min(100, Math.round((context / limit) * 100));

    setTokenCounts({
      context,
      limit,
      percentage
    });
  }, [messages, modelPreference]);

  const isHigh = tokenCounts.percentage > 80;
  const isCritical = tokenCounts.percentage > 95;

  const barColor =
    isCritical ? 'bg-red-500'
    : isHigh ? 'bg-yellow-500'
    : 'bg-blue-500';
  const textColor =
    isCritical ? 'text-red-600 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200/50 bg-neutral-50/50 px-3 py-2 dark:border-neutral-700/50 dark:bg-neutral-900/30">
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {MODEL_NAMES[modelPreference]}
          </span>
          <span className={`text-xs font-medium ${textColor}`}>
            {tokenCounts.context.toLocaleString()} / {tokenCounts.limit.toLocaleString()} tokens
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            className={`h-full transition-all duration-300 ${barColor}`}
            style={{ width: `${tokenCounts.percentage}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
          {tokenCounts.percentage}% used
        </div>
      </div>
    </div>
  );
}
