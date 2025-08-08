import { type Browser, chromium, type Page } from 'playwright';
import { PREFECTURES, SCRAPING_CONFIG } from './constants';
import type { DietMember, ScrapeResult } from './types';

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
  electionCount?: number | { house: number; senate?: number };
}

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
      await page.goto(SCRAPING_CONFIG.URLS.HOUSE_OF_REPRESENTATIVES, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('table', { timeout: SCRAPING_CONFIG.TIMEOUTS.PAGE_LOAD });

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
            ...(member.electionCount && { electionCount: member.electionCount }),
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
    return page.evaluate((prefectures) => {
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
        let electionCount = null;

        // The table structure shows electoral districts are in specific positions
        // Based on debug info, electoral districts appear in specific patterns
        const allCells = Array.from(cells).map((cell) => cell.textContent?.trim() || '');

        // First, look for prefecture+number patterns (like "岡山1", "大阪14")
        for (let i = 0; i < allCells.length; i++) {
          const text = allCells[i];
          if (text && !isHeaderKeyword(text) && !isPartyKeyword(text)) {
            // Check for prefecture + number pattern first (highest priority)
            for (const pref of prefectures) {
              if (text.match(new RegExp(`^${pref}\\d+$`))) {
                prefecture = text;
                break;
              }
            }
            if (prefecture !== '不明') break;
          }
        }

        // Look for election count (format: "5（参1）" or pure numbers)
        for (let i = 0; i < allCells.length; i++) {
          const text = allCells[i];
          if (text) {
            // Check for pattern like "1（参2）", "5（参1）" - House + (Senate)
            const senateMatch = text.match(/^(\d+)（参(\d+)）$/);
            if (senateMatch) {
              const houseCount = parseInt(senateMatch[1]);
              const senateCount = parseInt(senateMatch[2]);
              electionCount = { house: houseCount, senate: senateCount };
              break;
            }

            // Check for pure number (House only)
            if (/^\d+$/.test(text)) {
              const num = parseInt(text);
              // Election counts are typically 1-25, filter out years or large numbers
              if (num >= 1 && num <= 25) {
                electionCount = { house: num };
                break;
              }
            }
          }
        }

        // If not found, look for proportional representation
        if (prefecture === '不明') {
          for (let i = 0; i < allCells.length; i++) {
            const text = allCells[i];
            if (text?.includes('（比）')) {
              prefecture = text;
              break;
            }
          }
        }

        // If no electoral district found, check if any cell contains prefecture + number pattern
        if (prefecture === '不明') {
          for (let i = 2; i < cells.length; i++) {
            const text = cells[i]?.textContent?.trim() || '';
            if (text && !isHeaderKeyword(text) && !isPartyKeyword(text)) {
              // Skip pure numbers (election count), look for prefecture names
              if (!/^\d+$/.test(text)) {
                // Check if it matches prefecture + number pattern
                for (const pref of prefectures) {
                  if (text.includes(pref)) {
                    prefecture = text;
                    break;
                  }
                }
                if (prefecture !== '不明') break;
              }
            }
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
          electionCount: electionCount || undefined,
        });
      }

      return members;
    }, PREFECTURES);
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
    for (const prefecture of PREFECTURES) {
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
    if ((PREFECTURES as readonly string[]).includes(rawInfo)) {
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
