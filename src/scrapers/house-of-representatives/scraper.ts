import { type Browser, chromium, type Page } from 'playwright';
import { PREFECTURES } from '../../constants';
import { HOUSE_OF_REPRESENTATIVES_CONFIG } from './constants';
import type {
  HouseOfRepresentativesMember,
  HouseOfRepresentativesResult,
  MemberProfile,
  RawMemberData,
} from './types';

export class HouseOfRepresentativesScraper {
  private browser: Browser | null = null;
  private ownsBrowser = false;

  async initialize(): Promise<void> {
    if (this.browser) return; // already injected
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.ownsBrowser = true;
  }

  async close(): Promise<void> {
    if (this.browser && this.ownsBrowser) {
      await this.browser.close();
    }
    this.browser = null;
  }

  // Share external browser (owned by caller)
  public useBrowser(browser: Browser): void {
    this.browser = browser;
    this.ownsBrowser = false;
  }

  /**
   * Create a new Playwright page using the internal browser instance.
   * Throws if initialize() hasn't been called.
   */
  public async newPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() or useBrowser() first.');
    }
    return this.browser.newPage();
  }

  /**
   * For tests: force-close the underlying browser without changing public API.
   */
  public async forceCloseBrowserForTest(): Promise<void> {
    if (this.browser && this.ownsBrowser) {
      await this.browser.close();
    }
    this.browser = null;
  }

  /**
   * Main method to scrape House of Representatives members from all pages
   */
  async scrapeAllPages(): Promise<HouseOfRepresentativesResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() or useBrowser() first.');
    }

    const page = await this.browser.newPage();
    const processedMembers: HouseOfRepresentativesMember[] = [];
    let totalRawMembers = 0;

    try {
      console.log('Scraping House of Representatives list from all pages...');

      // Scrape all pages (あ行 through わ行)
      const pages = HOUSE_OF_REPRESENTATIVES_CONFIG.URLS.ALL_PAGES;
      const syllabaryNames = HOUSE_OF_REPRESENTATIVES_CONFIG.SYLLABARY_NAMES;

      for (const [pageIndex, pageUrl] of pages.entries()) {
        console.log(
          `
--- Scraping page ${pageIndex + 1}/${pages.length}: ${syllabaryNames[pageIndex]} ---`
        );

        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForSelector('table', {
          timeout: HOUSE_OF_REPRESENTATIVES_CONFIG.TIMEOUTS.PAGE_LOAD,
        });

        const rawMemberData = await this.extractMembersFromPage(page);
        console.log(
          `Found ${rawMemberData.length} raw members on ${syllabaryNames[pageIndex]} page`
        );
        totalRawMembers += rawMemberData.length;

        for (const member of rawMemberData) {
          if (!this.validateMemberData(member)) {
            continue;
          }

          try {
            console.log(
              `Processing member ${processedMembers.length + 1}: ${member.name.full} (${syllabaryNames[pageIndex]})`
            );

            const electionInfo = this.parseElectionInfo(member.prefecture);
            const processedMember: HouseOfRepresentativesMember = {
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
      }

      console.log(`\n=== Summary ===`);
      console.log(`Total raw members found across all pages: ${totalRawMembers}`);
      console.log(`Successfully processed: ${processedMembers.length} members`);

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

  /**
   * Scrapes House of Representatives members with their detailed profiles
   * @param options - Scraping options for profile collection
   * @returns Promise<HouseOfRepresentativesResult> - Complete member data with profiles
   */
  async scrapeHouseOfRepresentativesWithProfiles(
    options: {
      includeProfiles?: boolean;
      maxConcurrentProfiles?: number;
      profileDelay?: number;
      maxProfiles?: number;
    } = {}
  ): Promise<HouseOfRepresentativesResult> {
    const {
      includeProfiles = true,
      maxConcurrentProfiles = 2,
      profileDelay = 2000,
      maxProfiles = 50,
    } = options;

    // First, get the basic member data
    console.log('Starting House of Representatives scraping...');
    const result = await this.scrapeAllPages();

    if (!includeProfiles) {
      console.log('Profile scraping disabled. Returning basic member data only.');
      return result;
    }

    // Filter members with profile URLs
    const membersWithUrls = result.members.filter((m) => m.profileUrl);
    console.log(`Found ${membersWithUrls.length} members with profile URLs`);

    if (membersWithUrls.length === 0) {
      console.log('No members with profile URLs found. Returning basic data.');
      return result;
    }

    // Limit the number of profiles to scrape for testing/demo purposes
    const membersToScrape = membersWithUrls.slice(0, maxProfiles);
    if (membersToScrape.length < membersWithUrls.length) {
      console.log(`Limiting profile scraping to first ${maxProfiles} members for testing`);
    }

    // Scrape profiles with enhanced error handling
    try {
      await this.scrapeMultipleProfiles(membersToScrape, {
        maxConcurrent: maxConcurrentProfiles,
        delay: profileDelay,
      });
    } catch (error) {
      console.error('Error during profile scraping:', error);
      // Continue with partial results rather than failing completely
    }

    // Update the result with profile data
    const membersWithProfiles = result.members.map((member) => {
      const memberWithProfile = membersToScrape.find((m) => m.name === member.name);
      return memberWithProfile?.profile
        ? { ...member, profile: memberWithProfile.profile }
        : member;
    });

    return {
      ...result,
      members: membersWithProfiles,
    };
  }

  private async extractMembersFromPage(page: Page): Promise<RawMemberData[]> {
    // Get table data using Playwright selectors instead of page.evaluate()
    const rows = await page.locator('table tr').all();
    const members: RawMemberData[] = [];
    const seenMembers = new Set<string>();

    const isHeaderKeyword = (text: string): boolean => {
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
      const t = text.trim();
      return t.length < 2 || headers.some((h) => t === h || t.startsWith(h));
    };

    const isPartyKeyword = (text: string): boolean => {
      const t = (text || '').trim();
      const parties = [
        '自由民主党',
        '立憲民主党',
        '公明党',
        '日本維新の会',
        '日本共産党',
        '国民民主党',
        'れいわ新選組',
        '社会民主党',
        '無所属',
        '無会派',
      ];
      return parties.some((keyword) => t.includes(keyword));
    };

    const buildAbsoluteUrl = (relativeUrl: string): string => {
      const baseUrl = 'https://www.shugiin.go.jp';
      // Accept absolute http(s) and reject unsafe schemes
      if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl;
      if (/^(javascript|data):/i.test(relativeUrl)) return '';
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
    };

    for (const row of rows) {
      const cells = await row.locator('td').all();
      if (cells.length < 3) continue;

      const nameCell = cells[0];
      if (!nameCell) continue;

      const link = await nameCell.locator('a').first();
      let name = '';
      let href = '';

      if ((await link.count()) > 0) {
        name = (await link.textContent())?.trim() || '';
        href = (await link.getAttribute('href'))?.trim() || '';
      } else {
        name = (await nameCell.textContent())?.trim() || '';
      }

      if (!name || isHeaderKeyword(name)) continue;

      const cleanName = name.replace(/君$/, '').trim();
      if (seenMembers.has(cleanName)) continue;
      seenMembers.add(cleanName);

      const profileUrl = href ? buildAbsoluteUrl(href) : '';
      const furigana = cells[1] ? (await cells[1].textContent())?.trim() : '';

      let party = '不明';
      for (let i = 2; i < Math.min(5, cells.length); i++) {
        const text = (await cells[i]?.textContent())?.trim() || '';
        if (text && !isHeaderKeyword(text) && isPartyKeyword(text)) {
          party = text;
          break;
        }
      }

      let prefecture = '不明';
      let electionCount: RawMemberData['electionCount'];

      // Get all cell texts
      const allCells: string[] = [];
      for (const cell of cells) {
        const text = (await cell.textContent())?.trim() || '';
        allCells.push(text);
      }

      // First, look for prefecture+number patterns (like "岡山1", "大阪14")
      for (let i = 0; i < allCells.length; i++) {
        const text = allCells[i];
        if (text && !isHeaderKeyword(text) && !isPartyKeyword(text)) {
          // Check for prefecture + number pattern first (highest priority)
          for (const pref of PREFECTURES) {
            if (text.startsWith(pref)) {
              const num = text.slice(pref.length);
              if (/^\d+$/.test(num)) {
                prefecture = text;
                break;
              }
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
          const senateMatch = text.replace(/\s+/g, '').match(/^(\d+)[（(]参(\d+)[）)]$/);
          if (senateMatch?.[1] && senateMatch[2]) {
            const houseCount = parseInt(senateMatch[1], 10);
            const senateCount = parseInt(senateMatch[2], 10);
            electionCount = { house: houseCount, senate: senateCount };
            break;
          }

          // Check for pure number (House only)
          if (/^\d+$/.test(text)) {
            const num = parseInt(text, 10);
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
          const text = allCells[i];
          if (text && !isHeaderKeyword(text) && !isPartyKeyword(text)) {
            // Skip pure numbers (election count), look for prefecture names
            if (!/^\d+$/.test(text)) {
              // Check if it matches prefecture + number pattern
              for (const pref of PREFECTURES) {
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
      const memberData: RawMemberData = {
        name: {
          full: cleanName,
          last: nameParts[0] || '',
          first: nameParts.slice(1).join(' ') || '',
        },
        party,
        prefecture,
      };

      if (furigana && !isHeaderKeyword(furigana)) {
        memberData.furigana = furigana;
      }

      if (profileUrl) {
        memberData.profileUrl = profileUrl;
      }

      if (electionCount) {
        memberData.electionCount = electionCount;
      }

      members.push(memberData);
    }

    return members;
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
      if (rawInfo.startsWith(prefecture)) {
        const num = rawInfo.slice(prefecture.length);
        if (/^\d+$/.test(num)) {
          return {
            election: {
              system: 'single-seat',
              prefecture,
              number: num,
            },
          };
        }
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

  /**
   * Scrapes detailed profile information from a member's profile page
   * @param profileUrl - The URL of the member's profile page
   * @returns Promise<MemberProfile | null> - The member's profile data or null if scraping fails
   */
  async scrapeProfile(profileUrl: string): Promise<MemberProfile | null> {
    if (!profileUrl || !this.browser) {
      return null;
    }

    const page = await this.newPage();

    try {
      console.log(`Scraping profile: ${profileUrl}`);
      await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 10000 });

      const profile = await this.extractProfileFromPage(page);
      return profile;
    } catch (error) {
      console.error(`Failed to scrape profile ${profileUrl}:`, error);
      return null;
    } finally {
      await page.close();
    }
  }

  /**
   * Extracts profile information from the current page
   * @param page - The Playwright page object
   * @returns Promise<MemberProfile | null> - Extracted profile data
   */
  private async extractProfileFromPage(page: Page): Promise<MemberProfile | null> {
    const profile: MemberProfile = {};

    // Helper function to clean text
    const cleanText = (text: string | null | undefined): string => {
      return (
        text
          ?.trim()
          .replace(/\s+/g, ' ')
          .replace(/[　\u3000]/g, ' ') || ''
      );
    };

    try {
      // Extract from table-like structures
      const tableRows = await page.locator('table tr, .profile-row, .data-row').all();
      const tableData: Record<string, string> = {};

      for (const row of tableRows) {
        const cells = await row.locator('td, th, .label, .value').all();
        if (cells.length >= 2) {
          const label = cleanText(await cells[0]?.textContent());
          const value = cleanText(await cells[1]?.textContent());
          if (label && value) {
            tableData[label] = value;
          }
        }
      }

      // Extract from definition lists
      const dls = await page.locator('dl').all();
      const dlData: Record<string, string> = {};

      for (const dl of dls) {
        const dts = await dl.locator('dt').all();
        const dds = await dl.locator('dd').all();

        for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
          const label = cleanText(await dts[i]?.textContent());
          const value = cleanText(await dds[i]?.textContent());
          if (label && value) {
            dlData[label] = value;
          }
        }
      }

      // Combine all extracted data
      const allData = { ...tableData, ...dlData };

      // Parse birth date from various formats
      const birthDatePatterns = ['生年月日', '誕生日', '生まれ', '年齢'];
      for (const pattern of birthDatePatterns) {
        for (const [key, value] of Object.entries(allData)) {
          if (key.includes(pattern) && value) {
            // Extract date pattern like "昭和XX年XX月XX日" or "19XX年XX月XX日"
            const dateMatch = value.match(
              /(?:昭和|平成|令和)?(?:(\d{1,2})|(\d{4}))年(\d{1,2})月(\d{1,2})日/
            );
            if (dateMatch) {
              profile.birthDate = value;
              break;
            }
          }
        }
        if (profile.birthDate) break;
      }

      // Parse birth place
      const birthPlacePatterns = ['出身地', '生まれ', '出身'];
      for (const pattern of birthPlacePatterns) {
        for (const [key, value] of Object.entries(allData)) {
          if (key.includes(pattern) && value && !value.includes('年') && !value.includes('月')) {
            profile.birthPlace = value;
            break;
          }
        }
        if (profile.birthPlace) break;
      }

      // Parse education
      const educationPatterns = ['学歴', '卒業', '大学', '学校'];
      for (const pattern of educationPatterns) {
        for (const [key, value] of Object.entries(allData)) {
          if (key.includes(pattern) && value) {
            profile.education = value;
            break;
          }
        }
        if (profile.education) break;
      }

      // Parse occupation
      const occupationPatterns = ['職業', '現職', '前職'];
      for (const pattern of occupationPatterns) {
        for (const [key, value] of Object.entries(allData)) {
          if (key.includes(pattern) && value) {
            if (pattern === '前職') {
              profile.previousOccupation = value
                .split(/[、，,]/)
                .map((s) => s.trim())
                .filter((s) => s);
            } else {
              profile.occupation = value;
            }
            break;
          }
        }
      }

      // Parse committees
      const committeePatterns = ['委員会', '所属委員会', '委員'];
      for (const pattern of committeePatterns) {
        for (const [key, value] of Object.entries(allData)) {
          if (key.includes(pattern) && value) {
            profile.committees = value
              .split(/[、，,]/)
              .map((s) => s.trim())
              .filter((s) => s);
            break;
          }
        }
        if (profile.committees) break;
      }

      // Parse contact information
      const websiteLink = await page.locator('a[href^="http"]').first();
      if ((await websiteLink.count()) > 0) {
        const href = await websiteLink.getAttribute('href');
        if (href) {
          profile.website = href;
        }
      }

      // Parse email
      const emailLink = await page.locator('a[href^="mailto:"]').first();
      if ((await emailLink.count()) > 0) {
        const href = await emailLink.getAttribute('href');
        if (href) {
          profile.email = href.replace('mailto:', '');
        }
      }

      // Parse office information
      const officePatterns = ['事務所', '連絡先', '住所', '電話', 'TEL', 'FAX'];
      const officeData: { address?: string; phone?: string; fax?: string } = {};

      for (const pattern of officePatterns) {
        for (const [key, value] of Object.entries(allData)) {
          if (key.includes(pattern) && value) {
            if (key.includes('住所')) {
              officeData.address = value;
            } else if (key.includes('電話') || key.includes('TEL')) {
              officeData.phone = value;
            } else if (key.includes('FAX')) {
              officeData.fax = value;
            }
          }
        }
      }

      if (Object.keys(officeData).length > 0) {
        profile.office = officeData;
      }

      // Extract biography from paragraph text
      const paragraphs = await page.locator('p').all();
      const biographyTexts: string[] = [];

      for (const p of paragraphs) {
        const text = cleanText(await p.textContent());
        if (text.length > 50 && !text.includes('委員会') && !text.includes('事務所')) {
          biographyTexts.push(text);
        }
      }

      if (biographyTexts.length > 0) {
        profile.biography = biographyTexts.join('\n');
      }

      // Store additional information not captured above
      const additionalInfo: Record<string, string> = {};
      for (const [key, value] of Object.entries(allData)) {
        if (
          !key.includes('生年月日') &&
          !key.includes('出身') &&
          !key.includes('学歴') &&
          !key.includes('職業') &&
          !key.includes('委員会') &&
          !key.includes('事務所') &&
          !key.includes('連絡先') &&
          !key.includes('住所') &&
          !key.includes('電話') &&
          !key.includes('FAX') &&
          value
        ) {
          additionalInfo[key] = value;
        }
      }

      if (Object.keys(additionalInfo).length > 0) {
        profile.additionalInfo = additionalInfo;
      }

      return Object.keys(profile).length > 0 ? profile : null;
    } catch (error) {
      console.error('Error extracting profile from page:', error);
      return null;
    }
  }

  /**
   * Scrapes profiles for multiple members with rate limiting
   * @param members - Array of members with profileUrl
   * @param options - Scraping options
   * @returns Promise<void>
   */
  async scrapeMultipleProfiles(
    members: HouseOfRepresentativesMember[],
    options: { maxConcurrent?: number; delay?: number } = {}
  ): Promise<void> {
    const { maxConcurrent = 3, delay = 1000 } = options;

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const membersWithProfiles = members.filter((m) => m.profileUrl);
    console.log(`Scraping profiles for ${membersWithProfiles.length} members...`);

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < membersWithProfiles.length; i += maxConcurrent) {
      const batch = membersWithProfiles.slice(i, i + maxConcurrent);

      const promises = batch.map(async (member) => {
        if (member.profileUrl) {
          const profile = await this.scrapeProfile(member.profileUrl);
          if (profile) {
            member.profile = profile;
            console.log(`✓ Scraped profile for ${member.name}`);
          } else {
            console.log(`✗ Failed to scrape profile for ${member.name}`);
          }
        }
      });

      await Promise.all(promises);

      // Add delay between batches
      if (i + maxConcurrent < membersWithProfiles.length && delay > 0) {
        console.log(`Waiting ${delay}ms before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log(
      `Completed profile scraping. Success rate: ${members.filter((m) => m.profile).length}/${membersWithProfiles.length}`
    );
  }
}
