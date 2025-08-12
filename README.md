# Mieruca Kokkai

Japanese Diet members information scraper using Playwright.

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
# Development mode (basic member data only)
npm run dev

# Development mode with profile scraping (limited to 10 profiles)
npm run dev -- --profiles

# Development mode with custom profile limit
npm run dev -- --profiles --max-profiles 25

# Build and run
npm run build
npm start

# Run with profiles in production
npm start -- --profiles --max-profiles 50
```

### Profile Scraping

The scraper now supports extracting detailed profile information from individual member pages, including:

- Birth date and place
- Education background
- Current and previous occupations
- Committee memberships
- Contact information (website, email, office details)
- Biography
- Additional metadata

Profile scraping is rate-limited and includes comprehensive error handling to ensure reliable operation.

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