/**
 * Utility for expanding glob patterns to file paths
 */

import fg from 'fast-glob';

const GLOB_CHARS = ['*', '?', '[', ']', '{', '}'];

/**
 * Check if a path contains glob pattern characters
 */
function isGlobPattern(path: string): boolean {
  return GLOB_CHARS.some(char => path.includes(char));
}

/**
 * Check if a path is a URL
 */
function isUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}

/**
 * Expand glob patterns in an array of paths.
 * - URLs are passed through unchanged
 * - Paths with glob characters are expanded to matching files
 * - Regular paths are passed through unchanged
 *
 * @param patterns Array of file paths or glob patterns
 * @returns Array of expanded file paths
 * @throws Error if a glob pattern matches no files
 */
export async function expandGlobPatterns(patterns: string[]): Promise<string[]> {
  const expanded: string[] = [];

  for (const pattern of patterns) {
    if (isUrl(pattern)) {
      // URLs are not globbed, pass through
      expanded.push(pattern);
    } else if (isGlobPattern(pattern)) {
      // Expand glob pattern
      const matches = await fg(pattern, {
        onlyFiles: true,
        absolute: true,
      });
      if (matches.length === 0) {
        throw new Error(`No files matched pattern: ${pattern}`);
      }
      // Sort alphabetically for consistent loading order
      expanded.push(...matches.sort());
    } else {
      // Regular file path, pass through
      expanded.push(pattern);
    }
  }

  return expanded;
}
