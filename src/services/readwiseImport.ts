import type { CreateBookInput } from '../types/book';
import { dedupeBookInputs } from './dedupeUtil';
import { classifyPodcastsWithAI, isAIParsingAvailable } from './aiParser';
import { classifyWithGoogleBooks } from './googleBooksApi';

/**
 * Readwise CSV row interface
 * Columns: Highlight,Book Title,Book Author,Amazon Book ID,Note,Color,Tags,Location Type,Location,Highlighted at,Document tags
 */
interface ReadwiseRow {
  highlight: string;
  bookTitle: string;
  bookAuthor: string;
  amazonBookId?: string;
  note?: string;
  color?: string;
  tags?: string;
  locationType?: string;
  location?: string;
  highlightedAt?: string;
  documentTags?: string;
}

/**
 * Grouped book data from Readwise
 */
interface ReadwiseBook {
  title: string;
  authors: string[];
  amazonBookId?: string;
  highlights: string[];
  notes: string[];
  tags: Set<string>;
  latestHighlightDate?: string;
}

/**
 * Parse CSV text properly, handling quoted fields with commas AND newlines
 * Returns array of rows, each row is an array of field values
 */
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote ("") -> single quote
        currentField += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      // Row separator (handle both \n and \r\n)
      if (char === '\r') i++; // Skip the \n in \r\n
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f)) { // Only add non-empty rows
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else if (char === '\r' && !inQuotes) {
      // Standalone \r as row separator
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Don't forget the last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parse Readwise CSV to row objects
 */
function parseReadwiseCSV(csvText: string): ReadwiseRow[] {
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) return [];

  // Skip header row
  const dataRows = allRows.slice(1);
  const rows: ReadwiseRow[] = [];

  for (const values of dataRows) {
    // Need at least title (index 1) and author (index 2)
    if (values.length < 3 || !values[1]) continue;

    rows.push({
      highlight: values[0] || '',
      bookTitle: values[1] || '',
      bookAuthor: values[2] || '',
      amazonBookId: values[3] || undefined,
      note: values[4] || undefined,
      color: values[5] || undefined,
      tags: values[6] || undefined,
      locationType: values[7] || undefined,
      location: values[8] || undefined,
      highlightedAt: values[9] || undefined,
      documentTags: values[10] || undefined,
    });
  }

  return rows;
}

/**
 * Parse author string that may contain multiple authors
 * e.g., "Author One, Author Two, and Author Three"
 */
function parseAuthors(authorStr: string): string[] {
  if (!authorStr) return ['Unknown'];

  // Handle "Author One, Author Two, and Author Three" format
  const authors = authorStr
    .replace(/ and /gi, ', ')
    .split(',')
    .map(a => a.trim())
    .filter(Boolean);

  return authors.length > 0 ? authors : ['Unknown'];
}

/**
 * Parse Readwise timestamp to ISO date
 * Format: "2026-01-07 14:35:57.300886+00:00"
 */
function parseReadwiseDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;

  // Extract just the date part (YYYY-MM-DD)
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : undefined;
}

/**
 * Create a book key for grouping (normalized title + first author)
 */
function getBookKey(title: string, author: string): string {
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedAuthor = author.toLowerCase().trim().split(',')[0]; // First author only
  return `${normalizedTitle}|||${normalizedAuthor}`;
}

/**
 * Check if an entry should be completely skipped (garbage data)
 */
function shouldSkipEntry(title: string, _author: string): boolean {
  const titleLower = title.toLowerCase();

  // Skip transcript fragments and speaker labels
  if (titleLower.includes('transcript:') || titleLower.startsWith('speaker ')) {
    return true;
  }

  // Skip URLs or very short titles
  if (title.startsWith('http') || title.length < 3) {
    return true;
  }

  return false;
}

/**
 * Basic heuristic check for obvious podcasts (fallback when AI not available)
 * Intentionally conservative to avoid false positives
 */
function isObviousPodcast(title: string, author: string): boolean {
  const authorLower = author.toLowerCase();

  // Only very obvious signals
  if (authorLower.includes('podcast') ||
      authorLower.includes('your uploads') ||
      authorLower.includes('private feed for')) {
    return true;
  }

  // Title has podcast episode format: "Title | Show Name"
  if (title.includes(' | ')) {
    return true;
  }

  return false;
}

/**
 * Grouped book data from Readwise (extended with isPodcast flag)
 */
interface ReadwiseBookExtended extends ReadwiseBook {
  isPodcast: boolean;
}

/**
 * Group Readwise rows by book
 */
