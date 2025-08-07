import { type Browser, chromium, type Page } from 'playwright';
import type { ScrapeResult } from './types';

// Intermediate type for raw scraped member data before processing
interface RawMemberData {
  name: {
    full: string;
    first: string;
    last: string;
  };
  party: string;
  chamber: 'house-of-representatives';
  profileUrl?: string;
  prefecture: string;
}

// Processed member data with election info
interface ProcessedMemberData {
  name: string;
  party: string;
  chamber: 'house-of-representatives';
  profileUrl?: string;
  election: {
    system: 'single-seat' | 'proportional-representation';
    prefecture?: string;
    number?: string | undefined;
  };
  electionCount?: number;
}

// Configuration constants for improved maintainability
const SCRAPING_CONFIG = {
  URLS: {
    HOUSE_OF_REPRESENTATIVES:
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm',
  },
  SELECTORS: {
    TABLE_ROWS: 'table tr',
    TABLE_CELLS: 'td',
    NAME_LINK: 'a',
  },
  KEYWORDS: {
    HEADERS: ['氏名', '議員氏名', '会派', '選挙区', '政党', '都道府県'],
    PARTIES: ['党', '会', '民主', '自民', '公明', '維新', '共産', '立憲', '国民'],
    PREFECTURES: ['県', '都', '府', '区', '市', '町'],
  },
  BASE_URLS: {
    SHUGIIN: 'https://www.shugiin.go.jp',
    SHUGIIN_INTERNET: 'https://www.shugiin.go.jp/internet',
    SHUGIIN_PROFILE_BASE: 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu',
  },
  TIMEOUTS: {
    PAGE_LOAD: 3000,
  },
} as const;

export class DietMemberScraper {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Main method to scrape House of Representatives members
   */
  async scrapeHouseOfRepresentativesList(): Promise<ScrapeResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const page = await this.browser.newPage();
    await page.addInitScript(() => {
      // Provide dummy __name function for TypeScript helper inside browser context
      // @ts-ignore
      (window as unknown as { __name: () => void }).__name = () => {};
    });
    const rawMembers: ProcessedMemberData[] = [];

    try {
      await page.goto(SCRAPING_CONFIG.URLS.HOUSE_OF_REPRESENTATIVES);
      await page.waitForTimeout(SCRAPING_CONFIG.TIMEOUTS.PAGE_LOAD);

      const memberData = await this.extractMembersFromPage(page);

      // Process and validate members
      const processedMembers = memberData
        .filter((member: RawMemberData) => this.validateMemberData(member))
        .map((member: RawMemberData) => {
          try {
            const electionInfo = this.parseElectionInfo(member.prefecture);

            const result = {
              name: member.name.full,
              party: member.party,
              chamber: member.chamber,
              profileUrl: member.profileUrl,
              ...electionInfo,
            } as ProcessedMemberData;

            return result;
          } catch (error) {
            console.warn(`Failed to process member: ${member.name?.full}`, error);
            return null;
          }
        })
        .filter(
          (member: ProcessedMemberData | null): member is ProcessedMemberData => member !== null
        );

      rawMembers.push(...processedMembers);

      console.log(`Scraped ${rawMembers.length} members from House of Representatives list`);

      if (rawMembers.length === 0) {
        throw new Error('No valid members were scraped. The website structure may have changed.');
      }
    } catch (error) {
      console.error('Error scraping House of Representatives list:', error);
      throw error;
    } finally {
      await page.close();
    }

