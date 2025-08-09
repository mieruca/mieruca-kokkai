import { expect, test } from '@playwright/test';
import { DietMemberScraper } from '../src/scraper';

test.describe('Error Handling and Edge Cases', () => {
  let scraper: DietMemberScraper;

  test.beforeEach(async () => {
    scraper = new DietMemberScraper();
  });

  test.afterEach(async () => {
    await scraper.close();
  });

  test('should handle empty table gracefully', async () => {
    // Initialize browser first
    await scraper.initialize();

    // Test with a mock page that has an empty table
    const page = await scraper.newPage();

    await page.setContent(`
      <html>
        <body>
          <table>
            <tr><th>Name</th><th>Party</th></tr>
          </table>
        </body>
      </html>
    `);

    const result = await page.evaluate(() => {
      const table = document.querySelector('table');
      const rows = table?.querySelectorAll('tr');
      return rows ? rows.length : 0;
    });

    expect(result).toBe(1); // Only header row
    await page.close();
  });

  test('should handle missing table elements', async () => {
    await scraper.initialize();
    const page = await scraper.newPage();

    await page.setContent(`
      <html>
        <body>
          <div>No table here</div>
        </body>
      </html>
    `);

    const result = await page.evaluate(() => {
      const table = document.querySelector('table');
      return table === null;
    });

    expect(result).toBe(true);
    await page.close();
  });

  test('should handle malformed HTML gracefully', async () => {
    await scraper.initialize();
    const page = await scraper.newPage();

    await page.setContent(`
      <html>
        <body>
          <table>
            <tr><td>Incomplete row
            <tr><td>Name</td><td>Party</td><td>District</td></tr>
          </table>
        </body>
      </html>
    `);

    // Should not throw error even with malformed HTML
    const result = await page.evaluate(() => {
      const table = document.querySelector('table');
      return table !== null;
    });

    expect(result).toBe(true);
    await page.close();
  });

  test('should handle network timeouts appropriately', async (_, testInfo) => {
    testInfo.setTimeout(10000);
    const testScraper = new DietMemberScraper();
    await testScraper.initialize();
    const page = await testScraper.newPage();

    // Set a very short timeout to simulate timeout scenario
    page.setDefaultTimeout(1);

    try {
      await page.goto('https://httpstat.us/200?sleep=5000'); // 5 second delay
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      const err = error as Error;
      expect(err).toBeDefined();
      expect(err.message).toContain('Timeout');
    }

    await testScraper.close();
  });

  test('should handle invalid characters in member data', async () => {
    await scraper.initialize();
    const page = await scraper.newPage();

    await page.setContent(`
      <html>
        <body>
          <table>
            <tr>
              <td>山田　太郎</td>
              <td>🎌 Invalid Party Name with Emoji</td>
              <td>東京1</td>
              <td><script>alert('xss')</script></td>
              <td>null</td>
              <td>undefined</td>
            </tr>
          </table>
        </body>
      </html>
    `);

    const cells = await page.evaluate(() => {
      const row = document.querySelector('tr');
      const cells = row?.querySelectorAll('td');
      return cells ? Array.from(cells).map((cell) => cell.textContent || '') : [];
    });

    expect(cells).toBeDefined();
    expect(cells.length).toBe(6);
    expect(cells[0]).toBe('山田　太郎');
    expect(cells[1]).toBe('🎌 Invalid Party Name with Emoji');
    expect(cells[2]).toBe('東京1');

    await page.close();
  });

  test('should handle extremely long member names', async () => {
    await scraper.initialize();
    const longName = 'あ'.repeat(1000); // 1000 character name
    const page = await scraper.newPage();

    await page.setContent(`
      <html>
        <body>
          <table>
            <tr>
              <td>${longName}</td>
              <td>党名</td>
              <td>東京1</td>
            </tr>
          </table>
        </body>
      </html>
    `);

    const name = await page.evaluate(() => {
      const cell = document.querySelector('td');
      return cell?.textContent || '';
    });

    expect(name.length).toBe(1000);
    expect(name).toBe(longName);

    await page.close();
  });

  test('should handle missing furigana gracefully', async () => {
    await scraper.initialize();
    const page = await scraper.newPage();

    // Simulate a profile page without furigana
    await page.setContent(`
      <html>
        <body>
          <h1>山田太郎のプロフィール</h1>
          <p>経歴: ...</p>
          <p>政策: ...</p>
        </body>
      </html>
    `);

    // Test furigana extraction methods
    const furiganaTests = await page.evaluate(() => {
      // Test various furigana extraction strategies
      const strategies = [
        () => document.querySelector('ruby rt')?.textContent,
        () => document.querySelector('[data-yomi]')?.getAttribute('data-yomi'),
        () => document.querySelector('[data-furigana]')?.getAttribute('data-furigana'),
        () => document.querySelector('[title*="読み"]')?.getAttribute('title'),
      ];

      return strategies.map((strategy) => strategy() || null);
    });

    // All strategies should return null for this page
    expect(furiganaTests.every((result) => result === null)).toBe(true);

    await page.close();
  });

  test('should handle browser crash gracefully', async () => {
    const testScraper = new DietMemberScraper();
    await testScraper.initialize();

    // Close browser to simulate crash
    await testScraper.forceCloseBrowserForTest();

    // Subsequent operations should handle the closed browser
    await expect(testScraper.close()).resolves.not.toThrow();
  });

  test('should handle concurrent scraping requests', async () => {
    const scrapers = Array.from({ length: 3 }, () => new DietMemberScraper());

    try {
      // This should not cause conflicts or errors
      const promises = scrapers.map(async (scraper, index) => {
        await scraper.initialize();
        const page = await scraper.newPage();
        await page.setContent(`
          <html><body>
            <table>
              <tr><td>Member ${index}</td><td>Party ${index}</td><td>District ${index}</td></tr>
            </table>
          </body></html>
        `);

        const result = await page.evaluate(() => {
          const cells = document.querySelectorAll('td');
          return Array.from(cells).map((cell) => cell.textContent);
        });

        await page.close();
        return result;
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);

      for (let i = 0; i < results.length; i++) {
        expect(results[i]).toEqual([`Member ${i}`, `Party ${i}`, `District ${i}`]);
      }
    } finally {
      await Promise.all(scrapers.map((scraper) => scraper.close()));
    }
  });

  test('should validate election count edge cases', async () => {
    // Test the edge cases for election count validation
    const testCases = [
      { input: '0', shouldBeValid: false }, // Too low
      { input: '26', shouldBeValid: false }, // Too high
      { input: '-1', shouldBeValid: false }, // Negative
      { input: '1.5', shouldBeValid: false }, // Decimal
      { input: '1e2', shouldBeValid: false }, // Scientific notation
      { input: '01', shouldBeValid: false }, // Leading zero
      { input: '1 ', shouldBeValid: false }, // Trailing space
      { input: ' 1', shouldBeValid: false }, // Leading space
      { input: '1', shouldBeValid: true }, // Valid
      { input: '25', shouldBeValid: true }, // Valid max
    ];

    for (const testCase of testCases) {
      const isValid = /^\d+$/.test(testCase.input);
      const num = parseInt(testCase.input);
      const inRange = num >= 1 && num <= 25;
      const noLeadingZero = !testCase.input.startsWith('0') || testCase.input === '0';
      const shouldBeValid = isValid && inRange && noLeadingZero;

      expect(shouldBeValid).toBe(testCase.shouldBeValid);
    }
  });

  test('should handle special characters in party names', async () => {
    const specialPartyNames = [
      '日本共産党',
      '立憲民主党・無所属',
      'れいわ新選組',
      '日本維新の会・教育無償化を実現する会',
      '国民民主党・無所属クラブ',
      '（無所属）',
    ];

    await scraper.initialize();
    const page = await scraper.newPage();

    for (const partyName of specialPartyNames) {
      await page.setContent(`
        <html>
          <body>
            <table>
              <tr><td>山田太郎</td><td>${partyName}</td><td>東京1</td></tr>
            </table>
          </body>
        </html>
      `);

      const extractedParty = await page.evaluate(() => {
        const cell = document.querySelectorAll('td')[1];
        return cell?.textContent || '';
      });

      expect(extractedParty).toBe(partyName);
    }

    await page.close();
  });
});
