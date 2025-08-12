import { expect, test } from '@playwright/test';
import { HouseOfRepresentativesScraper } from '../src/scrapers/house-of-representatives/scraper';
import type { MemberProfile } from '../src/scrapers/house-of-representatives/types';

test.describe('Profile Scraping', () => {
  let scraper: HouseOfRepresentativesScraper;

  test.beforeEach(async () => {
    scraper = new HouseOfRepresentativesScraper();
    await scraper.initialize();
  });

  test.afterEach(async () => {
    await scraper.close();
  });

  test('should handle invalid profile URLs gracefully', async () => {
    const result = await scraper.scrapeProfile('https://invalid-url.example.com');
    expect(result).toBeNull();
  });

  test('should handle empty or null profile URLs', async () => {
    const result1 = await scraper.scrapeProfile('');
    // @ts-expect-error Testing invalid input
    const result2 = await scraper.scrapeProfile(null);
    // @ts-expect-error Testing invalid input
    const result3 = await scraper.scrapeProfile(undefined);

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(result3).toBeNull();
  });

  test('should handle 404 errors gracefully', async () => {
    const invalidUrl =
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/nonexistent.htm';
    const result = await scraper.scrapeProfile(invalidUrl);
    expect(result).toBeNull();
  });

  test('extractProfileFromPage should return null for empty page', async () => {
    const page = await scraper.newPage();
    await page.setContent('<html><body></body></html>');

    // @ts-expect-error Accessing private method for testing
    const profile = await scraper.extractProfileFromPage(page);
    expect(profile).toBeNull();

    await page.close();
  });

  test('extractProfileFromPage should extract basic profile data from table', async () => {
    const page = await scraper.newPage();
    await page.setContent(`
      <html>
        <body>
          <table>
            <tr>
              <td>生年月日</td>
              <td>昭和45年3月15日</td>
            </tr>
            <tr>
              <td>出身地</td>
              <td>東京都</td>
            </tr>
            <tr>
              <td>学歴</td>
              <td>東京大学法学部卒業</td>
            </tr>
            <tr>
              <td>職業</td>
              <td>弁護士</td>
            </tr>
          </table>
        </body>
      </html>
    `);

    // @ts-expect-error Accessing private method for testing
    const profile = await scraper.extractProfileFromPage(page);
    expect(profile).not.toBeNull();
    expect(profile?.birthDate).toBe('昭和45年3月15日');
    expect(profile?.birthPlace).toBe('東京都');
    expect(profile?.education).toBe('東京大学法学部卒業');
    expect(profile?.occupation).toBe('弁護士');

    await page.close();
  });

  test('extractProfileFromPage should extract data from definition lists', async () => {
    const page = await scraper.newPage();
    await page.setContent(`
      <html>
        <body>
          <dl>
            <dt>生年月日</dt>
            <dd>令和2年5月10日</dd>
            <dt>委員会</dt>
            <dd>法務委員会、予算委員会</dd>
            <dt>事務所住所</dt>
            <dd>東京都千代田区永田町1-1-1</dd>
          </dl>
        </body>
      </html>
    `);

    // @ts-expect-error Accessing private method for testing
    const profile = await scraper.extractProfileFromPage(page);
    expect(profile).not.toBeNull();
    expect(profile?.birthDate).toBe('令和2年5月10日');
    expect(profile?.committees).toEqual(['法務委員会', '予算委員会']);
    expect(profile?.office?.address).toBe('東京都千代田区永田町1-1-1');

    await page.close();
  });

  test('extractProfileFromPage should extract website and email links', async () => {
    const page = await scraper.newPage();
    await page.setContent(`
      <html>
        <body>
          <a href="https://example.com">公式ウェブサイト</a>
          <a href="mailto:member@example.com">メール</a>
          <table>
            <tr><td>氏名</td><td>テスト議員</td></tr>
          </table>
        </body>
      </html>
    `);

    // @ts-expect-error Accessing private method for testing
    const profile = await scraper.extractProfileFromPage(page);
    expect(profile).not.toBeNull();
    expect(profile?.website).toBe('https://example.com');
    expect(profile?.email).toBe('member@example.com');

    await page.close();
  });

  test('extractProfileFromPage should extract biography from paragraphs', async () => {
    const page = await scraper.newPage();
    await page.setContent(`
      <html>
        <body>
          <table>
            <tr><td>氏名</td><td>テスト議員</td></tr>
          </table>
          <p>これは短いテキスト</p>
          <p>議員としての長い経歴があります。多くの法案に携わり、国民のために尽力してきました。これからも頑張ります。</p>
          <p>さらに詳しい経歴情報があります。地元での活動も含めて、幅広い分野で活動しています。</p>
        </body>
      </html>
    `);

    // @ts-expect-error Accessing private method for testing
    const profile = await scraper.extractProfileFromPage(page);
    expect(profile).not.toBeNull();
    expect(profile?.biography).toBeDefined();
    expect(profile?.biography?.length).toBeGreaterThan(50);

    await page.close();
  });

  test('extractProfileFromPage should handle mixed content types', async () => {
    const page = await scraper.newPage();
    await page.setContent(`
      <html>
        <body>
          <table>
            <tr><td>生年月日</td><td>平成10年12月1日</td></tr>
            <tr><td>前職</td><td>記者、教師、会社員</td></tr>
          </table>
          <dl>
            <dt>電話</dt>
            <dd>03-1234-5678</dd>
            <dt>FAX</dt>
            <dd>03-1234-5679</dd>
          </dl>
          <a href="https://member-site.com">個人サイト</a>
        </body>
      </html>
    `);

    // @ts-expect-error Accessing private method for testing
    const profile = await scraper.extractProfileFromPage(page);
    expect(profile).not.toBeNull();
    expect(profile?.birthDate).toBe('平成10年12月1日');
    expect(profile?.previousOccupation).toEqual(['記者', '教師', '会社員']);
    expect(profile?.office?.phone).toBe('03-1234-5678');
    expect(profile?.office?.fax).toBe('03-1234-5679');
    expect(profile?.website).toBe('https://member-site.com');

    await page.close();
  });

  test('scrapeMultipleProfiles should handle empty member list', async () => {
    await expect(scraper.scrapeMultipleProfiles([])).resolves.not.toThrow();
  });

  test('scrapeMultipleProfiles should handle members without profile URLs', async () => {
    const members = [
      {
        name: 'テスト議員1',
        party: '自由民主党',
        election: { system: 'single-seat' as const, prefecture: '東京都', number: '1' },
      },
      {
        name: 'テスト議員2',
        party: '立憲民主党',
        election: { system: 'single-seat' as const, prefecture: '大阪府', number: '2' },
      },
    ];

    await expect(scraper.scrapeMultipleProfiles(members)).resolves.not.toThrow();
    expect(members.every((m) => !('profile' in m) || !m.profile)).toBe(true);
  });

  test('scrapeMultipleProfiles should respect rate limiting options', async () => {
    const members = [
      {
        name: 'テスト議員1',
        party: '自由民主党',
        profileUrl: 'https://invalid1.example.com',
        election: { system: 'single-seat' as const, prefecture: '東京都', number: '1' },
      },
      {
        name: 'テスト議員2',
        party: '立憲民主党',
        profileUrl: 'https://invalid2.example.com',
        election: { system: 'single-seat' as const, prefecture: '大阪府', number: '2' },
      },
    ];

    const startTime = Date.now();
    await scraper.scrapeMultipleProfiles(members, {
      maxConcurrent: 1,
      delay: 500,
    });
    const endTime = Date.now();

    // Should take at least 500ms due to delay
    expect(endTime - startTime).toBeGreaterThan(400);
  });

  test('scrapeHouseOfRepresentativesWithProfiles should work with includeProfiles=false', async () => {
    // Mock scrapeAllPages to return test data
    const mockResult = {
      members: [
        {
          name: 'テスト議員',
          party: '自由民主党',
          election: { system: 'single-seat' as const, prefecture: '東京都', number: '1' },
          profileUrl: 'https://example.com/profile',
        },
      ],
      scrapedAt: new Date().toISOString(),
      source: 'house-of-representatives-list' as const,
    };

    // @ts-expect-error Mocking method for testing
    scraper.scrapeAllPages = () => Promise.resolve(mockResult);

    const result = await scraper.scrapeHouseOfRepresentativesWithProfiles({
      includeProfiles: false,
    });

    expect('profile' in result.members[0]).toBe(false);
    expect(result.members.length).toBe(1);
  });

  test('should validate MemberProfile type structure', () => {
    const validProfile: MemberProfile = {
      birthDate: '昭和50年1月1日',
      birthPlace: '東京都',
      education: '東京大学',
      occupation: '弁護士',
      previousOccupation: ['記者', '教師'],
      committees: ['法務委員会'],
      website: 'https://example.com',
      email: 'test@example.com',
      office: {
        address: '東京都千代田区',
        phone: '03-1234-5678',
        fax: '03-1234-5679',
      },
      biography: 'テスト用の経歴',
      additionalInfo: {
        趣味: '読書',
        座右の銘: '一期一会',
      },
    };

    // TypeScript compilation will catch any type errors
    expect(validProfile).toBeDefined();
    expect(typeof validProfile.birthDate).toBe('string');
    expect(Array.isArray(validProfile.previousOccupation)).toBe(true);
    expect(typeof validProfile.office).toBe('object');
    expect(typeof validProfile.additionalInfo).toBe('object');
  });
});
