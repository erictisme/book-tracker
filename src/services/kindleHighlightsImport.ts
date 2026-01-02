/**
 * Parse Kindle "My Clippings.txt" file
 *
 * Format:
 * Book Title (Author Name)
 * - Your Highlight on page X | Location Y-Z | Added on Monday, January 1, 2024 10:00:00 AM
 *
 * The highlighted text goes here
 * ==========
 */

export interface KindleHighlight {
  bookTitle: string;
  author: string;
  type: 'highlight' | 'note' | 'bookmark';
  page?: number;
  location?: string;
  date?: string;
  content: string;
}

export interface BookHighlights {
  bookTitle: string;
  author: string;
  highlights: string[];
  notes: string[];
}

/**
 * Parse My Clippings.txt content
 */
export function parseKindleClippings(text: string): KindleHighlight[] {
  const entries = text.split('==========').filter(e => e.trim());
  const highlights: KindleHighlight[] = [];

  for (const entry of entries) {
    const lines = entry.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) continue;

    // First line: "Book Title (Author Name)" or just "Book Title"
    const titleLine = lines[0];
    let bookTitle = titleLine;
    let author = '';

    // Extract author from parentheses at end
    const authorMatch = titleLine.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (authorMatch) {
      bookTitle = authorMatch[1].trim();
      author = authorMatch[2].trim();
    }

    // Second line: metadata "- Your Highlight on page X | Location Y-Z | Added on ..."
    const metaLine = lines[1];
    let type: 'highlight' | 'note' | 'bookmark' = 'highlight';
    let page: number | undefined;
    let location: string | undefined;
    let date: string | undefined;

    if (metaLine.toLowerCase().includes('note')) {
      type = 'note';
    } else if (metaLine.toLowerCase().includes('bookmark')) {
      type = 'bookmark';
    }

    // Extract page number
    const pageMatch = metaLine.match(/page\s+(\d+)/i);
    if (pageMatch) {
      page = parseInt(pageMatch[1], 10);
    }

    // Extract location
    const locationMatch = metaLine.match(/location\s+([\d-]+)/i);
    if (locationMatch) {
      location = locationMatch[1];
    }

    // Extract date
    const dateMatch = metaLine.match(/Added on\s+(.+)$/i);
    if (dateMatch) {
      date = dateMatch[1];
    }

    // Content is everything after metadata line
    const content = lines.slice(2).join('\n').trim();

    // Skip bookmarks (no content) and empty highlights
    if (type === 'bookmark' || !content) continue;

    highlights.push({
      bookTitle,
      author,
      type,
      page,
      location,
      date,
      content,
    });
  }

  return highlights;
}

/**
 * Group highlights by book
 */
export function groupHighlightsByBook(highlights: KindleHighlight[]): BookHighlights[] {
  const bookMap = new Map<string, BookHighlights>();

  for (const h of highlights) {
    // Create key from normalized title
    const key = h.bookTitle.toLowerCase().trim();

    if (!bookMap.has(key)) {
      bookMap.set(key, {
        bookTitle: h.bookTitle,
        author: h.author,
        highlights: [],
        notes: [],
      });
    }

    const book = bookMap.get(key)!;

    // Update author if we have one and current is empty
    if (h.author && !book.author) {
      book.author = h.author;
    }

    if (h.type === 'highlight') {
      // Avoid duplicates
      if (!book.highlights.includes(h.content)) {
        book.highlights.push(h.content);
      }
    } else if (h.type === 'note') {
      if (!book.notes.includes(h.content)) {
        book.notes.push(h.content);
      }
    }
  }

  return Array.from(bookMap.values());
}

/**
 * Normalize title for matching
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find best matching book title from existing books
 */
export function findMatchingBook(
  highlightTitle: string,
  existingTitles: string[]
): string | null {
  const normalizedHighlight = normalizeTitle(highlightTitle);

  // Exact match first
  for (const title of existingTitles) {
    if (normalizeTitle(title) === normalizedHighlight) {
      return title;
    }
  }

  // Partial match (highlight title contains existing or vice versa)
  for (const title of existingTitles) {
    const normalizedExisting = normalizeTitle(title);
    if (
      normalizedHighlight.includes(normalizedExisting) ||
      normalizedExisting.includes(normalizedHighlight)
    ) {
      return title;
    }
  }

  return null;
}

/**
 * Import result for highlights
 */
export interface HighlightImportResult {
  matched: number;
  unmatched: number;
  totalHighlights: number;
  unmatchedBooks: string[];
}
