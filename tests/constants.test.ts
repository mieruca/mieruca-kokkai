import { test, expect } from '@playwright/test';
import { PREFECTURES, SCRAPING_CONFIG } from '../src/constants';

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
    expect(SCRAPING_CONFIG).toHaveProperty('URLS');
    expect(SCRAPING_CONFIG).toHaveProperty('TIMEOUTS');

    expect(SCRAPING_CONFIG.URLS).toHaveProperty('HOUSE_OF_REPRESENTATIVES');
    expect(SCRAPING_CONFIG.TIMEOUTS).toHaveProperty('PAGE_LOAD');

    expect(typeof SCRAPING_CONFIG.URLS.HOUSE_OF_REPRESENTATIVES).toBe('string');
    expect(typeof SCRAPING_CONFIG.TIMEOUTS.PAGE_LOAD).toBe('number');
  });

  test('SCRAPING_CONFIG URLs should be valid', () => {
    const url = SCRAPING_CONFIG.URLS.HOUSE_OF_REPRESENTATIVES;
    
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toContain('shugiin.go.jp');
    expect(url).toContain('1giin.htm');
  });

  test('SCRAPING_CONFIG timeouts should be reasonable', () => {
    expect(SCRAPING_CONFIG.TIMEOUTS.PAGE_LOAD).toBeGreaterThan(0);
    expect(SCRAPING_CONFIG.TIMEOUTS.PAGE_LOAD).toBeLessThanOrEqual(30000); // <= 30 seconds for CI headroom
  });
});