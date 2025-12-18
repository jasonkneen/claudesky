import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load config
const configPath = path.join(process.env.HOME, 'Library/Application Support/claudesky/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const token = config.oauthTokens.access;

console.log('Token exists:', Boolean(token));
console.log('Token prefix:', token.substring(0, 20) + '...');

// Test SDK directly
const cliPath = path.join(__dirname, 'node_modules/@anthropic-ai/claude-agent-sdk/cli.js');
console.log('CLI path:', cliPath);
console.log('CLI exists:', fs.existsSync(cliPath));

// Try running
try {
  console.log('\nRunning SDK test...\n');
  const result = execSync(
    `echo "Say hello in one word" | node "${cliPath}" query --model claude-haiku-4-5-20251001 --print`,
    {
      env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: token },
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024
    }
  );
  console.log('SUCCESS! Response:');
  console.log(result.toString().substring(0, 1000));
} catch (e) {
  console.log('ERROR:', e.message);
  if (e.stdout) console.log('STDOUT:', e.stdout.toString().substring(0, 1000));
  if (e.stderr) console.log('STDERR:', e.stderr.toString().substring(0, 1000));
}
