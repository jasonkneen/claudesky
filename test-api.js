#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config
const configPath = path.join(process.env.HOME, 'Library/Application Support/claudesky/config.json');
console.log('Loading config from:', configPath);

let config;
try {
  const configContent = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(configContent);
  console.log('Config loaded successfully');
} catch (error) {
  console.error('Failed to load config:', error.message);
  process.exit(1);
}

// Get tokens
const tokens = config.oauthTokens;
if (!tokens) {
  console.error('No OAuth tokens found in config');
  process.exit(1);
}

console.log('\nOAuth Tokens:');
console.log('- Type:', tokens.type);
console.log('- Access token (first 50 chars):', tokens.access.substring(0, 50) + '...');
console.log('- Refresh token (first 50 chars):', tokens.refresh.substring(0, 50) + '...');
console.log('- Expires:', new Date(tokens.expires).toISOString());

// Check token expiration
const now = Date.now();
const isExpired = tokens.expires < now;
console.log('- Token expired:', isExpired);
if (!isExpired) {
  const msUntilExpiry = tokens.expires - now;
  const hoursUntilExpiry = msUntilExpiry / (1000 * 60 * 60);
  console.log('- Time until expiry:', hoursUntilExpiry.toFixed(2), 'hours');
}

// Test API call with the access token
console.log('\n[TEST] Attempting to call Anthropic API with OAuth token...');
console.log('[TEST] Using Bearer token from config');

const apiKey = tokens.access;
const testPayload = {
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  messages: [
    {
      role: 'user',
      content: 'Say "Hello from Claudesky" in one short sentence.'
    }
  ]
};

console.log('[TEST] Request payload:', JSON.stringify(testPayload, null, 2));

try {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(testPayload)
  });

  console.log('\n[RESPONSE] Status:', response.status, response.statusText);
  const responseText = await response.text();

  try {
    const responseBody = JSON.parse(responseText);
    console.log('[RESPONSE] Body:', JSON.stringify(responseBody, null, 2));

    if (response.ok) {
      console.log('\n✓ API is working! Response received successfully.');
      if (responseBody.content && responseBody.content[0]) {
        console.log('[RESPONSE] Message:', responseBody.content[0].text);
      }
    } else {
      console.log('\n✗ API returned an error.');
      console.log('[ERROR] Type:', responseBody.type);
      console.log('[ERROR] Message:', responseBody.message);
    }
  } catch (e) {
    console.log('[RESPONSE] Raw response:', responseText.substring(0, 500));
  }
} catch (error) {
  console.error('\n✗ Failed to call API:', error.message);
  if (error.cause) {
    console.error('[ERROR] Cause:', error.cause);
  }
  process.exit(1);
}
