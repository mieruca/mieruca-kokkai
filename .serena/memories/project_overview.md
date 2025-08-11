# Project Overview

## Purpose
Mieruca Kokkai is a Japanese Diet (parliament) members information scraper built with Playwright. The project specifically scrapes information about House of Representatives members from official government websites.

## Tech Stack
- **TypeScript** with `@tsconfig/strictest` for maximum type safety
- **Playwright** for web scraping and browser automation
- **Node.js** runtime with CommonJS modules
- **Biome** for linting and formatting (replaces ESLint/Prettier)
- **tsx** for TypeScript execution in development
- **husky** and **lint-staged** for pre-commit hooks

## Dependencies
- **Runtime**: `playwright`
- **Development**: 
  - `@playwright/test` for testing
  - `@biomejs/biome` for code quality
  - `tsx` for development execution
  - `typescript` for compilation
  - `@types/node` for Node.js types
  - `husky` and `lint-staged` for git hooks

## Project Structure
```
src/
├── index.ts                              # Main entry point
├── scraper.ts                           # Main scraper class
├── types.ts                             # Global types
├── constants.ts                         # Global constants
└── scrapers/
    └── house-of-representatives/
        ├── index.ts                     # Exports
        ├── scraper.ts                   # HouseOfRepresentativesScraper class
        ├── constants.ts                 # Scraper-specific constants
        └── types/
            └── index.ts                 # Type definitions

tests/                                   # Comprehensive test suite with 150+ tests
├── *.test.ts                           # Various test files
└── scrapers/house-of-representatives/  # Scraper-specific tests
```