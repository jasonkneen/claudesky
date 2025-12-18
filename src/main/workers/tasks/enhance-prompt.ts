/**
 * Enhance Prompt Task Handler
 * Uses Claude Haiku for fast prompt enhancement
 */
import Anthropic from '@anthropic-ai/sdk';

import type { EnhancePromptPayload, EnhancePromptResult } from '../../../shared/types/worker';

const ENHANCEMENT_SYSTEM_PROMPT = `You are a prompt enhancement assistant. Your task is to improve user prompts to be clearer, more specific, and better structured while maintaining the original intent. Return only the enhanced prompt without any explanation or preamble.`;

const FAST_MODEL = 'claude-haiku-4-5-20251001';

export async function handleEnhancePrompt(
  payload: EnhancePromptPayload
): Promise<EnhancePromptResult> {
  const { prompt, env } = payload;

  if (!prompt?.trim()) {
    throw new Error('Please provide a prompt to enhance.');
  }

  // Use whatever auth is provided in env - handler already figured it out
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY || undefined,
    authToken: env.CLAUDE_CODE_OAUTH_TOKEN || undefined
  });

  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 1024,
    system: ENHANCEMENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const enhancedPrompt = response.content[0].type === 'text' ? response.content[0].text : null;

  if (!enhancedPrompt) {
    throw new Error('Failed to enhance prompt - no text response received.');
  }

  return { enhancedPrompt };
}
