#!/bin/bash

# Ensure nvm is loaded
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Optionally specify a Node version (uncomment and set if needed)
# nvm use 18

# Run the Playwright MCP server
npx @playwright/mcp@latest --vision