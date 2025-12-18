/**
 * Simple file-based auth storage for the CLI example
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { OAuthTokens } from '@anthropic-ai/anthropic-oauth';

const AUTH_FILE = path.join(os.homedir(), '.claude-agent-auth.json');

export interface StoredAuth {
  type: 'api-key' | 'oauth';
  apiKey?: string;
  oauthTokens?: OAuthTokens;
}

export function loadAuth(): StoredAuth | null {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const data = fs.readFileSync(AUTH_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load auth:', error);
  }
  return null;
}

export function saveAuth(auth: StoredAuth): void {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save auth:', error);
  }
}

export function clearAuth(): void {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
    }
  } catch (error) {
    console.error('Failed to clear auth:', error);
  }
}
