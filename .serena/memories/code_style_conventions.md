# Code Style and Conventions

## TypeScript Configuration
- Uses `@tsconfig/strictest` for maximum type safety
- Target: ES2022 with CommonJS modules
- Strict typing enforced throughout codebase
- Declaration files and source maps generated

## Code Quality Tools
- **Biome** for linting and formatting (unified tool replacing ESLint/Prettier)
- Pre-commit hooks with husky and lint-staged
- Automatic formatting and linting on staged files

## Naming Conventions
- Classes: PascalCase (e.g., `HouseOfRepresentativesScraper`)
- Methods: camelCase (e.g., `extractMembersFromPage`)
- Properties: camelCase (e.g., `browser`, `ownsBrowser`)
- Constants: UPPER_SNAKE_CASE (imported from constants files)
- Files: kebab-case for test files (e.g., `scraper.test.ts`)

## Code Organization
- Modular structure with dedicated scrapers directory
- Separate types and constants files
- Clear separation between source (`src/`) and tests (`tests/`)
- Mirror directory structure in tests

## TypeScript Patterns
- Async/await for asynchronous operations
- Proper error handling with try/catch blocks
- Interface definitions for data structures
- Optional properties using `?` syntax
- Strict null checking enabled

## Testing Conventions
- Uses Playwright Test framework
- Comprehensive test coverage (150+ tests)
- Both unit and integration tests
- Test files mirror source structure
- Browser automation testing with multiple browsers (Chrome, Firefox, Safari)