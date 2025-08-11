import { expect, test } from '@playwright/test';
import { PREFECTURES, SCRAPING_CONFIG } from '../src/constants';
import { HOUSE_OF_REPRESENTATIVES_CONFIG } from '../src/scrapers/house-of-representatives';

test.describe('Constants', () => {
  test('PREFECTURES should contain all 47 Japanese prefectures', () => {
    // Test that we have exactly 47 prefectures
    expect(PREFECTURES).toHaveLength(47);

    // Test that all major prefectures are included
    expect(PREFECTURES).toContain('北海道');
    expect(PREFECTURES).toContain('東京');
    expect(PREFECTURES).toContain('大阪');
    expect(PREFECTURES).toContain('京都');
    expect(PREFECTURES).toContain('沖縄');

    // Test that prefectures are in geographical order (some key checks)
    const hokkaidoIndex = PREFECTURES.indexOf('北海道');
    const tokyoIndex = PREFECTURES.indexOf('東京');
    const osakaIndex = PREFECTURES.indexOf('大阪');
    const okinawaIndex = PREFECTURES.indexOf('沖縄');

    expect(hokkaidoIndex).toBe(0); // Hokkaido should be first
    expect(tokyoIndex).toBeLessThan(osakaIndex); // Tokyo should come before Osaka
    expect(okinawaIndex).toBe(PREFECTURES.length - 1); // Okinawa should be last
  });

  test('PREFECTURES should not contain duplicates', () => {
    const uniquePrefectures = Array.from(new Set(PREFECTURES));
    expect(uniquePrefectures).toHaveLength(PREFECTURES.length);
  });

  test('SCRAPING_CONFIG should have correct structure', () => {
    expect(SCRAPING_CONFIG).toHaveProperty('TIMEOUTS');
    expect(SCRAPING_CONFIG.TIMEOUTS).toHaveProperty('PAGE_LOAD');
    expect(typeof SCRAPING_CONFIG.TIMEOUTS.PAGE_LOAD).toBe('number');
  });

  test('HOUSE_OF_REPRESENTATIVES_CONFIG should have correct structure', () => {
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG).toHaveProperty('URLS');
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG).toHaveProperty('TIMEOUTS');
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG).toHaveProperty('SYLLABARY_NAMES');

    expect(HOUSE_OF_REPRESENTATIVES_CONFIG.URLS).toHaveProperty('BASE_URL');
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG.URLS).toHaveProperty('ALL_PAGES');
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG.TIMEOUTS).toHaveProperty('PAGE_LOAD');

    expect(typeof HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.BASE_URL).toBe('string');
    expect(Array.isArray(HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.ALL_PAGES)).toBe(true);
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.ALL_PAGES).toHaveLength(10);
    expect(Array.isArray(HOUSE_OF_REPRESENTATIVES_CONFIG.SYLLABARY_NAMES)).toBe(true);
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG.SYLLABARY_NAMES).toHaveLength(10);
    expect(typeof HOUSE_OF_REPRESENTATIVES_CONFIG.TIMEOUTS.PAGE_LOAD).toBe('number');
  });

  test('HOUSE_OF_REPRESENTATIVES_CONFIG URLs should be valid', () => {
    const baseUrl = HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.BASE_URL;

    expect(baseUrl).toMatch(/^https?:\/\//);
    expect(baseUrl).toContain('shugiin.go.jp');
    expect(baseUrl).toContain('1giin.htm');

    // BASE_URL should match the first page
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.BASE_URL).toBe(
      HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.ALL_PAGES[0]
    );

    // ALL_PAGES should be unique
    expect(new Set(HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.ALL_PAGES).size).toBe(
      HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.ALL_PAGES.length
    );

    // Names and pages should have 1:1 index mapping
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.ALL_PAGES.length).toBe(
      HOUSE_OF_REPRESENTATIVES_CONFIG.SYLLABARY_NAMES.length
    );

    // Test all pages
    for (const url of HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.ALL_PAGES) {
      expect(url).toMatch(/^https?:\/\//);
      expect(url).toContain('shugiin.go.jp');
      expect(url).toMatch(/\d+giin\.htm$/);
    }

    // Optional: verify mapping roughly matches the numeric suffix
    HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.ALL_PAGES.forEach((url, i) => {
      const match = url.match(/(\d+)giin\.htm$/);
      expect(match).not.toBeNull();
      // i: 0..9 should correspond to 1..10
      expect(Number(match?.[1])).toBe(i + 1);
    });
  });

  test('SCRAPING_CONFIG timeouts should be reasonable', () => {
    expect(SCRAPING_CONFIG.TIMEOUTS.PAGE_LOAD).toBeGreaterThan(0);
    expect(SCRAPING_CONFIG.TIMEOUTS.PAGE_LOAD).toBeLessThanOrEqual(30000); // <= 30 seconds for CI headroom
  });

  test('HOUSE_OF_REPRESENTATIVES_CONFIG timeouts should be reasonable', () => {
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG.TIMEOUTS.PAGE_LOAD).toBeGreaterThan(0);
    expect(HOUSE_OF_REPRESENTATIVES_CONFIG.TIMEOUTS.PAGE_LOAD).toBeLessThanOrEqual(30000); // <= 30 seconds for CI headroom
  });
});
