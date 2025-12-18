#!/bin/bash
export CLAUDE_CODE_OAUTH_TOKEN="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"
echo "Testing Claude CLI with OAuth token..."
echo "Say hello" | claude --print 2>&1
echo "Exit code: $?"
