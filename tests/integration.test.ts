import { test, expect } from '@playwright/test';
import { DietMemberScraper } from '../src/scraper';
import { PREFECTURES } from '../src/constants';
import type { DietMember } from '../src/types';

test.describe('Integration Tests', () => {
  let scraper: DietMemberScraper;

  test.beforeEach(async () => {
    scraper = new DietMemberScraper();
    await scraper.initialize();
  });

  test.afterEach(async () => {
    await scraper.close();
  });

  test('full scraping workflow should work end-to-end', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    
    // Basic result validation
    expect(result).toBeDefined();
    expect(result.members).toBeDefined();
    expect(Array.isArray(result.members)).toBe(true);
    expect(result.members.length).toBeGreaterThan(0);
    expect(result.source).toBe('house-of-representatives-list');
    
    // Should have a reasonable number of members (House of Representatives has ~465 members)
    expect(result.members.length).toBeGreaterThan(400);
    expect(result.members.length).toBeLessThan(500);
    
    // Sample validation on first few members
    const sampleMembers = result.members.slice(0, 10);
    
    for (const member of sampleMembers) {
      // Required fields
      expect(typeof member.name).toBe('string');
      expect(member.name.length).toBeGreaterThan(0);
      expect(typeof member.party).toBe('string');
      expect(member.party.length).toBeGreaterThan(0);
      
      // Election info
      expect(member.election).toBeDefined();
      expect(['single-seat', 'proportional-representation']).toContain(member.election.system);
      
      // Optional fields validation
      if (member.furigana) {
        expect(typeof member.furigana).toBe('string');
        expect(member.furigana.length).toBeGreaterThan(0);
      }
      
      if (member.profileUrl) {
        expect(typeof member.profileUrl).toBe('string');
        expect(member.profileUrl).toMatch(/^https?:\/\//);
      }
      
      if (member.electionCount) {
        if (typeof member.electionCount === 'number') {
          expect(member.electionCount).toBeGreaterThan(0);
        } else {
          expect(member.electionCount).toHaveProperty('house');
          expect(typeof member.electionCount.house).toBe('number');
          expect(member.electionCount.house).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should have members from all major prefectures', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    const singleSeatMembers = result.members.filter(
      member => member.election.system === 'single-seat'
    );
    
    const representedPrefectures = new Set(
      singleSeatMembers
        .map(member => member.election.prefecture)
        .filter(prefecture => prefecture && prefecture !== '不明')
    );
    
    // Should have members from major prefectures
    const majorPrefectures = ['北海道', '東京', '大阪', '神奈川', '愛知', '埼玉', '千葉', '兵庫', '福岡'];
    
    for (const prefecture of majorPrefectures) {
      expect(representedPrefectures.has(prefecture)).toBe(true);
    }
  });

  test('should have both single-seat and proportional representation members', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    
    const singleSeatCount = result.members.filter(
      member => member.election.system === 'single-seat'
    ).length;
    
    const proportionalCount = result.members.filter(
      member => member.election.system === 'proportional-representation'
    ).length;
    
    expect(singleSeatCount).toBeGreaterThan(0);
    expect(proportionalCount).toBeGreaterThan(0);
    
    // Single-seat should be majority (~289 vs ~176)
    expect(singleSeatCount).toBeGreaterThan(proportionalCount);
  });

  test('should have diverse party representation', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    const parties = new Set(result.members.map(member => member.party));
    
    // Should have multiple parties
    expect(parties.size).toBeGreaterThan(5);
    
    // Should include major parties (at least some of these should be present)
    const majorParties = [
      '自由民主党',
      '立憲民主党',
      '日本維新の会',
      '公明党',
      '国民民主党',
      '日本共産党'
    ];
    
    let foundMajorParties = 0;
    for (const party of majorParties) {
      if (Array.from(parties).some(p => p.includes(party))) {
        foundMajorParties++;
      }
    }
    
    expect(foundMajorParties).toBeGreaterThan(3); // Should find at least 4 major parties
  });

  test('should extract furigana for some members', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    const membersWithFurigana = result.members.filter(member => member.furigana);
    
    // Should extract furigana for at least some members
    expect(membersWithFurigana.length).toBeGreaterThan(0);
    
    // Validate furigana format for first few
    const sampleWithFurigana = membersWithFurigana.slice(0, 5);
    
    for (const member of sampleWithFurigana) {
      expect(member.furigana).toBeDefined();
      expect(typeof member.furigana).toBe('string');
      expect(member.furigana!.length).toBeGreaterThan(0);
      
      // Should contain hiragana characters
      expect(member.furigana).toMatch(/[あ-ん]/);
    }
  });

  test('should extract election counts for members', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    const membersWithElectionCount = result.members.filter(member => member.electionCount);
    
    // Should extract election count for at least some members
    expect(membersWithElectionCount.length).toBeGreaterThan(0);
    
    // Check House+Senate separation
    const membersWithSenateCount = membersWithElectionCount.filter(member => 
      typeof member.electionCount === 'object' && member.electionCount!.senate
    );
    
    if (membersWithSenateCount.length > 0) {
      const memberWithSenate = membersWithSenateCount[0];
      expect(memberWithSenate.electionCount).toHaveProperty('house');
      expect(memberWithSenate.electionCount).toHaveProperty('senate');
      
      if (typeof memberWithSenate.electionCount === 'object') {
        expect(typeof memberWithSenate.electionCount.house).toBe('number');
        expect(typeof memberWithSenate.electionCount.senate).toBe('number');
        expect(memberWithSenate.electionCount.house).toBeGreaterThan(0);
        expect(memberWithSenate.electionCount.senate!).toBeGreaterThan(0);
      }
    }
  });

  test('data consistency validation', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    
    // Validate single-seat consistency
    const singleSeatMembers = result.members.filter(
      member => member.election.system === 'single-seat'
    );
    
    for (const member of singleSeatMembers.slice(0, 20)) { // Check first 20
      expect(member.election.prefecture).toBeDefined();
      expect(PREFECTURES).toContain(member.election.prefecture!);
      
      if (member.election.number) {
        expect(member.election.number).toMatch(/^\d+$/);
        const districtNum = parseInt(member.election.number);
        expect(districtNum).toBeGreaterThan(0);
        expect(districtNum).toBeLessThan(30); // No prefecture should have >30 districts
      }
    }
    
    // Validate proportional representation consistency
    const proportionalMembers = result.members.filter(
      member => member.election.system === 'proportional-representation'
    );
    
    if (proportionalMembers.length > 0) {
      for (const member of proportionalMembers.slice(0, 10)) { // Check first 10
        expect(member.election.area).toBeDefined();
        expect(member.election.area).toContain('ブロック');
      }
    }
  });

  test('should handle real-world data edge cases', async () => {
    const result = await scraper.scrapeHouseOfRepresentativesList();
    
    // Check for common data quality issues
    const issues = {
      emptyNames: result.members.filter(m => !m.name || m.name.trim() === ''),
      emptyParties: result.members.filter(m => !m.party || m.party.trim() === ''),
      unknownDistricts: result.members.filter(m => 
        m.election.system === 'single-seat' && m.election.prefecture === '不明'
      ),
      invalidElectionCounts: result.members.filter(m => {
        if (!m.electionCount) return false;
        if (typeof m.electionCount === 'number') {
          return m.electionCount <= 0 || m.electionCount > 25;
        } else {
          return m.electionCount.house <= 0 || m.electionCount.house > 25 ||
                 (m.electionCount.senate && (m.electionCount.senate <= 0 || m.electionCount.senate > 25));
        }
      }),
    };
    
    // Report on data quality but don't fail the test unless issues are severe
    console.log('Data quality report:', {
      totalMembers: result.members.length,
      emptyNames: issues.emptyNames.length,
      emptyParties: issues.emptyParties.length,
      unknownDistricts: issues.unknownDistricts.length,
      invalidElectionCounts: issues.invalidElectionCounts.length,
    });
    
    // These should be minimal
    expect(issues.emptyNames.length).toBe(0);
    expect(issues.emptyParties.length).toBe(0);
    expect(issues.invalidElectionCounts.length).toBe(0);
    
    // Unknown districts should be less than 5% of total
    expect(issues.unknownDistricts.length).toBeLessThan(result.members.length * 0.05);
  });

  test('performance and timing validation', async () => {
    const startTime = Date.now();
    const result = await scraper.scrapeHouseOfRepresentativesList();
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (less than 30 seconds)
    expect(duration).toBeLessThan(30000);
    
    // Should return reasonable amount of data
    expect(result.members.length).toBeGreaterThan(400);
    
    console.log(`Scraping completed in ${duration}ms, found ${result.members.length} members`);
  }, 60000); // 60 second timeout for this test
});