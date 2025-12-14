# doula-auto-lint

Auto-linting plugin for the doula-cooperative project. Automatically runs appropriate lint:fix commands after editing TypeScript files.

## Overview

This plugin uses a prompt-based PostToolUse hook to intelligently detect when TypeScript files have been edited and runs the appropriate linting command based on the directory:

- `functions/*.ts` → `cd functions && bun run lint:fix`
- `members/*.ts` → `cd members && bun run lint:fix`
- Root `*.ts` → `bun run lint:fix`

## Features

- **Smart triggering**: Only runs when a logical chunk of work is complete (not during rapid iteration)
- **Directory-aware**: Detects which directory was modified and runs the correct lint command
- **Auto-fix**: Automatically fixes all lint errors
- **TypeScript-only**: Only triggers for `.ts` files, skips other file types

## Installation

This plugin is already installed in the project's `.claude-plugin/` directory. Claude Code will automatically discover and load it when you run `claude` or `cc` from the project root.

## Configuration

No configuration needed - the plugin is always active and project-specific.

## How It Works

1. After Claude edits or writes a `.ts` file, the PostToolUse hook triggers
2. Claude evaluates whether this is a logical stopping point
3. If yes, Claude determines the directory and runs the appropriate `bun run lint:fix` command
4. Any lint errors are automatically fixed
5. Results are reported in the conversation

## Troubleshooting

**Hook not triggering:**
- Restart Claude Code session (exit and run `claude` again)
- Check that you're editing `.ts` files (not `.js`, `.md`, etc.)
- Enable debug mode: `claude --debug` to see hook execution

**Lint command fails:**
- Ensure `bun` is installed and available in PATH
- Verify lint scripts exist in `package.json` for each directory
- Check that you're in the project root directory

## Development

**Testing changes:**
1. Edit `hooks/hooks.json`
2. Exit Claude Code session
3. Restart: `claude` or `cc`
4. Test by editing a `.ts` file

**Debug mode:**
```bash
claude --debug
```

Look for hook registration and execution logs.

## Version History

- **0.1.0** - Initial release with PostToolUse prompt-based hook
