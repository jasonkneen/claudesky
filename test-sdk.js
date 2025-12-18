#!/usr/bin/env node
import { execSync } from 'child_process';
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
  console.log('Config loaded successfully\n');
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

console.log('OAuth Token Status:');
console.log('- Type:', tokens.type);
console.log('- Access token exists:', !!tokens.access);
console.log('- Refresh token exists:', !!tokens.refresh);
console.log('- Expires:', new Date(tokens.expires).toISOString());

// Check token expiration
const now = Date.now();
const isExpired = tokens.expires < now;
console.log('- Token expired:', isExpired);
if (!isExpired) {
  const msUntilExpiry = tokens.expires - now;
  const hoursUntilExpiry = msUntilExpiry / (1000 * 60 * 60);
  console.log('- Time until expiry:', hoursUntilExpiry.toFixed(2), 'hours\n');
}

// Test using Claude Agent SDK CLI
console.log('[TEST] Testing Claude Agent SDK CLI with OAuth token...\n');

const prompt = 'Say "API working!" in one sentence.';
const env = {
  ...process.env,
  CLAUDE_CODE_OAUTH_TOKEN: tokens.access
};

try {
  console.log('[CLI] Running: claude code query --model claude-haiku-4-5-20251001');
  console.log('[CLI] With CLAUDE_CODE_OAUTH_TOKEN set from config\n');

  // Try to find claude-agent-sdk
  let claudeCli;
  try {
    // First try npm installed version
    claudeCli = require.resolve('@anthropic-ai/claude-agent-sdk/cli.js');
  } catch {
    // Try from node_modules
    claudeCli = 'claude-agent-sdk';
  }

  const output = execSync(
    `echo "${prompt}" | node ${claudeCli} query --model claude-haiku-4-5-20251001 2>&1`,
    {
      env,
      encoding: 'utf-8',
      cwd: __dirname
    }
  );

  console.log('[RESPONSE] CLI Output:');
  console.log(output);
  console.log('\n✓ Claude Agent SDK CLI test completed');
} catch (error) {
  console.error('\n[ERROR] Failed to run CLI:', error.message);
  if (error.stdout) {
    console.log('[STDOUT]:', error.stdout.toString());
  }
  if (error.stderr) {
    console.log('[STDERR]:', error.stderr.toString());
  }
  process.exit(1);
}
