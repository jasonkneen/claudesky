/**
 * Utility Session - Simple one-shot Claude calls for side tasks
 * like prompt enhancement that don't need to go through the main chat.
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { createRequire } from 'module';

import { buildClaudeSessionEnv, getApiKey, getWorkspaceDir } from './config';
import { getStoredValidAccessToken } from './oauth';

const requireModule = createRequire(import.meta.url);

function resolveClaudeCodeCli(): string {
  const cliPath = requireModule.resolve('@anthropic-ai/claude-agent-sdk/cli.js');
  if (cliPath.includes('app.asar')) {
    const unpackedPath = cliPath.replace('app.asar', 'app.asar.unpacked');
    if (existsSync(unpackedPath)) {
      return unpackedPath;
    }
  }
  return cliPath;
}

const ENHANCE_INSTRUCTION = `USE NO TOOLS, READ ONLY, BE DIRECT AND CONCISE --- You are a Developer + Multi-Agent Prompt Enhancer; transform any prompt I give you into a precise, unambiguous, production-ready version optimized for software development AND multi-agent orchestration; preserve my intent while adding structure, resolving implicit steps, defining goals/inputs/outputs/constraints, specifying agent roles and responsibilities, enforcing deterministic formatting, adding JSON/YAML schemas when needed, clarifying message-passing rules, defining tool boundaries, preventing hallucinations, and making the result directly executable and copy-paste ready; output only the enhanced prompt here is the prompt`;

/**
 * Enhance a prompt using a one-shot Claude CLI call
 */
export async function enhancePrompt(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  const oauthToken = !apiKey ? await getStoredValidAccessToken() : null;

  if (!apiKey && !oauthToken) {
    throw new Error('Please configure an API key or login with OAuth.');
  }

  const env = buildClaudeSessionEnv();
  if (apiKey) {
    env.ANTHROPIC_API_KEY = apiKey;
  } else if (oauthToken) {
    env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
    delete env.ANTHROPIC_API_KEY;
  }

  const cliPath = resolveClaudeCodeCli();
  const fullPrompt = `${ENHANCE_INSTRUCTION} '<PROMPT>${prompt}</PROMPT>'`;

  return new Promise((resolve, reject) => {
    const args = [
      cliPath,
      '--model',
      'claude-haiku-4-5-20251001',
      '--setting-sources',
      'local',
      '--permission-mode',
      'bypassPermissions',
      '-p',
      fullPrompt
    ];

    console.log(
      '[utility-session] Running:',
      'bun',
      args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')
    );
    console.log('[utility-session] cwd:', getWorkspaceDir());

    const proc = spawn('bun', args, {
      cwd: getWorkspaceDir(),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    let resolved = false;

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.log(
          '[utility-session] TIMEOUT - killing process, output so far:',
          output.length,
          'chars'
        );
        proc.kill();
        resolved = true;
        resolve(output.trim() || 'Enhancement timed out');
      }
    }, 30000);

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      console.log('[utility-session] stdout chunk:', chunk.length, 'chars');
      output += chunk;
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      console.log('[utility-session] stderr chunk:', chunk.length, 'chars');
      output += chunk;
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (!resolved) {
        console.log('[utility-session] exit code:', code, 'output length:', output.length);
        resolved = true;
        resolve(output.trim());
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (!resolved) {
        console.log('[utility-session] error:', err.message);
        resolved = true;
        reject(err);
      }
    });
  });
}
