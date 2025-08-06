# Mieruca Kokkai

Japanese Diet members information scraper using Playwright.

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
# Development mode
npm run dev

# Build and run
npm run build
npm start
```

## Development Tools

This project uses:

- **TypeScript** with `@tsconfig/strictest` for maximum type safety
- **Biome** for fast linting and formatting
- **lint-staged** for pre-commit linting
- **husky** for Git hooks

### Available Scripts

- `npm run dev` - Run in development mode
- `npm run build` - Build TypeScript
- `npm run typecheck` - Type check only
- `npm run lint` - Lint code
- `npm run format` - Format code
- `npm run check` - Run Biome checks

### Pre-commit Hooks

The project automatically runs linting and formatting on staged files before each commit using husky and lint-staged.