    return {
      members: rawMembers,
      scrapedAt: new Date().toISOString(),
      source: 'house-of-representatives-list',
    };
  }

  /**
   * Extract member data from the page using browser evaluation
   */
  private async extractMembersFromPage(page: Page): Promise<RawMemberData[]> {
    return (await page.evaluate(() => {
      const members = [];
      const seenMembers = new Set();

      // Helper function to normalize names
      // @ts-ignore
      function normalizeName(name) {
        return name.replace(/　+/g, ' ').replace(/\s+/g, ' ').trim();
      }

      // Helper function to build absolute URLs
      // @ts-ignore
      function buildAbsoluteUrl(relativeUrl) {
        const baseUrl = 'https://www.shugiin.go.jp';

        if (relativeUrl.startsWith('../../../../')) {
          return relativeUrl.replace('../../../../', `${baseUrl}/internet/`);
        }
        if (relativeUrl.startsWith('../')) {
          return `${baseUrl}/internet/${relativeUrl.replace(/^\.\.\/+/, '')}`;
        }
        if (relativeUrl.startsWith('/')) {
          return `${baseUrl}${relativeUrl}`;
        }
        return `${baseUrl}/internet/itdb_annai.nsf/html/statics/syu/${relativeUrl}`;
      }

      // Helper function to check if text is a header keyword
      // @ts-ignore
      function isHeaderKeyword(text) {
        const headers = ['氏名', '議員氏名', '会派', '選挙区', '政党', '都道府県'];
        return headers.includes(text) || text.length < 2;
      }

      // Helper function to check if text contains party keywords
      // @ts-ignore
      function isPartyKeyword(text) {
        const parties = ['党', '会', '民主', '自民', '公明', '維新', '共産', '立憲', '国民'];
        return parties.some((keyword) => text.includes(keyword));
      }

      // Helper function to check if text looks like electoral district
      // @ts-ignore
      function isElectoralDistrictKeyword(text) {
        const districtPatterns = [
          /^(北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)\d*$/,
          /^（比）(北海道|東北|北関東|南関東|東京|北陸信越|東海|近畿|中国|四国|九州)$/,
          /^\d+$/, // 選出回数のみ
        ];
        return districtPatterns.some((pattern) => pattern.test(text));
      }

      // Extract name and profile URL from name cell
      // @ts-ignore
      function extractNameFromCell(nameCell) {
        if (!nameCell) return { name: '', profileUrl: '' };

        const nameLink = nameCell.querySelector('a');
        if (nameLink) {
          const name = nameLink.textContent?.trim() || '';
          let profileUrl = nameLink.getAttribute('href') || '';

          if (profileUrl && !profileUrl.startsWith('http')) {
            profileUrl = buildAbsoluteUrl(profileUrl);
          }

          return { name, profileUrl };
        }

        return {
          name: nameCell.textContent?.trim() || '',
          profileUrl: '',
        };
      }

      // Extract party from table cells
      // @ts-ignore
      function extractPartyFromCells(cells) {
        // セル2（インデックス1）を最初にチェック
        if (cells[1]) {
          const cellText = cells[1].textContent?.trim() || '';
          if (cellText && !isHeaderKeyword(cellText) && isPartyKeyword(cellText)) {
            return cellText;
          }
        }

        // セル3以降で政党キーワードを含むものを探す
        for (let i = 2; i < cells.length; i++) {
          const cell = cells[i];
          if (!cell) continue;

          const cellText = cell.textContent?.trim() || '';
          if (!isHeaderKeyword(cellText) && isPartyKeyword(cellText)) {
            return cellText;
          }
        }

        // フォールバック：セル2の内容（ヘッダーでない場合）
        if (cells[1]) {
          const secondCellText = cells[1].textContent?.trim() || '';
          if (secondCellText && !isHeaderKeyword(secondCellText)) {
            return secondCellText;
          }
        }

        return '不明';
      }

      // Extract electoral district from table cells
      // @ts-ignore
      function extractElectoralDistrictFromCells(cells) {
        // 選挙区パターンに一致するセルを探す
        for (let i = 1; i < cells.length; i++) {
          const cell = cells[i];
          if (!cell) continue;

          const cellText = cell.textContent?.trim() || '';
          if (!isHeaderKeyword(cellText) && isElectoralDistrictKeyword(cellText)) {
            return cellText;
          }
        }

        // フォールバック：政党以外の最後の有意なセル
        for (let i = cells.length - 1; i >= 1; i--) {
          const cell = cells[i];
          if (!cell) continue;

          const cellText = cell.textContent?.trim() || '';
          if (!isHeaderKeyword(cellText) && !isPartyKeyword(cellText) && cellText !== '不明') {
            return cellText;
          }
        }

        return '不明';
      }

      // Parse name into components
      // @ts-ignore
      function parseNameParts(name) {
        const normalizedName = normalizeName(name);
        const cleanName = normalizedName.replace(/君$/, '');
        const nameParts = cleanName.split(/\s+/);

        return {
          full: cleanName,
          last: nameParts[0] || '',
          first: nameParts.slice(1).join(' ') || '',
        };
      }

      // Check for duplicate members
      // @ts-ignore
      function isDuplicateMember(name, seenMembers) {
        const cleanNameForDupe = name.replace(/君$/, '').trim();
        if (seenMembers.has(cleanNameForDupe)) {
          return true;
        }
        seenMembers.add(cleanNameForDupe);
        return false;
      }

      // Main extraction logic
      const rows = Array.from(document.querySelectorAll('table tr'));

      for (const row of rows) {
        const cells = row.querySelectorAll('td');

        if (cells.length < 3) continue;

        const { name, profileUrl } = extractNameFromCell(cells[0]);

        if (!name || isHeaderKeyword(name) || isDuplicateMember(name, seenMembers)) continue;

        const party = extractPartyFromCells(cells);
        const prefecture = extractElectoralDistrictFromCells(cells);
        const nameParts = parseNameParts(name);

        const member = {
          name: nameParts,
          party,
          chamber: 'house-of-representatives',
          profileUrl: profileUrl || undefined,
          prefecture,
        };

        members.push(member);
      }

      return members;
    })) as unknown as RawMemberData[];
  }

  /**
   * Validate member data
   */
  private validateMemberData(member: RawMemberData): boolean {
    if (!member || typeof member !== 'object') {
      return false;
    }

    // Check name object structure
    if (!member.name || typeof member.name !== 'object') {
      return false;
    }

    if (
      !member.name.full ||
      typeof member.name.full !== 'string' ||
      member.name.full.trim().length < 2
    ) {
      return false;
    }

    // Check party
    if (!member.party || typeof member.party !== 'string' || member.party.trim().length === 0) {
      return false;
    }

    // Check chamber
    if (member.chamber !== 'house-of-representatives') {
      return false;
    }

    // Check prefecture
    if (!member.prefecture || typeof member.prefecture !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Parse election information from raw prefecture data
   */
  private parseElectionInfo(rawInfo: string): {
    election: {
      system: 'single-seat' | 'proportional-representation';
      prefecture?: string;
      number?: string | undefined;
      area?: string;
    };
    electionCount?: number;
  } {
    if (!rawInfo || rawInfo === '不明') {
      return {
        election: {
          system: 'single-seat',
          prefecture: '不明',
          number: undefined,
        },
      };
    }

    // Extract election count (numbers only) - 選出回数のみの場合
    const electionCountMatch = rawInfo.match(/^(\d+)$/);
    if (electionCountMatch?.[1]) {
      return {
        electionCount: parseInt(electionCountMatch[1]),
        election: {
          system: 'single-seat',
          prefecture: '不明',
          number: undefined,
        },
      };
    }

    // Check for proportional representation - 比例代表の場合
    if (rawInfo.includes('（比）') || rawInfo.includes('比例')) {
      const propMatch = rawInfo.match(
        /（比）(北海道|東北|北関東|南関東|東京|北陸信越|東海|近畿|中国|四国|九州)/
      );
      if (propMatch?.[1]) {
        return {
          election: {
            system: 'proportional-representation',
            area: propMatch[1],
          },
        };
      }

      // フォールバック：rawInfoをそのまま使用
      return {
        election: {
          system: 'proportional-representation',
          area: rawInfo,
        },
      };
    }

    // Parse standard prefecture + district number format for single-seat constituencies
    const prefectureList = [
      '北海道',
      '青森',
      '岩手',
      '宮城',
      '秋田',
      '山形',
      '福島',
      '茨城',
      '栃木',
      '群馬',
      '埼玉',
      '千葉',
      '東京',
      '神奈川',
      '新潟',
      '富山',
      '石川',
      '福井',
      '山梨',
      '長野',
      '岐阜',
      '静岡',
      '愛知',
      '三重',
      '滋賀',
      '京都',
      '大阪',
      '兵庫',
      '奈良',
      '和歌山',
      '鳥取',
      '島根',
      '岡山',
      '広島',
      '山口',
      '徳島',
      '香川',
      '愛媛',
      '高知',
      '福岡',
      '佐賀',
      '長崎',
      '熊本',
      '大分',
      '宮崎',
      '鹿児島',
      '沖縄',
    ];

    // 都道府県名+数字のパターンを検索
    for (const prefecture of prefectureList) {
      const match = rawInfo.match(new RegExp(`^${prefecture}(\\d+)$`));
      if (match?.[1]) {
        return {
          election: {
            system: 'single-seat',
            prefecture: prefecture,
            number: match[1],
          },
        };
      }
    }

    // 都道府県名のみの場合
    if (prefectureList.includes(rawInfo)) {
      return {
        election: {
          system: 'single-seat',
          prefecture: rawInfo,
          number: undefined,
        },
      };
    }

    // Generic fallback - 汎用的なフォールバック
    const generalMatch = rawInfo.match(/^(.+?)(\d+)$/);
    if (generalMatch?.[1] && generalMatch[2]) {
      return {
        election: {
          system: 'single-seat',
          prefecture: generalMatch[1],
          number: generalMatch[2],
        },
      };
    }

    // Default: treat as single-seat constituency
    return {
      election: {
        system: 'single-seat',
        prefecture: rawInfo,
      },
    };
  }

  /**
   * Legacy method for backwards compatibility
   */
  async scrapeHouseOfRepresentatives(): Promise<ScrapeResult> {
    return this.scrapeHouseOfRepresentativesList();
  }

  /**
   * Simple example scraper (legacy)
   */
  async scrapeSimpleExample(): Promise<ScrapeResult> {
    console.warn(
      'scrapeSimpleExample is deprecated. Use scrapeHouseOfRepresentativesList instead.'
    );
    return this.scrapeHouseOfRepresentativesList();
  }
}
