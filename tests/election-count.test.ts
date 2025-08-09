import { test, expect } from '@playwright/test';

test.describe('Election Count Parsing', () => {
  // Helper function to simulate the election count extraction logic
  function parseElectionCount(cellTexts: string[]): number | { house: number; senate?: number } | undefined {
    for (const text of cellTexts) {
      if (!text) continue;
      
      // Check for pattern like "1（参2）", "5（参1）" - House + (Senate)
      const senateMatch = text.match(/^(\d+)（参(\d+)）$/);
      if (senateMatch) {
        const houseCount = parseInt(senateMatch[1] as string);
        const senateCount = parseInt(senateMatch[2] as string);
        return { house: houseCount, senate: senateCount };
      }
      
      // Check for pure number (House only)
      if (/^\d+$/.test(text)) {
        const num = parseInt(text);
        if (num >= 1 && num <= 25) { // Reasonable range for election counts
          return { house: num };
        }
      }
    }
    return undefined;
  }

  test('should parse House-only election counts', () => {
    const testCases = [
      { input: ['1'], expected: { house: 1 } },
      { input: ['5'], expected: { house: 5 } },
      { input: ['13'], expected: { house: 13 } },
      { input: ['25'], expected: { house: 25 } },
      { input: ['', '3', ''], expected: { house: 3 } },
    ];

    for (const testCase of testCases) {
      const result = parseElectionCount(testCase.input);
      expect(result).toEqual(testCase.expected);
    }
  });

  test('should parse House + Senate election counts', () => {
    const testCases = [
      { input: ['1（参2）'], expected: { house: 1, senate: 2 } },
      { input: ['5（参1）'], expected: { house: 5, senate: 1 } },
      { input: ['3（参3）'], expected: { house: 3, senate: 3 } },
      { input: ['', '2（参4）', ''], expected: { house: 2, senate: 4 } },
    ];

    for (const testCase of testCases) {
      const result = parseElectionCount(testCase.input);
      expect(result).toEqual(testCase.expected);
    }
  });

  test('should ignore invalid election counts', () => {
    const testCases = [
      ['0'], // Too low
      ['26'], // Too high
      ['50'], // Way too high
      ['abc'], // Not a number
      ['1（参）'], // Malformed Senate pattern
      ['（参2）'], // Missing House count
      ['1（2）'], // Missing 参 indicator
      [''], // Empty
      [' '], // Whitespace only
    ];

    for (const testCase of testCases) {
      const result = parseElectionCount(testCase);
      expect(result).toBeUndefined();
    }
  });

  test('should handle mixed valid and invalid data', () => {
    const testCases = [
      { 
        input: ['abc', '50', '5', 'def'], 
        expected: { house: 5 } // Should find the valid one
      },
      { 
        input: ['invalid', '3（参2）', '100'], 
        expected: { house: 3, senate: 2 } // Should find the House+Senate pattern
      },
      { 
        input: ['0', '26', 'abc'], 
        expected: undefined // All invalid
      },
    ];

    for (const testCase of testCases) {
      const result = parseElectionCount(testCase.input);
      expect(result).toEqual(testCase.expected);
    }
  });

  test('should find first valid pattern in order', () => {
    // Should return the first valid pattern found
    const result = parseElectionCount(['5', '3（参2）', '7']);
    expect(result).toEqual({ house: 5 }); // First valid pattern found
  });

  test('should handle edge cases in Senate pattern', () => {
    const testCases = [
      { input: ['10（参1）'], expected: { house: 10, senate: 1 } },
      { input: ['1（参10）'], expected: { house: 1, senate: 10 } },
      { input: ['25（参25）'], expected: { house: 25, senate: 25 } }, // Max values
    ];

    for (const testCase of testCases) {
      const result = parseElectionCount(testCase.input);
      expect(result).toEqual(testCase.expected);
    }
  });

  test('should validate Senate pattern regex correctly', () => {
    const validPatterns = [
      '1（参2）',
      '10（参5）',
      '25（参25）',
    ];

    const invalidPatterns = [
      '1 （参2）', // Space before parenthesis
      '1（ 参2）', // Space after opening parenthesis
      '1（参 2）', // Space before Senate number
      '1（参2 ）', // Space before closing parenthesis
      '1（参2）extra', // Extra characters
      'extra1（参2）', // Prefix characters
      '1（参2', // Missing closing parenthesis
      '1参2）', // Missing opening parenthesis
      '1（参）', // Missing Senate number
      '（参2）', // Missing House number
    ];

    for (const pattern of validPatterns) {
      const match = pattern.match(/^(\d+)（参(\d+)）$/);
      expect(match).not.toBeNull();
      expect(match?.length).toBe(3);
    }

    for (const pattern of invalidPatterns) {
      const match = pattern.match(/^(\d+)（参(\d+)）$/);
      expect(match).toBeNull();
    }
  });
});