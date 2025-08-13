import { type Browser, chromium, type Page } from 'playwright';
import { HouseOfCouncillorsScraper } from './scrapers/house-of-councillors';
import { HouseOfRepresentativesScraper } from './scrapers/house-of-representatives';
import type { DietMember, ScrapeResult } from './types';

export class DietMemberScraper {
  private browser: Browser | null = null;
  private houseOfRepresentativesScraper: HouseOfRepresentativesScraper;
  private houseOfCouncillorsScraper: HouseOfCouncillorsScraper;

  constructor() {
    this.houseOfRepresentativesScraper = new HouseOfRepresentativesScraper();
    this.houseOfCouncillorsScraper = new HouseOfCouncillorsScraper();
  }

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    // Share the same browser
    this.houseOfRepresentativesScraper.useBrowser(this.browser);
    this.houseOfCouncillorsScraper.useBrowser(this.browser);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    await this.houseOfRepresentativesScraper.close();
    await this.houseOfCouncillorsScraper.close();
  }

  /**
   * Create a new Playwright page using the internal browser instance.
   * Throws if initialize() hasn't been called.
   */
  public async newPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    return this.browser.newPage();
  }

  /**
   * For tests: force-close the underlying browser without changing public API.
   */
  public async forceCloseBrowserForTest(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    // Note: scrapers use shared browser, so no need to close them separately
  }

  /**
   * Main method to scrape House of Representatives members from all pages
   */
  async scrapeHouseOfRepresentativesList(): Promise<ScrapeResult> {
    const result = await this.houseOfRepresentativesScraper.scrapeAllPages();

    // Convert to generic DietMember format for backward compatibility
    const members: DietMember[] = result.members.map((member) => {
      const dietMember: DietMember = {
        name: member.name,
        party: member.party,
        election: member.election,
      };

      if (member.furigana) {
        dietMember.furigana = member.furigana;
      }

      if (member.profileUrl) {
        dietMember.profileUrl = member.profileUrl;
      }

      if (member.electionCount) {
        dietMember.electionCount = member.electionCount;
      }

      return dietMember;
    });

    return {
      members,
      scrapedAt: result.scrapedAt,
      source: result.source,
    };
  }

  /**
   * Main method to scrape House of Councillors members
   */
  async scrapeHouseOfCouncillorsList(): Promise<ScrapeResult> {
    const result = await this.houseOfCouncillorsScraper.scrapeAllMembers();

    // Convert to generic DietMember format for backward compatibility
    const members: DietMember[] = result.members.map((member) => {
      const dietMember: DietMember = {
        name: member.name,
        party: member.party,
        election: member.election,
      };

      if (member.furigana) {
        dietMember.furigana = member.furigana;
      }

      if (member.profileUrl) {
        dietMember.profileUrl = member.profileUrl;
      }

      return dietMember;
    });

    return {
      members,
      scrapedAt: result.scrapedAt,
      source: result.source,
    };
  }

  /**
   * Scrapes House of Representatives members with detailed profiles
   * @param options - Options for profile scraping
   * @returns Promise<HouseOfRepresentativesResult> - Complete data with profiles
   */
  async scrapeHouseOfRepresentativesWithProfiles(
    options: {
      includeProfiles?: boolean;
      maxConcurrentProfiles?: number;
      profileDelay?: number;
      maxProfiles?: number;
    } = {}
  ): Promise<import('./scrapers/house-of-representatives/types').HouseOfRepresentativesResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    return this.houseOfRepresentativesScraper.scrapeHouseOfRepresentativesWithProfiles(options);
  }

  /**
   * Scrapes House of Councillors members with detailed profiles
   * @param options - Options for profile scraping
   * @returns Promise<HouseOfCouncillorsResult> - Complete data with profiles
   */
  async scrapeHouseOfCouncillorsWithProfiles(
    options: {
      includeProfiles?: boolean;
      maxConcurrentProfiles?: number;
      profileDelay?: number;
      maxProfiles?: number;
    } = {}
  ): Promise<import('./scrapers/house-of-councillors/types').HouseOfCouncillorsResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    return this.houseOfCouncillorsScraper.scrapeHouseOfCouncillorsWithProfiles(options);
  }
}
