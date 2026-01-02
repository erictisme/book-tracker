import type { CreateBookInput } from '../types/book';

/**
 * Parse pasted Kindle library text
 * Format is typically:
 * Title
 * Author
 * Title
 * Author
 * ...
 *
 * May include noise like "Find books like yours", "X books", etc.
 */
export function parseKindleText(text: string): { title: string; author: string }[] {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const books: { title: string; author: string }[] = [];

  // Lines to skip (noise from Kindle UI)
  const skipPatterns = [
    /^find books like/i,
    /^\d+ books?$/i,
    /^\d+ titles?$/i,
    /^kindle/i,
    /^your library/i,
    /^sort by/i,
    /^filter/i,
    /^page \d+/i,
    /^showing/i,
  ];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip noise lines
    if (skipPatterns.some(pattern => pattern.test(line))) {
      i++;
      continue;
    }

    // Look for title + author pairs
    // A title line is followed by an author line
    // Heuristics:
    // - Author names are typically shorter than titles
    // - Author names often don't have colons (subtitles have colons)
    // - If we have two consecutive non-noise lines, treat as title + author

    const potentialTitle = line;
    const potentialAuthor = lines[i + 1];

    if (potentialAuthor && !skipPatterns.some(p => p.test(potentialAuthor))) {
      // Check if it looks like a valid title/author pair
      // Authors usually don't have subtitles (colons), titles often do
      const authorHasColon = potentialAuthor.includes(':');

      // If the second line looks like an author (no colon, shorter, or contains common author patterns)
      const looksLikeAuthor =
        !authorHasColon ||
        potentialAuthor.length < potentialTitle.length ||
        /^[A-Z][a-z]+ [A-Z]\.? [A-Z][a-z]+$/.test(potentialAuthor) || // "John A. Smith"
        /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(potentialAuthor); // "John Smith"

      if (looksLikeAuthor) {
        books.push({
          title: cleanTitle(potentialTitle),
          author: cleanAuthor(potentialAuthor),
        });
        i += 2; // Skip both lines
        continue;
      }
    }

    // If we couldn't pair, might be a standalone title
    // Or formatting issue - skip single line
    i++;
  }

  return books;
}

/**
 * Clean up title (remove series info, etc.)
 */
function cleanTitle(title: string): string {
  // Remove things like "(Book 1)" or "[Series Name]"
  return title
    .replace(/\s*\([^)]*book\s*\d+[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]+\]/g, '')
    .trim();
}

/**
 * Clean up author name
 */
function cleanAuthor(author: string): string {
  return author.trim();
}

/**
 * Convert parsed Kindle book to CreateBookInput
 */
export function kindleToBookInput(book: { title: string; author: string }): CreateBookInput {
  return {
    title: book.title,
    authors: [book.author],
    status: 'tbd', // Kindle books are owned but we don't know read status
    source: 'kindle',
  };
}

/**
 * Parse and convert entire Kindle text to book inputs
 */
export function importKindleText(text: string): CreateBookInput[] {
  const parsed = parseKindleText(text);
  return parsed.map(kindleToBookInput);
}
