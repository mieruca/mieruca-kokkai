# Suggested Commands

## Development Commands
- `npm run dev` - Run the scraper in development mode using tsx
- `npm run build` - Compile TypeScript to JavaScript (outputs to ./dist)
- `npm start` - Run the compiled JavaScript from dist/
- `npm run typecheck` - Type check both source and test files

## Code Quality Commands
- `npm run lint` - Lint source and test files with Biome
- `npm run format` - Format source and test files with Biome (--write)
- `npm run check` - Run comprehensive Biome checks (lint + format)

## Testing Commands  
- `npm test` - Run Playwright tests
- `npx playwright test` - Alternative way to run tests
- `npx playwright test --headed` - Run tests with browser visible
- `npx playwright test --debug` - Run tests in debug mode

## Setup Commands
- `npm install` - Install dependencies
- `npx playwright install chromium` - Install Playwright browser

## Git Hooks
The project automatically runs linting and formatting on staged files before commits using husky and lint-staged. No manual intervention needed.

## System Commands (Darwin/macOS)
- `git` - Git version control
- `ls` - List directory contents  
- `cd` - Change directory
- `grep` - Search text patterns
- `find` - Find files and directories