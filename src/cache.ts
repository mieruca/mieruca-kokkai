import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { HouseOfRepresentativesResult } from './scrapers/house-of-representatives/types';

export interface CacheOptions {
  maxAgeHours?: number; // Default: 24 hours
  forceRefresh?: boolean; // Force refresh even if cache exists
}

/**
 * Check if cached data exists and is still valid
 */
export function isCacheValid(filePath: string, maxAgeHours: number = 24): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  const stats = statSync(filePath);
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const fileAge = Date.now() - stats.mtime.getTime();

  return fileAge < maxAgeMs;
}

/**
 * Load cached data from out directory
 */
export function loadCachedData(filename: string): HouseOfRepresentativesResult | null {
  const outputDir = join(process.cwd(), 'out');
  const filePath = join(outputDir, filename);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as HouseOfRepresentativesResult;

    // Validate that the data structure is correct
    if (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.members) &&
      typeof data.scrapedAt === 'string' &&
      typeof data.source === 'string'
    ) {
      return data;
    }
  } catch (error) {
    console.warn(`Failed to parse cached data from ${filePath}:`, error);
  }

  return null;
}

/**
 * Check if we should use cached data
 */
export function shouldUseCachedData(
  filename: string,
  options: CacheOptions = {}
): { useCache: boolean; cachedData: HouseOfRepresentativesResult | null } {
  const { maxAgeHours = 24, forceRefresh = false } = options;

  if (forceRefresh) {
    return { useCache: false, cachedData: null };
  }

  const outputDir = join(process.cwd(), 'out');
  const filePath = join(outputDir, filename);

  if (!isCacheValid(filePath, maxAgeHours)) {
    return { useCache: false, cachedData: null };
  }

  const cachedData = loadCachedData(filename);
  if (!cachedData) {
    return { useCache: false, cachedData: null };
  }

  return { useCache: true, cachedData };
}

/**
 * Get cache info for display
 */
export function getCacheInfo(filename: string): string | null {
  const outputDir = join(process.cwd(), 'out');
  const filePath = join(outputDir, filename);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const stats = statSync(filePath);
    const ageMs = Date.now() - stats.mtime.getTime();
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
    const ageMinutes = Math.floor((ageMs % (60 * 60 * 1000)) / (60 * 1000));

    if (ageHours > 0) {
      return `${ageHours}時間${ageMinutes}分前`;
    } else {
      return `${ageMinutes}分前`;
    }
  } catch (_error) {
    return null;
  }
}
