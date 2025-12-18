import { ipcMain, shell } from 'electron';

import {
  clearOAuthTokens,
  completeOAuthLogin,
  getOAuthTokens,
  getStoredValidAccessToken,
  saveOAuthTokens,
  startOAuthLogin,
  type AuthMode
} from '../lib/oauth';

// Store PKCE verifier and state temporarily during OAuth flow
let currentPKCEVerifier: string | null = null;
let currentOAuthState: string | null = null;

export function registerOAuthHandlers(): void {
  // Start OAuth login flow
  ipcMain.handle('oauth:start-login', async (_event, mode: AuthMode) => {
    try {
      console.log('[OAuth] Starting login flow, mode:', mode);

      // Start OAuth flow
      const result = await startOAuthLogin(mode);

      console.log(
        '[OAuth] PKCE generated, verifier length:',
        result.verifier?.length,
        'state length:',
        result.state?.length
      );

      // Open the authorization URL in the default browser
      await shell.openExternal(result.authUrl);

      // Return verifier and state to renderer for storage
      // This survives main process hot reloads
      return {
        success: true,
        authUrl: result.authUrl,
        verifier: result.verifier,
        state: result.state
      };
    } catch (error) {
      console.error('[OAuth] Error starting OAuth login:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Complete OAuth login by exchanging code for tokens
  // Now accepts verifier and state from renderer (survives hot reloads)
  ipcMain.handle(
    'oauth:complete-login',
    async (_event, code: string, verifier: string, state: string, createKey = false) => {
      console.log('[OAuth] complete-login called');
      console.log('[OAuth] Code provided:', code ? `${code.substring(0, 10)}...` : 'null/empty');
      console.log(
        '[OAuth] Verifier provided:',
        verifier ? `length: ${verifier.length}` : 'null/empty'
      );
      console.log('[OAuth] State provided:', state ? `length: ${state.length}` : 'null/empty');
      console.log('[OAuth] createKey:', createKey);

      try {
        if (!verifier || !state) {
          console.log('[OAuth] Missing verifier or state');
          return {
            success: false,
            error:
              'No active OAuth flow. Please click Login to start the authorization process first.'
          };
        }

        if (!code) {
          console.log('[OAuth] Missing authorization code');
          return {
            success: false,
            error: 'Authorization code is required.'
          };
        }

        console.log('[OAuth] All parameters present, completing OAuth login...');

        // Complete OAuth login
        const result = await completeOAuthLogin(code, verifier, state, createKey);

        console.log('[OAuth] Login successful, has tokens:', !!result.tokens);

        // If creating an API key
        if (createKey && result.apiKey) {
          console.log(
            '[OAuth] API key created successfully, prefix:',
            result.apiKey.substring(0, 10)
          );
          currentPKCEVerifier = null;
          currentOAuthState = null;

          return {
            success: true,
            apiKey: result.apiKey,
            mode: 'api-key' as const
          };
        }

        // Save OAuth tokens
        console.log('[OAuth] Saving OAuth tokens (no API key mode)');
        saveOAuthTokens(result.tokens);

        // Clear the temporary verifier and state
        currentPKCEVerifier = null;
        currentOAuthState = null;

        return {
          success: true,
          mode: 'oauth' as const
        };
      } catch (error) {
        console.error('[OAuth] Error completing OAuth login:', error);
        currentPKCEVerifier = null;
        currentOAuthState = null;
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Cancel OAuth flow
  ipcMain.handle('oauth:cancel', () => {
    currentPKCEVerifier = null;
    currentOAuthState = null;
    return { success: true };
  });

  // Get OAuth status
  ipcMain.handle('oauth:get-status', () => {
    const tokens = getOAuthTokens();
    return {
      authenticated: !!tokens,
      expiresAt: tokens?.expires || null
    };
  });

  // Logout (clear OAuth tokens)
  ipcMain.handle('oauth:logout', () => {
    try {
      clearOAuthTokens();
      return { success: true };
    } catch (error) {
      console.error('Error during OAuth logout:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get valid access token (handles refresh if needed)
  ipcMain.handle('oauth:get-access-token', async () => {
    try {
      const accessToken = await getStoredValidAccessToken();
      return {
        success: !!accessToken,
        accessToken
      };
    } catch (error) {
      console.error('Error getting access token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}