function groupByBook(rows: ReadwiseRow[]): Map<string, ReadwiseBookExtended> {
  const bookMap = new Map<string, ReadwiseBookExtended>();

  for (const row of rows) {
    if (!row.bookTitle) continue;

    // Skip garbage entries (transcripts, speaker labels, etc.)
    if (shouldSkipEntry(row.bookTitle, row.bookAuthor)) continue;

    // Basic heuristic for obvious podcasts (AI will refine this later)
    const isPodcast = isObviousPodcast(row.bookTitle, row.bookAuthor);

    const key = getBookKey(row.bookTitle, row.bookAuthor);

    if (!bookMap.has(key)) {
      bookMap.set(key, {
        title: row.bookTitle,
        authors: parseAuthors(row.bookAuthor),
        amazonBookId: row.amazonBookId,
        highlights: [],
        notes: [],
        tags: new Set(),
        latestHighlightDate: undefined,
        isPodcast,
      });
    }

    const book = bookMap.get(key)!;

    // Add highlight if not empty
    if (row.highlight && row.highlight.trim()) {
      book.highlights.push(row.highlight.trim());
    }

    // Add note if not empty
    if (row.note && row.note.trim()) {
      book.notes.push(row.note.trim());
    }

    // Add tags
    if (row.tags) {
      row.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => book.tags.add(t));
    }
    if (row.documentTags) {
      row.documentTags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => book.tags.add(t));
    }

    // Track latest highlight date
    const highlightDate = parseReadwiseDate(row.highlightedAt);
    if (highlightDate) {
      if (!book.latestHighlightDate || highlightDate > book.latestHighlightDate) {
        book.latestHighlightDate = highlightDate;
      }
    }
  }

  return bookMap;
}

/**
 * Convert ReadwiseBook to CreateBookInput
 */
function readwiseToBookInput(book: ReadwiseBookExtended): CreateBookInput {
  // Combine notes with separators
  const combinedNotes = book.notes.length > 0
    ? book.notes.join('\n\n---\n\n')
    : undefined;

  // Build tags - include "podcast" tag if it's a podcast
  const tags = new Set(book.tags);
  if (book.isPodcast) {
    tags.add('podcast');
  }

  return {
    title: book.title,
    authors: book.authors,
    status: 'finished', // Assumption: if you highlighted it, you read/listened to it
    source: book.isPodcast ? 'snipd' : 'readwise',
    source_id: book.amazonBookId,
    highlights: book.highlights.length > 0 ? book.highlights : undefined,
    notes: combinedNotes,
    tags: tags.size > 0 ? Array.from(tags) : undefined,
    date_finished: book.latestHighlightDate,
    date_added: book.latestHighlightDate, // Use highlight date as fallback
  };
}

/**
 * Parse and convert entire Readwise CSV to book inputs
 * Groups highlights by book and deduplicates
 */
export function importReadwiseCSV(csvText: string): CreateBookInput[] {
  const rows = parseReadwiseCSV(csvText);
  const bookMap = groupByBook(rows);
  const bookInputs = Array.from(bookMap.values()).map(readwiseToBookInput);
  return dedupeBookInputs(bookInputs);
}

/**
 * Use AI to classify books vs podcasts and update the entries
 * Returns the same array with updated source and tags for podcasts
 */
export async function classifyReadwiseBooksWithAI(
  books: CreateBookInput[]
): Promise<CreateBookInput[]> {
  if (!isAIParsingAvailable() || books.length === 0) {
    return books;
  }

  // Prepare entries for classification
  const entries = books.map(b => ({
    title: b.title,
    author: b.authors.join(', '),
  }));

  // Get AI classification
  const isPodcastFlags = await classifyPodcastsWithAI(entries);

  // Apply classification to books
  return books.map((book, i) => {
    const isPodcast = isPodcastFlags[i];

    if (isPodcast) {
      // Mark as podcast
      const tags = new Set(book.tags || []);
      tags.add('podcast');

      return {
        ...book,
        source: 'snipd' as const,
        tags: Array.from(tags),
      };
    }

    return book;
  });
}

/**
 * Use Google Books API to classify books vs podcasts/articles (scalable approach)
 * If a title+author exists on Google Books, it's a book; otherwise podcast/article
 * @param books - Array of books to classify
 * @param onProgress - Optional callback for progress updates (current, total)
 * @returns Same array with non-books marked with source='snipd' and appropriate tag
 */
export async function classifyReadwiseBooksWithGoogleBooks(
  books: CreateBookInput[],
  onProgress?: (current: number, total: number) => void
): Promise<CreateBookInput[]> {
  if (books.length === 0) {
    return books;
  }

  // Prepare entries for classification
  const entries = books.map(b => ({
    title: b.title,
    author: b.authors.join(', '),
  }));

  // Get Google Books classification - returns 'book' | 'podcast' | 'article'
  const contentTypes = await classifyWithGoogleBooks(entries, 5, onProgress);

  // Apply classification to books
  return books.map((book, i) => {
    const contentType = contentTypes[i];

    if (contentType !== 'book') {
      // Mark as non-book (podcast or article)
      const tags = new Set(book.tags || []);
      tags.add(contentType); // 'podcast' or 'article'

      return {
        ...book,
        source: 'snipd' as const,
        tags: Array.from(tags),
      };
    }

    return book;
  });
}

/**
 * Get stats about the Readwise import before processing
 */
export function getReadwiseImportStats(csvText: string): {
  totalHighlights: number;
  uniqueBooks: number;
  bookTitles: string[];
} {
  const rows = parseReadwiseCSV(csvText);
  const bookMap = groupByBook(rows);

  return {
    totalHighlights: rows.length,
    uniqueBooks: bookMap.size,
    bookTitles: Array.from(bookMap.values()).map(b => b.title),
  };
}
