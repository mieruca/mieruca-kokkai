# Mieruca Kokkai

Japanese Diet members information scraper using Playwright.

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
# Development mode (basic member data only) - DEFAULT
npm run dev basic

# Development mode with profile scraping (default: 10 profiles)
npm run dev profiles

# Development mode with custom profile limit
npm run dev profiles --max-profiles 25

# Development mode with ALL members' profiles (⚠️ WARNING: Takes 30+ minutes!)
npm run dev all-profiles

# Force refresh data (ignore cache)
npm run dev profiles --force-refresh

# Build and run
npm run build
npm start basic
npm start profiles

# Run with profiles in production
npm start profiles --max-profiles 50

# Run with ALL profiles in production (production use)
npm start all-profiles
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

### Available Scripts

- `basic`: Scrape basic member data only (name, party, election info)
- `profiles`: Scrape with detailed profiles (default: 10 members)
- `all-profiles`: Scrape ALL members with profiles (⚠️ **WARNING**: Takes 30+ minutes!)

### Options

- `--max-profiles N`: Limit profile scraping to N members (only for `profiles` script)
- `--force-refresh`: Ignore cache and fetch fresh data

### Script Aliases

- `all-profiles` = `profiles-all` = `all`

Profile scraping is rate-limited and includes comprehensive error handling to ensure reliable operation. The `all-profiles` script will scrape profiles for all ~465 House of Representatives members and may take 30+ minutes to complete.

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