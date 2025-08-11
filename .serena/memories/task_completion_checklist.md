# Task Completion Checklist

When completing any development task in this project, follow this checklist:

## Code Quality Checks
1. **Type Check**: Run `npm run typecheck` to ensure no TypeScript errors
2. **Lint Check**: Run `npm run lint` to check for linting issues  
3. **Format Check**: Run `npm run format` to ensure consistent formatting
4. **Comprehensive Check**: Run `npm run check` for complete Biome analysis

## Testing
1. **Run Tests**: Execute `npm test` to run the full Playwright test suite
2. **Verify Browser Support**: Tests run on Chrome, Firefox, and Safari
3. **Check Integration**: Ensure integration tests pass if changes affect scraping logic

## Build Verification  
1. **Build Check**: Run `npm run build` to verify TypeScript compilation
2. **Runtime Test**: Optionally run `npm start` to test compiled output

## Pre-commit
- Pre-commit hooks automatically handle linting and formatting
- No manual intervention needed for staged files
- Hooks will prevent commits if issues exist

## Git Best Practices
- Write clear commit messages
- Make focused, atomic commits
- Test thoroughly before pushing

## Browser Dependencies
- Ensure `npx playwright install chromium` has been run if browser binaries are missing
- Consider browser compatibility for scraping targets

The pre-commit hooks provide a safety net, but running checks manually during development helps catch issues early.