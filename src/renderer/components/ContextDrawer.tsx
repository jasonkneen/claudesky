import { encodingForModel } from 'js-tiktoken';
import { ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Message } from '@/types/chat';

import type { ChatModelPreference } from '../../shared/types/ipc';

interface ContextDrawerProps {
  messages: Message[];
  modelPreference: ChatModelPreference;
}

interface TokenCounts {
  context: number;
  limit: number;
  percentage: number;
}

const MODEL_TOKEN_LIMITS: Record<ChatModelPreference, number> = {
  fast: 8000,
  'smart-sonnet': 100000,
  'smart-opus': 200000
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
    return Math.ceil(text.length / 4);
  }
}

function calculateTokenCount(messages: Message[], modelId: string): number {
  let totalTokens = 0;

  const systemPrompt =
    'You are Claude, an AI assistant made by Anthropic. You are helpful, harmless, and honest.';
  totalTokens += countTokens(systemPrompt, modelId);

  messages.forEach((message) => {
    const role = message.role === 'user' ? 'user' : 'assistant';
    totalTokens += countTokens(`${role}: ${message.content}`, modelId);

    if (message.attachments) {
      message.attachments.forEach((attachment) => {
        totalTokens += countTokens(`[${attachment.name}]`, modelId) + 100;
      });
    }
  });

  totalTokens += messages.length * 10;

  return totalTokens;
}

export default function ContextDrawer({ messages, modelPreference }: ContextDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
    <div
      className="w-full overflow-hidden transition-all duration-300 ease-out"
      style={{
        maxHeight: isExpanded ? '384px' : '56px'
      }}
    >
      <div className="flex w-full flex-col bg-gradient-to-b from-neutral-800 to-neutral-900 dark:from-neutral-800 dark:to-neutral-900">
        {/* Expanded content - shows when drawer is open */}
        <div
          className={`overflow-y-auto px-4 py-4 transition-opacity duration-300 ${
            isExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-100">Token Usage</span>
              <span className="text-sm font-semibold text-neutral-100">
                {MODEL_NAMES[modelPreference]}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-300">Context Size</span>
                <span className={`text-xs font-medium ${textColor}`}>
                  {tokenCounts.context.toLocaleString()} / {tokenCounts.limit.toLocaleString()}{' '}
                  tokens
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-neutral-700">
                <div
                  className={`h-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${tokenCounts.percentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Usage</span>
                <span className={`text-xs font-semibold ${textColor}`}>
                  {tokenCounts.percentage}%
                </span>
              </div>
            </div>

            {isCritical && (
              <div className="mt-3 rounded-md bg-red-500/20 p-2 text-xs text-red-300">
                ⚠️ Context window critically full. Consider clearing some messages.
              </div>
            )}
            {isHigh && !isCritical && (
              <div className="mt-3 rounded-md bg-yellow-500/20 p-2 text-xs text-yellow-300">
                ⚠️ Context window is {tokenCounts.percentage}% full
              </div>
            )}
          </div>
        </div>

        {/* Collapsed bar - always visible, clickable, pinned at bottom */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full shrink-0 items-center justify-between px-4 py-3 transition-colors hover:bg-neutral-700 dark:hover:bg-neutral-700"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-neutral-100">
              {MODEL_NAMES[modelPreference]}
            </span>
            <div className="flex h-2 w-24 overflow-hidden rounded-full bg-neutral-700">
              <div
                className={`transition-all duration-300 ${barColor}`}
                style={{ width: `${tokenCounts.percentage}%` }}
              />
            </div>
            <span className={`text-xs font-medium ${textColor}`}>{tokenCounts.percentage}%</span>
          </div>

          <ChevronUp
            className={`h-4 w-4 text-neutral-400 transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>
    </div>
  );
}
