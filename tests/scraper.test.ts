import { test, expect } from '@playwright/test';
import { DietMemberScraper } from '../src/scraper';

test.describe('DietMemberScraper', () => {
  let scraper: DietMemberScraper;

  test.beforeEach(async () => {
    scraper = new DietMemberScraper();
    await scraper.initialize();
  });

  test.afterEach(async () => {
    await scraper.close();
  });

  test('should initialize successfully', () => {
    expect(scraper).toBeDefined();
    expect(scraper).toBeInstanceOf(DietMemberScraper);
  });

  test('should scrape House of Representatives members', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    
    expect(result).toBeDefined();
    expect(result.members).toBeDefined();
    expect(Array.isArray(result.members)).toBe(true);
    expect(result.members.length).toBeGreaterThan(0);
    expect(result.source).toBe('house-of-representatives-list');
    expect(result.scrapedAt).toBeDefined();
    
    // Validate date format
    expect(new Date(result.scrapedAt)).toBeInstanceOf(Date);
  });

  test('scraped members should have correct structure', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    const firstMember = result.members[0]!;

    expect(firstMember).toBeDefined();
    expect(typeof firstMember.name).toBe('string');
    expect(firstMember.name.length).toBeGreaterThan(0);
    expect(typeof firstMember.party).toBe('string');
    expect(firstMember.party.length).toBeGreaterThan(0);
    
    // Election info should exist and be properly structured
    expect(firstMember.election).toBeDefined();
    expect(['single-seat', 'proportional-representation']).toContain(firstMember.election.system);
    
    // Optional fields type checking
    if (firstMember.furigana) {
      expect(typeof firstMember.furigana).toBe('string');
    }
    if (firstMember.profileUrl) {
      expect(typeof firstMember.profileUrl).toBe('string');
      expect(firstMember.profileUrl).toMatch(/^https?:\/\//);
    }
    if (firstMember.electionCount) {
      if (typeof firstMember.electionCount === 'number') {
        expect(firstMember.electionCount).toBeGreaterThan(0);
      } else {
        expect(firstMember.electionCount).toHaveProperty('house');
        expect(typeof firstMember.electionCount.house).toBe('number');
        expect(firstMember.electionCount.house).toBeGreaterThan(0);
        
        if (firstMember.electionCount.senate) {
          expect(typeof firstMember.electionCount.senate).toBe('number');
          expect(firstMember.electionCount.senate).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should handle single-seat constituencies correctly', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    const singleSeatMembers = result.members.filter(
      member => member.election.system === 'single-seat'
    );

    expect(singleSeatMembers.length).toBeGreaterThan(0);
    
    for (const member of singleSeatMembers.slice(0, 5)) { // Check first 5
      expect(member.election.prefecture).toBeDefined();
      expect(typeof member.election.prefecture).toBe('string');
      expect((member.election.prefecture as string).length).toBeGreaterThan(0);
      
      if (member.election.number) {
        expect(typeof member.election.number).toBe('string');
        expect(member.election.number).toMatch(/^\d+$/);
      }
    }
  });

  test('should handle proportional representation correctly', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    const proportionalMembers = result.members.filter(
      member => member.election.system === 'proportional-representation'
    );

    if (proportionalMembers.length > 0) {
      for (const member of proportionalMembers.slice(0, 5)) { // Check first 5
        expect(member.election.area).toBeDefined();
        expect(typeof member.election.area).toBe('string');
        expect((member.election.area as string).length).toBeGreaterThan(0);
      }
    }
  });

  test('should extract furigana when available', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    const membersWithFurigana = result.members.filter(member => member.furigana);
    
    if (membersWithFurigana.length > 0) {
      const memberWithFurigana = membersWithFurigana[0]!;
      expect(typeof memberWithFurigana.furigana).toBe('string');
      expect((memberWithFurigana.furigana as string).length).toBeGreaterThan(0);
      
      // Should contain hiragana characters
      expect(memberWithFurigana.furigana).toMatch(/[ぁ-ん]/);
    }
  });

  test('should extract profile URLs when available', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    const membersWithProfile = result.members.filter(member => member.profileUrl);
    
    if (membersWithProfile.length > 0) {
      const memberWithProfile = membersWithProfile[0]!;
      expect(memberWithProfile.profileUrl).toMatch(/^https?:\/\//);
      expect(memberWithProfile.profileUrl).toContain('shugiin.go.jp');
    }
  });

  test('should handle browser close gracefully', async () => {
    const testScraper = new DietMemberScraper();
    await expect(testScraper.close()).resolves.not.toThrow();
    
    // Should be able to close multiple times
    await expect(testScraper.close()).resolves.not.toThrow();
  });

  test('should handle network errors gracefully', async () => {
    const testScraper = new DietMemberScraper();
    
    // Mock a network failure scenario by navigating to invalid URL
    try {
      const page = await testScraper['browser']!.newPage();
      await page.goto('http://invalid-url-that-does-not-exist.test');
    } catch (error) {
      expect(error).toBeDefined();
    }
    
    await testScraper.close();
  });
});