import { type Browser, chromium, type Page } from 'playwright';
import type { ScrapeResult } from './types';

// Raw member data from table extraction
interface RawMemberData {
  name: {
    full: string;
    first: string;
    last: string;
  };
  furigana?: string;
  party: string;
  profileUrl?: string;
  prefecture: string;
}

// Configuration constants
const SCRAPING_CONFIG = {
  URLS: {
    HOUSE_OF_REPRESENTATIVES:
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm',
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
      // @ts-ignore
      (window as unknown).__name = () => {};
    });
    const processedMembers: DietMember[] = [];

    try {
      console.log('Scraping House of Representatives list...');
      await page.goto(SCRAPING_CONFIG.URLS.HOUSE_OF_REPRESENTATIVES);
      await page.waitForTimeout(SCRAPING_CONFIG.TIMEOUTS.PAGE_LOAD);

      const rawMemberData = await this.extractMembersFromPage(page);
      console.log(`Found ${rawMemberData.length} raw members`);

      for (const [index, member] of rawMemberData.entries()) {
        if (!this.validateMemberData(member)) {
          continue;
        }

        try {
          console.log(
            `Processing member ${index + 1}/${rawMemberData.length}: ${member.name.full}`
          );

          const electionInfo = this.parseElectionInfo(member.prefecture);
          const processedMember: DietMember = {
            name: member.name.full,
            party: member.party,
            ...electionInfo,
            ...(member.furigana && { furigana: this.normalizeFurigana(member.furigana) }),
            ...(member.profileUrl && { profileUrl: member.profileUrl }),
          };

          processedMembers.push(processedMember);
        } catch (error) {
          console.warn(`Failed to process member: ${member.name?.full}`, error);
        }
      }

      console.log(`Successfully processed ${processedMembers.length} members`);

      if (processedMembers.length === 0) {
        throw new Error('No valid members were scraped. The website structure may have changed.');
      }
    } catch (error) {
      console.error('Error scraping House of Representatives list:', error);
      throw error;
    } finally {
      await page.close();
    }

    return {
      members: processedMembers,
      scrapedAt: new Date().toISOString(),
      source: 'house-of-representatives-list',
    };
  }

  private async extractMembersFromPage(page: Page): Promise<RawMemberData[]> {
    return page.evaluate(() => {
      const members = [];
      const seenMembers = new Set();
      const rows = Array.from(document.querySelectorAll('table tr'));

      function isHeaderKeyword(text) {
        const headers = [
          '氏名',
          '議員氏名',
          'ふりがな',
          'フリガナ',
          '読み',
          'よみ',
          '会派',
          '選挙区',
          '政党',
          '都道府県',
        ];
        return headers.includes(text) || text.length < 2;
      }

      function isPartyKeyword(text) {
        const parties = ['党', '会', '民主', '自民', '公明', '維新', '共産', '立憲', '国民'];
        return parties.some((keyword) => text.includes(keyword));
      }

      function isElectoralDistrictKeyword(text) {
        return (
          /^(北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)\d*$/.test(
            text
          ) ||
          /^（比）(北海道|東北|北関東|南関東|東京|北陸信越|東海|近畿|中国|四国|九州)$/.test(text) ||
          /^\d+$/.test(text)
        );
      }

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

      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) continue;

        const nameCell = cells[0];
        if (!nameCell) continue;

        const link = nameCell.querySelector('a');
        const name = link ? link.textContent?.trim() : nameCell.textContent?.trim();
        if (!name || isHeaderKeyword(name)) continue;

        const cleanName = name.replace(/君$/, '').trim();
        if (seenMembers.has(cleanName)) continue;
        seenMembers.add(cleanName);

        const profileUrl = link?.getAttribute('href')
          ? buildAbsoluteUrl(link.getAttribute('href'))
          : '';

        const furigana = cells[1] ? cells[1].textContent?.trim() : '';

        let party = '不明';
        for (let i = 2; i < Math.min(5, cells.length); i++) {
          const text = cells[i]?.textContent?.trim() || '';
          if (text && !isHeaderKeyword(text) && isPartyKeyword(text)) {
            party = text;
            break;
          }
        }

        let prefecture = '不明';
        for (let i = 3; i < cells.length; i++) {
          const text = cells[i]?.textContent?.trim() || '';
          if (
            text &&
            !isHeaderKeyword(text) &&
            !isPartyKeyword(text) &&
            isElectoralDistrictKeyword(text)
          ) {
            prefecture = text;
            break;
          }
        }

        const nameParts = cleanName.split(/\s+/);
        members.push({
          name: {
            full: cleanName,
            last: nameParts[0] || '',
            first: nameParts.slice(1).join(' ') || '',
          },
          furigana: furigana && !isHeaderKeyword(furigana) ? furigana : undefined,
          party,
          profileUrl: profileUrl || undefined,
          prefecture,
        });
      }

      return members;
    });
  }

  private validateMemberData(member: RawMemberData): boolean {
    return !!(
      member?.name?.full &&
      typeof member.name.full === 'string' &&
      member.name.full.trim().length >= 2 &&
      member.party &&
      typeof member.party === 'string' &&
      member.prefecture &&
      typeof member.prefecture === 'string'
    );
  }

  private normalizeFurigana(furigana: string): string {
    return furigana.replace(/\n/g, ' ').replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
  }

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

    // Check for proportional representation
    if (rawInfo.includes('（比）') || rawInfo.includes('比例')) {
      const propMatch = rawInfo.match(
        /（比）(北海道|東北|北関東|南関東|東京|北陸信越|東海|近畿|中国|四国|九州)/
      );
      return {
        election: {
          system: 'proportional-representation',
          area: propMatch?.[1] || rawInfo,
        },
      };
    }

    // Parse prefecture + district number format
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

    for (const prefecture of prefectureList) {
      const match = rawInfo.match(new RegExp(`^${prefecture}(\\d+)$`));
      if (match) {
        return {
          election: {
            system: 'single-seat',
            prefecture: prefecture,
            number: match[1],
          },
        };
      }
    }

    // Prefecture name only
    if (prefectureList.includes(rawInfo)) {
      return {
        election: {
          system: 'single-seat',
          prefecture: rawInfo,
        },
      };
    }

    // Generic fallback
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

    // Default
    return {
      election: {
        system: 'single-seat',
        prefecture: rawInfo,
      },
    };
  }
}
