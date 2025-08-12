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

# Development mode with ALL members' profiles (WARNING: Takes much longer!)
npm run dev -- --profiles --all

# Force refresh data (ignore cache)
npm run dev -- --profiles --force-refresh

# Build and run
npm run build
npm start

# Run with profiles in production
npm start -- --profiles --max-profiles 50

# Run with ALL profiles in production
npm start -- --profiles --all
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

### Profile Scraping Options

- `--profiles`: Enable profile scraping (default: 10 members)
- `--max-profiles N`: Limit scraping to N members
- `--all`: Scrape profiles for ALL members (⚠️ **WARNING**: This will take significantly longer!)
- `--force-refresh`: Ignore cache and fetch fresh data

Profile scraping is rate-limited and includes comprehensive error handling to ensure reliable operation. The `--all` option will scrape profiles for all ~465 House of Representatives members and may take 30+ minutes to complete.

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