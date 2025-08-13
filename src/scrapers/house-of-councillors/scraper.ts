import { type Browser, chromium, type Page } from 'playwright';
import { HOUSE_OF_COUNCILLORS_CONFIG, PREFECTURES } from './constants';
import type {
  HouseOfCouncillorsMember,
  HouseOfCouncillorsProfile,
  HouseOfCouncillorsResult,
  RawHouseOfCouncillorsMemberData,
} from './types';

export class HouseOfCouncillorsScraper {
  private browser: Browser | null = null;
  private ownsBrowser = false;

  async initialize(): Promise<void> {
    if (this.browser) return; // already initialized
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
   * Main method to scrape House of Councillors members
   */
  async scrapeAllMembers(): Promise<HouseOfCouncillorsResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() or useBrowser() first.');
    }

    const page = await this.browser.newPage();
    const processedMembers: HouseOfCouncillorsMember[] = [];
    let totalRawMembers = 0;

    try {
      console.log('Scraping House of Councillors member list...');

      await page.goto(HOUSE_OF_COUNCILLORS_CONFIG.URLS.CURRENT, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('table', {
        timeout: HOUSE_OF_COUNCILLORS_CONFIG.TIMEOUTS.PAGE_LOAD,
      });

      const rawMemberData = await this.extractMembersFromPage(page);
      console.log(`Found ${rawMemberData.length} raw members`);
      totalRawMembers = rawMemberData.length;

      for (const member of rawMemberData) {
        if (!this.validateMemberData(member)) {
          continue;
        }

        try {
          console.log(`Processing member ${processedMembers.length + 1}: ${member.name.full}`);

          const electionInfo = this.parseElectionInfo(member.election);
          const processedMember: HouseOfCouncillorsMember = {
            name: member.name.full,
            party: member.party,
            termExpiration: member.termExpiration,
            ...electionInfo,
            ...(member.furigana && { furigana: this.normalizeFurigana(member.furigana) }),
            ...(member.profileUrl && { profileUrl: member.profileUrl }),
          };

          processedMembers.push(processedMember);
        } catch (error) {
          console.warn(`Failed to process member: ${member.name?.full}`, error);
        }
      }

      console.log('\n=== Summary ===');
      console.log(`Total raw members found: ${totalRawMembers}`);
      console.log(`Successfully processed: ${processedMembers.length} members`);

      if (processedMembers.length === 0) {
        throw new Error('No valid members were scraped. The website structure may have changed.');
      }
    } catch (error) {
      console.error('Error scraping House of Councillors list:', error);
      throw error;
    } finally {
      await page.close();
    }

    return {
      members: processedMembers,
      scrapedAt: new Date().toISOString(),
      source: 'house-of-councillors-list',
    };
  }

  /**
   * Scrapes House of Councillors members with their detailed profiles
   */
  async scrapeHouseOfCouncillorsWithProfiles(
    options: {
      includeProfiles?: boolean;
      maxConcurrentProfiles?: number;
      profileDelay?: number;
      maxProfiles?: number;
    } = {}
  ): Promise<HouseOfCouncillorsResult> {
    const {
      includeProfiles = true,
      maxConcurrentProfiles = 2,
      profileDelay = 2000,
      maxProfiles = 10,
    } = options;

    // First, get the basic member data
    console.log('Starting House of Councillors scraping...');
    const result = await this.scrapeAllMembers();

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

    // Limit the number of profiles to scrape (configurable)
    const membersToScrape =
      maxProfiles === Number.MAX_SAFE_INTEGER
        ? membersWithUrls // No limit - scrape all members
        : membersWithUrls.slice(0, maxProfiles);

    if (maxProfiles === Number.MAX_SAFE_INTEGER) {
      console.log(`Scraping profiles for ALL ${membersToScrape.length} members`);
    } else if (membersToScrape.length < membersWithUrls.length) {
      console.log(`Limiting profile scraping to first ${maxProfiles} members (configurable)`);
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

    return result;
  }

  private async extractMembersFromPage(page: Page): Promise<RawHouseOfCouncillorsMemberData[]> {
    // Get table data using Playwright selectors
    const rows = await page.locator('table tr').all();
    const members: RawHouseOfCouncillorsMemberData[] = [];
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
        '任期',
        '任期満了',
        'あ行',
        'か行',
        'さ行',
        'た行',
        'な行',
        'は行',
        'ま行',
        'や行',
        'ら行',
        'わ行',
      ];
      const t = text.trim();
      return t.length < 2 || headers.some((h) => t === h || t.startsWith(h));
    };

