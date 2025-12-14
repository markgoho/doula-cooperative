#!/bin/bash

# Read hook input from stdin
input=$(cat)

# Extract file path from tool_input
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Skip if no file path or not a TypeScript file
if [ -z "$file_path" ] || [[ ! "$file_path" =~ \.ts$ ]]; then
  exit 0
fi

# Convert to relative path if absolute
if [[ "$file_path" == /* ]]; then
  file_path="${file_path#${CLAUDE_PROJECT_DIR}/}"
fi

# Determine which lint command to run based on directory
if [[ "$file_path" == functions/* ]]; then
  echo "🔍 Running ESLint on functions/..."
  (cd "${CLAUDE_PROJECT_DIR}/functions" && bun run lint 2>&1) || true
  echo "✅ Linted functions/"
elif [[ "$file_path" == members/* ]]; then
  echo "🔍 Running ESLint on members/..."
  (cd "${CLAUDE_PROJECT_DIR}/members" && bun run lint 2>&1) || true
  echo "✅ Linted members/"
elif [[ "$file_path" == *.ts ]]; then
  echo "🔍 Running ESLint on TypeScript files..."
  (cd "${CLAUDE_PROJECT_DIR}" && bun run lint 2>&1) || true
  echo "✅ Linted TypeScript files"
fi

exit 0
