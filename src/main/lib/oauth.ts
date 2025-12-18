import {
  AnthropicOAuthClient,
  type AuthMode,
  type OAuthTokens
} from '@anthropic-ai/anthropic-oauth';

import type { AppConfig } from './config';
import { loadConfig, saveConfig } from './config';

// Re-export types for convenience
export type { AuthMode, OAuthTokens };

// Create a singleton OAuth client instance
const oauthClient = new AnthropicOAuthClient();

/**
 * Start OAuth login flow
 * @param mode - Authentication mode ('max' or 'console')
 * @returns Authorization URL and PKCE verifier
 */
export async function startOAuthLogin(mode: AuthMode = 'console') {
  return oauthClient.startLogin(mode);
}

/**
 * Complete OAuth login by exchanging authorization code
 * @param code - Authorization code from OAuth callback
 * @param verifier - PKCE verifier from startOAuthLogin
 * @param state - State parameter from startOAuthLogin (for CSRF validation)
 * @param createKey - If true, create an API key instead of storing tokens
 * @returns OAuth tokens or API key
 */
export async function completeOAuthLogin(
  code: string,
  verifier: string,
  state: string,
  createKey = false
) {
  console.log('[oauth.ts] completeOAuthLogin called');
  console.log('[oauth.ts] code type:', typeof code, 'length:', code?.length);
  console.log('[oauth.ts] verifier type:', typeof verifier, 'length:', verifier?.length);
  console.log('[oauth.ts] state type:', typeof state, 'length:', state?.length);
  console.log('[oauth.ts] createKey:', createKey);

  // Double-check parameters before calling client
  if (!state || typeof state !== 'string' || state.length === 0) {
    console.error('[oauth.ts] Invalid state parameter:', { state, type: typeof state });
    throw new Error('State parameter is missing or invalid');
  }

  return oauthClient.completeLogin(code, verifier, state, createKey);
}

/**
 * Refresh access token using refresh token
 * @param refreshToken - Refresh token to use
 * @returns New OAuth tokens
 */
export async function refreshAccessToken(refreshToken: string) {
  return oauthClient.refreshAccessToken(refreshToken);
}

/**
 * Check if access token is expired or about to expire
 * @param tokens - OAuth tokens to check
 * @returns true if expired or will expire soon
 */
export function isTokenExpired(tokens: OAuthTokens): boolean {
  return oauthClient.isTokenExpired(tokens);
}

/**
 * Get a valid access token, refreshing if necessary
 * @param tokens - Current OAuth tokens
 * @returns Valid access token and optionally new tokens if refreshed
 */
export async function getValidAccessToken(tokens: OAuthTokens) {
  return oauthClient.getValidAccessToken(tokens);
}

/**
 * Save OAuth tokens to config
 */
export function saveOAuthTokens(tokens: OAuthTokens): void {
  const config: AppConfig = loadConfig();
  config.oauthTokens = tokens;
  saveConfig(config);
}

/**
 * Get OAuth tokens from config
 */
export function getOAuthTokens(): OAuthTokens | null {
  const config = loadConfig();
  return config.oauthTokens || null;
}

/**
 * Remove OAuth tokens from config
 */
export function clearOAuthTokens(): void {
  const config = loadConfig();
  delete config.oauthTokens;
  saveConfig(config);
}

/**
 * Get a valid access token from stored tokens, refreshing if necessary
 * @returns Valid access token or null if not authenticated
 */
export async function getStoredValidAccessToken(): Promise<string | null> {
  const tokens = getOAuthTokens();
  if (!tokens) {
    return null;
  }

  const result = await getValidAccessToken(tokens);

  // If tokens were refreshed, save them
  if (result.tokens) {
    saveOAuthTokens(result.tokens);
  }

  return result.accessToken;
}
