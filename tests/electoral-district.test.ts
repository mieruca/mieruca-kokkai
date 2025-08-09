import { test, expect } from '@playwright/test';
import { PREFECTURES } from '../src/constants';

test.describe('Electoral District Parsing', () => {
  // Helper function to simulate the electoral district extraction logic
  function parseElectoralDistrict(cellTexts: string[]): {
    system: 'single-seat' | 'proportional-representation';
    prefecture?: string;
    number?: string;
    area?: string;
  } {
    for (const text of cellTexts) {
      if (!text) continue;
      
      // Check for prefecture + number pattern (single-seat constituencies)
      for (const prefecture of PREFECTURES) {
        if (text.startsWith(prefecture)) {
          const numberPart = text.substring(prefecture.length);
          
          // Check if it's followed by a number
          if (/^\d+$/.test(numberPart)) {
            return {
              system: 'single-seat',
              prefecture,
              number: numberPart,
            };
          }
        }
      }
      
      // Check for proportional representation blocks
      const proportionalBlocks = [
        '比例北海道ブロック', '比例東北ブロック', '比例北関東ブロック',
        '比例南関東ブロック', '比例東京ブロック', '比例北陸信越ブロック',
        '比例東海ブロック', '比例近畿ブロック', '比例中国ブロック',
        '比例四国ブロック', '比例九州ブロック'
      ];
      
      for (const block of proportionalBlocks) {
        if (text.includes(block) || text === block) {
          return {
            system: 'proportional-representation',
            area: block,
          };
        }
      }
      
      // Simplified block names
      const simpleBlocks = [
        '北海道', '東北', '北関東', '南関東', '東京', 
        '北陸信越', '東海', '近畿', '中国', '四国', '九州'
      ];
      
      for (const block of simpleBlocks) {
        if (text === `比例${block}` || text === block) {
          return {
            system: 'proportional-representation',
            area: `比例${block}ブロック`,
          };
        }
      }
    }
    
    // Default fallback
    return {
      system: 'single-seat',
      prefecture: '不明',
    };
  }

  test('should parse single-seat constituencies correctly', () => {
    const testCases = [
      {
        input: ['北海道1'],
        expected: {
          system: 'single-seat',
          prefecture: '北海道',
          number: '1',
        }
      },
      {
        input: ['東京1'],
        expected: {
          system: 'single-seat',
          prefecture: '東京',
          number: '1',
        }
      },
      {
        input: ['大阪14'],
        expected: {
          system: 'single-seat',
          prefecture: '大阪',
          number: '14',
        }
      },
      {
        input: ['岡山1'],
        expected: {
          system: 'single-seat',
          prefecture: '岡山',
          number: '1',
        }
      },
      {
        input: ['沖縄1'],
        expected: {
          system: 'single-seat',
          prefecture: '沖縄',
          number: '1',
        }
      }
    ];

    for (const testCase of testCases) {
      const result = parseElectoralDistrict(testCase.input);
      expect(result).toEqual(testCase.expected);
    }
  });

  test('should parse proportional representation blocks', () => {
    const testCases = [
      {
        input: ['比例北海道ブロック'],
        expected: {
          system: 'proportional-representation',
          area: '比例北海道ブロック',
        }
      },
      {
        input: ['比例東京ブロック'],
        expected: {
          system: 'proportional-representation',
          area: '比例東京ブロック',
        }
      },
      {
        input: ['比例九州ブロック'],
        expected: {
          system: 'proportional-representation',
          area: '比例九州ブロック',
        }
      },
    ];

    for (const testCase of testCases) {
      const result = parseElectoralDistrict(testCase.input);
      expect(result).toEqual(testCase.expected);
    }
  });

  test('should handle simplified proportional block names', () => {
    const testCases = [
      {
        input: ['比例北海道'],
        expected: {
          system: 'proportional-representation',
          area: '比例北海道ブロック',
        }
      },
      {
        input: ['東京'],
        expected: {
          system: 'proportional-representation',
          area: '比例東京ブロック',
        }
      },
      {
        input: ['九州'],
        expected: {
          system: 'proportional-representation',
          area: '比例九州ブロック',
        }
      },
    ];

    for (const testCase of testCases) {
      const result = parseElectoralDistrict(testCase.input);
      expect(result).toEqual(testCase.expected);
    }
  });

  test('should prioritize single-seat over proportional when ambiguous', () => {
    // When both patterns could match, single-seat should take precedence
    const result = parseElectoralDistrict(['東京1', '比例東京']);
    expect(result).toEqual({
      system: 'single-seat',
      prefecture: '東京',
      number: '1',
    });
  });

  test('should handle all 47 prefectures for single-seat', () => {
    for (let i = 0; i < PREFECTURES.length; i++) {
      const prefecture = PREFECTURES[i];
      const testInput = [`${prefecture}1`];
      
      const result = parseElectoralDistrict(testInput);
      expect(result).toEqual({
        system: 'single-seat',
        prefecture: prefecture,
        number: '1',
      });
    }
  });

  test('should ignore pure numbers that are not districts', () => {
    const testCases = [
      ['13'], // Pure number - should not be treated as district
      ['5'], // Election count - should not be district
      ['25'], // Another election count
    ];

    for (const testCase of testCases) {
      const result = parseElectoralDistrict(testCase);
      expect(result.system).toBe('single-seat');
      expect(result.prefecture).toBe('不明'); // Should fallback to unknown
    }
  });

  test('should handle invalid or malformed district data', () => {
    const testCases = [
      [''], // Empty string
      [' '], // Whitespace
      ['invalid'], // Random text
      ['東京abc'], // Prefecture + non-number
      ['abc1'], // Non-prefecture + number
      ['東京'], // Prefecture without number (should be proportional)
    ];

    for (const testCase of testCases) {
      const result = parseElectoralDistrict(testCase);
      expect(result).toBeDefined();
      expect(['single-seat', 'proportional-representation']).toContain(result.system);
    }
  });

  test('should handle multi-digit district numbers', () => {
    const testCases = [
      {
        input: ['東京25'],
        expected: {
          system: 'single-seat',
          prefecture: '東京',
          number: '25',
        }
      },
      {
        input: ['神奈川18'],
        expected: {
          system: 'single-seat',
          prefecture: '神奈川',
          number: '18',
        }
      },
    ];

    for (const testCase of testCases) {
      const result = parseElectoralDistrict(testCase.input);
      expect(result).toEqual(testCase.expected);
    }
  });

  test('should find district in mixed cell data', () => {
    const testCases = [
      {
        input: ['', 'invalid', '岡山1', '13'],
        expected: {
          system: 'single-seat',
          prefecture: '岡山',
          number: '1',
        }
      },
      {
        input: ['abc', '', '比例九州ブロック'],
        expected: {
          system: 'proportional-representation',
          area: '比例九州ブロック',
        }
      },
    ];

    for (const testCase of testCases) {
      const result = parseElectoralDistrict(testCase.input);
      expect(result).toEqual(testCase.expected);
    }
  });

  test('should validate all proportional representation blocks', () => {
    const allBlocks = [
      '比例北海道ブロック', '比例東北ブロック', '比例北関東ブロック',
      '比例南関東ブロック', '比例東京ブロック', '比例北陸信越ブロック',
      '比例東海ブロック', '比例近畿ブロック', '比例中国ブロック',
      '比例四国ブロック', '比例九州ブロック'
    ];

    for (const block of allBlocks) {
      const result = parseElectoralDistrict([block]);
      expect(result).toEqual({
        system: 'proportional-representation',
        area: block,
      });
    }
  });
});