import { expect, test } from '@playwright/test';
import { HouseOfRepresentativesScraper } from '../../../src/scrapers/house-of-representatives';

test.describe('HouseOfRepresentativesScraper', () => {
  let scraper: HouseOfRepresentativesScraper;

  test.beforeEach(async () => {
    scraper = new HouseOfRepresentativesScraper();
    await scraper.initialize();
  });

  test.afterEach(async () => {
    await scraper.close();
  });

  test('should initialize and close properly', async () => {
    // Test is covered by beforeEach and afterEach
    expect(scraper).toBeDefined();
  });

  test('should scrape members successfully', async () => {
    test.slow(); // Mark as slow test
    const result = await scraper.scrapeAllPages();

    // Basic validation
    expect(result).toBeDefined();
    expect(result.members).toBeDefined();
    expect(Array.isArray(result.members)).toBe(true);
    expect(result.members.length).toBeGreaterThan(400);
    expect(result.source).toBe('house-of-representatives-list');

    // Validate member structure
    const firstMember = result.members[0];
    if (firstMember) {
      expect(typeof firstMember.name).toBe('string');
      expect(firstMember.name.length).toBeGreaterThan(0);
      expect(typeof firstMember.party).toBe('string');
      expect(firstMember.party.length).toBeGreaterThan(0);
      expect(firstMember.election).toBeDefined();
      expect(['single-seat', 'proportional-representation']).toContain(firstMember.election.system);
    }
  });
});
