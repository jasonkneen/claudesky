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
  console.log('- Time until expiry:', hoursUntilExpiry.toFixed(2), 'hours\n');
}

// Test using Claude Agent SDK CLI
console.log('[TEST] Testing Claude Agent SDK CLI with OAuth token...\n');

const prompt = 'Say "Hello from Claudesky API test" in one sentence.';
const cliPath =
  '/Users/jkneen/Documents/GitHub/flows/claudesky/node_modules/@anthropic-ai/claude-agent-sdk/cli.js';

if (!fs.existsSync(cliPath)) {
  console.error(`[ERROR] CLI not found at: ${cliPath}`);
  process.exit(1);
}

console.log(`[CLI] Using CLI from: ${cliPath}`);
console.log(`[CLI] Prompt: "${prompt}"\n`);

const env = {
  ...process.env,
  CLAUDE_CODE_OAUTH_TOKEN: tokens.access
};

try {
  console.log('[CLI] Running: node cli.js query --model claude-haiku-4-5-20251001');
  console.log('[CLI] With CLAUDE_CODE_OAUTH_TOKEN set from config\n');

  const output = execSync(
    `echo "${prompt}" | node "${cliPath}" query --model claude-haiku-4-5-20251001`,
    {
      env,
      encoding: 'utf-8',
      cwd: __dirname,
      maxBuffer: 10 * 1024 * 1024
    }
  );

  console.log('[RESPONSE] CLI Output:');
  console.log('─'.repeat(80));
  console.log(output);
  console.log('─'.repeat(80));
  console.log('\n✓ Claude Agent SDK API test successful!');
} catch (error) {
  console.error('\n[ERROR] Failed to run CLI');
  console.error('Exit code:', error.status);

  if (error.stdout) {
    console.log('\n[STDOUT]:\n', error.stdout.toString());
  }
  if (error.stderr) {
    console.log('\n[STDERR]:\n', error.stderr.toString());
  }

  process.exit(1);
}