    const isPartyKeyword = (text: string): boolean => {
      const t = (text || '').trim();
      return HOUSE_OF_COUNCILLORS_CONFIG.POLITICAL_PARTIES.some((keyword) => t.includes(keyword));
    };

    const buildAbsoluteUrl = (relativeUrl: string): string => {
      const baseUrl = HOUSE_OF_COUNCILLORS_CONFIG.URLS.BASE_URL;
      // Accept absolute http(s) and reject unsafe schemes
      if (/^https?:\/\//.test(relativeUrl)) return relativeUrl;
      if (/^(javascript|data):/.test(relativeUrl)) return '';

      // Handle relative URLs starting with ../
      if (relativeUrl.startsWith('../')) {
        // Remove ../ and treat as relative to base path
        const cleanPath = relativeUrl.replace(/^\.\.\/+/, '');
        return `${baseUrl}/japanese/joho1/kousei/giin/218/${cleanPath}`;
      }

      if (relativeUrl.startsWith('/')) {
        return `${baseUrl}${relativeUrl}`;
      }
      return `${baseUrl}${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
    };

    for (const row of rows) {
      const cells = await row.locator('td').all();
      if (cells.length < 4) continue; // Need at least name, reading, party, election, term

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

      // Clean name - remove brackets and君 suffix
      const cleanName = name
        .replace(/\[.*?\]/, '')
        .replace(/君$/, '')
        .trim();
      if (seenMembers.has(cleanName)) continue;
      seenMembers.add(cleanName);

      const profileUrl = href ? buildAbsoluteUrl(href) : '';
      const furigana = cells[1] ? (await cells[1].textContent())?.trim() || '' : '';

      // Get party (会派)
      let party = '不明';
      const partyText = cells[2] ? (await cells[2].textContent())?.trim() || '' : '';
      if (partyText && !isHeaderKeyword(partyText) && isPartyKeyword(partyText)) {
        party = partyText;
      }

      // Get election district
      let election = '不明';
      const electionText = cells[3] ? (await cells[3].textContent())?.trim() || '' : '';
      if (electionText && !isHeaderKeyword(electionText)) {
        election = electionText;
      }

      // Get term expiration
      let termExpiration = '';
      const termText = cells[4] ? (await cells[4].textContent())?.trim() || '' : '';
      if (termText && !isHeaderKeyword(termText)) {
        termExpiration = termText;
      }

      const nameParts = cleanName.split(/\s+/);
      const memberData: RawHouseOfCouncillorsMemberData = {
        name: {
          full: cleanName,
          last: nameParts[0] || '',
          first: nameParts.slice(1).join(' ') || '',
        },
        party,
        election,
        termExpiration,
      };

      if (furigana && !isHeaderKeyword(furigana)) {
        memberData.furigana = furigana;
      }

      if (profileUrl) {
        memberData.profileUrl = profileUrl;
      }

      members.push(memberData);
    }

    return members;
  }

  private validateMemberData(member: RawHouseOfCouncillorsMemberData): boolean {
    return !!(
      member?.name?.full &&
      typeof member.name.full === 'string' &&
      member.name.full.trim().length >= 2 &&
      member.party &&
      typeof member.party === 'string' &&
      member.election &&
      typeof member.election === 'string'
    );
  }

  private normalizeFurigana(furigana: string): string {
    return furigana.replace(/\n/g, ' ').replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private parseElectionInfo(rawInfo: string): {
    election: {
      system: 'single-seat' | 'proportional-representation';
      prefecture?: string;
      area?: string;
    };
  } {
    if (!rawInfo || rawInfo === '不明') {
      return {
        election: {
          system: 'single-seat',
          prefecture: '不明',
        },
      };
    }

    // Check for proportional representation
    if (rawInfo.includes('比例')) {
      return {
        election: {
          system: 'proportional-representation',
          area: rawInfo,
        },
      };
    }

    // Check if it's a prefecture name
    const matchedPrefecture = PREFECTURES.find((pref) => rawInfo.includes(pref));
    if (matchedPrefecture) {
      return {
        election: {
          system: 'single-seat',
          prefecture: matchedPrefecture,
        },
      };
    }

    // Default fallback
    return {
      election: {
        system: 'single-seat',
        prefecture: rawInfo,
      },
    };
  }

  /**
   * Scrapes detailed profile information from a member's profile page
   */
  async scrapeProfile(profileUrl: string): Promise<HouseOfCouncillorsProfile | null> {
    if (!profileUrl || !this.browser) {
      return null;
    }

    // Validate URL scheme for security
    try {
      const url = new URL(profileUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        console.warn(`Skipping non-http(s) profile URL: ${profileUrl}`);
        return null;
      }
    } catch (_error) {
      console.warn(`Invalid profile URL: ${profileUrl}`);
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
   */
  private async extractProfileFromPage(page: Page): Promise<HouseOfCouncillorsProfile | null> {
    const profile: HouseOfCouncillorsProfile = {};

    // Helper function to clean text
    const cleanText = (text: string | null | undefined): string => {
      return text?.trim().replace(/\s+/g, ' ').replace(/[　]/g, ' ') || '';
    };

    try {
      // Extract the main heading with name and furigana
      const mainHeading = await page.locator('h1, h2, h3').first();
      if ((await mainHeading.count()) > 0) {
        const headingText = cleanText(await mainHeading.textContent());
        // Extract name and furigana from heading like "青木 愛（あおき あい）"
        const nameMatch = headingText.match(/^([^(（]+)[（(]([^)）]+)[）)]/);
        if (nameMatch?.[1] && nameMatch[2]) {
          profile.fullName = nameMatch[1].trim();
          profile.furigana = nameMatch[2].trim();
        } else {
          profile.fullName = headingText;
        }
      }

      // Extract the main profile text content
      const mainContent = await page.locator('body').textContent();
      const contentText = cleanText(mainContent);

      // Extract birth information
      const birthMatch = contentText.match(/(昭和|平成|令和)([^年]+年[^に]+に生まれる)/);
      if (birthMatch?.[1] && birthMatch[2]) {
        profile.birthDate = birthMatch[1] + birthMatch[2];

        // Extract birth place more specifically
        const birthPlaceMatch = birthMatch[2].match(/年[^に]*([^に]+)に生まれる/);
        if (birthPlaceMatch?.[1]) {
          profile.birthPlace = birthPlaceMatch[1].trim();
        }
      }

      // Extract education information
      const educationPatterns = [
        /([^、，]+大学[^、，]*卒業)/g,
        /([^、，]+大学院[^、，]*)/g,
        /([^、，]+学部[^、，]*)/g,
        /([^、，]+研究科[^、，]*)/g,
      ];

      const educationMatches: string[] = [];
      for (const pattern of educationPatterns) {
        const matches = contentText.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            educationMatches.push(match[1].trim());
          }
        }
      }

      if (educationMatches.length > 0) {
        const firstEducation = educationMatches[0];
        if (firstEducation) {
          profile.education = firstEducation;
          profile.academicBackground = educationMatches;

          // Extract university name specifically
          const uniMatch = firstEducation.match(/([^、，]+大学)/);
          if (uniMatch?.[1]) {
            profile.university = uniMatch[1];
          }
        }
      }

      // Extract election history and positions
      const electionHistoryMatch = contentText.match(/当選([^回]+回)[（(]([^）)]+)[）)]/);
      if (electionHistoryMatch?.[1] && electionHistoryMatch[2]) {
        profile.electionHistory = `当選${electionHistoryMatch[1]}`;

        // Extract election count as number
        const countMatch = electionHistoryMatch[1].match(/([\d一二三四五六七八九十]+)回/);
        if (countMatch?.[1]) {
          profile.electionCount = this.convertJapaneseNumber(countMatch[1]);
        }

        // Extract term numbers
        const termNumbers = electionHistoryMatch[2].split(/\s+/).filter((n) => n.trim());
        if (termNumbers.length > 0) {
          profile.termNumbers = termNumbers;
        }
      }

      // Extract career and position information
      const careerText = contentText;

      // Parse government positions
      const govPositions = this.extractPositions(careerText, [
        '政務次官',
        '副大臣',
        '大臣',
        '長官',
        '政務官',
      ]);

      // Parse party positions
      const partyPositions = this.extractPositions(careerText, [
        '部会長',
        '会長',
        '幹事長',
        '代理',
        '本部長',
        '調査会長',
        '総裁',
        '副総裁',
      ]);

      // Parse Diet positions
      const dietPositions = this.extractPositions(careerText, [
        '委員長',
        '議長',
        '副議長',
        '議院運営委員長',
        '予算委員長',
        '審査会長',
      ]);

      if (govPositions.length > 0 || partyPositions.length > 0 || dietPositions.length > 0) {
        profile.previousPositions = {};
        if (govPositions.length > 0) profile.previousPositions.government = govPositions;
        if (partyPositions.length > 0) profile.previousPositions.party = partyPositions;
        if (dietPositions.length > 0) profile.previousPositions.diet = dietPositions;
      }

      // Store comprehensive biography
      profile.biography = contentText;
      profile.careerHistory = careerText;

      return Object.keys(profile).length > 0 ? profile : null;
    } catch (error) {
      console.error('Error extracting profile from page:', error);
      return null;
    }
  }

  /**
   * Scrapes profiles for multiple members with rate limiting
   */
  async scrapeMultipleProfiles(
    members: HouseOfCouncillorsMember[],
    options: { maxConcurrent?: number; delay?: number } = {}
  ): Promise<void> {
    let { maxConcurrent = 3, delay = 1000 } = options;

    // Normalize inputs to prevent infinite loops and negative delays
    maxConcurrent = Math.max(1, Math.floor(Number(maxConcurrent) || 1));
    delay = Math.max(0, Math.floor(Number(delay) || 0));

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const membersWithProfiles = members.filter((m) => m.profileUrl);
    console.log(`Scraping profiles for ${membersWithProfiles.length} members...`);

    let completedCount = 0;
    let successCount = 0;

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < membersWithProfiles.length; i += maxConcurrent) {
      const batch = membersWithProfiles.slice(i, i + maxConcurrent);
      const batchNumber = Math.floor(i / maxConcurrent) + 1;
      const totalBatches = Math.ceil(membersWithProfiles.length / maxConcurrent);

      console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (${batch.length} members)...`);

      const promises = batch.map(async (member) => {
        if (member.profileUrl) {
          const profile = await this.scrapeProfile(member.profileUrl);
          completedCount++;
          if (profile) {
            member.profile = profile;
            successCount++;
            console.log(`✓ [${completedCount}/${membersWithProfiles.length}] ${member.name}`);
          } else {
            console.log(
              `✗ [${completedCount}/${membersWithProfiles.length}] ${member.name} - Failed`
            );
          }
        }
      });

      await Promise.all(promises);

      // Show batch completion summary
      const batchSuccess = batch.filter((m) => m.profile).length;
      console.log(
        `Batch ${batchNumber}/${totalBatches} completed: ${batchSuccess}/${batch.length} successful`
      );

      // Add delay between batches
      if (i + maxConcurrent < membersWithProfiles.length && delay > 0) {
        console.log(`Waiting ${delay}ms before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Final summary
    console.log('\n🎉 Profile scraping completed!');
    console.log(
      `📊 Success rate: ${successCount}/${membersWithProfiles.length} (${Math.round((successCount / membersWithProfiles.length) * 100)}%)`
    );
    if (successCount < membersWithProfiles.length) {
      console.log(`⚠️  ${membersWithProfiles.length - successCount} profiles failed to scrape`);
    }
  }

  /**
   * Helper method to extract positions from text based on keywords
   */
  private extractPositions(text: string, keywords: string[]): string[] {
    const positions: string[] = [];
    const sentences = text.split(/[○、，]/);

    for (const sentence of sentences) {
      for (const keyword of keywords) {
        if (sentence.includes(keyword)) {
          // Extract the position title, handling Japanese text patterns
          const match = sentence.match(new RegExp(`([^、，]*${keyword}[^、，]*)`));
          if (match?.[1]) {
            const position = match[1].trim();
            if (position && !positions.includes(position)) {
              positions.push(position);
            }
          }
        }
      }
    }

    return positions;
  }

  /**
   * Helper method to convert Japanese numbers to Arabic numbers
   */
  private convertJapaneseNumber(japaneseNum: string): number {
    // Simple conversion for common numbers used in election counts
    const numberMap: Record<string, number> = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
      十一: 11,
      十二: 12,
      十三: 13,
      十四: 14,
      十五: 15,
      十六: 16,
      十七: 17,
      十八: 18,
      十九: 19,
      二十: 20,
    };

    // First try direct lookup
    if (numberMap[japaneseNum]) {
      return numberMap[japaneseNum];
    }

    // Try parsing as Arabic number
    const arabicNumber = parseInt(japaneseNum, 10);
    if (!Number.isNaN(arabicNumber)) {
      return arabicNumber;
    }

    return 0;
  }
}
