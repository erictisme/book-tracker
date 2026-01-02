import type { CreateBookInput } from '../types/book';
import { dedupeBookInputs } from './dedupeUtil';

export interface KoboBook {
  title: string;
  author: string;
  series?: string;
  genre?: string;
  status: string; // "Unread", "X% read", "100% played", "Buy Now", "Preview"
  dateAdded: string;
  progress?: number;
}

/**
 * Parse Kobo library data from web copy-paste
 * The data comes from kobo.com/account/library in a table format
 *
 * Format when copy-pasted from Kobo web:
 * - Title
 * - Author (may include "+N" for multiple authors)
 * - [Series name - optional]
 * - Genre
 * - StatusDate (concatenated! e.g., "Unread1/1/2026", "65% read12/18/2025")
 */
export function parseKoboLibrary(text: string): KoboBook[] {
  const books: KoboBook[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Skip header if present
  let startIdx = 0;
  if (lines[0]?.toLowerCase().includes('title') && lines[0]?.toLowerCase().includes('author')) {
    startIdx = 1;
  }

  // Strategy: Find all lines that end with a date (status+date lines)
  // Then work backwards to extract book info
  const statusDatePattern = /(\d{1,2}\/\d{1,2}\/\d{4})$/;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(statusDatePattern);

    if (dateMatch) {
      // Found a status+date line, extract the book
      const dateAdded = dateMatch[1];
      const statusPart = line.slice(0, -dateAdded.length).trim();

      // Look backwards to find the book info
      const book = extractBookBackwards(lines, i, statusPart, dateAdded);
      if (book) {
        books.push(book);
      }
    }
  }

  return books;
}

/**
 * Extract book info by looking backwards from the status+date line
 *
 * Kobo table structure (backwards from date):
 * StatusDate → Genre → [Series] → Author → Title
 */
function extractBookBackwards(
  lines: string[],
  statusDateIdx: number,
  statusPart: string,
  dateAdded: string
): KoboBook | null {
  // Parse status and progress
  const { status, progress } = parseStatusPart(statusPart);

  // Collect lines backwards, skipping noise
  const relevantLines: string[] = [];
  let lookBackIdx = statusDateIdx - 1;

  while (lookBackIdx >= 0 && relevantLines.length < 6) {
    const line = lines[lookBackIdx];

    // Stop if we hit another book's status+date
    if (/\d{1,2}\/\d{1,2}\/\d{4}$/.test(line)) {
      break;
    }

    // Skip noise
    if (!line || line === 'Actions' || line.toLowerCase().startsWith('buy now') || line === 'Preview') {
      lookBackIdx--;
      continue;
    }

    relevantLines.push(line);
    lookBackIdx--;
  }

  if (relevantLines.length < 2) {
    return null;
  }

  // Now classify lines by position and content
  // Order: Genre (closest to date), Series (optional), Author, Title (furthest)
  let genre: string | undefined;
  let series: string | undefined;
  let author: string | undefined;
  let title: string | undefined;

  for (let i = 0; i < relevantLines.length; i++) {
    const line = relevantLines[i];

    if (i === 0 && isGenre(line)) {
      // First line is usually genre
      genre = line;
    } else if (!series && looksLikeSeries(line)) {
      // Series names: "Travel Guide", "Book 1 - Series Name", etc.
      series = line;
    } else if (!author && looksLikeAuthor(line)) {
      // Author patterns: "Name, Name +2", "Name PhD", etc.
      author = line;
    } else if (!title) {
      // Everything else before author is title
      if (author) {
        title = line;
        break;
      } else {
        // If we haven't found author yet, this might be author or title
        // Save as potential author, keep looking
        if (!author) {
          author = line;
        }
      }
    }
  }

  // If we have author but no title, last line might be title
  if (author && !title && relevantLines.length > 1) {
    title = relevantLines[relevantLines.length - 1];
    // Make sure title isn't same as author
    if (title === author) {
      title = undefined;
    }
  }

  // Validate minimum requirements
  if (!title || !author) {
    return null;
  }

  return {
    title,
    author,
    series,
    genre,
    status,
    dateAdded,
    progress,
  };
}

function parseStatusPart(statusPart: string): { status: string; progress?: number } {
  const lower = statusPart.toLowerCase();

  // Check for progress percentage
  const progressMatch = statusPart.match(/(\d+)%\s*(read|played)/i);
  if (progressMatch) {
    return {
      status: statusPart,
      progress: parseInt(progressMatch[1], 10),
    };
  }

  // Other statuses
  if (lower === 'unread' || lower === 'unplayed' || lower === '' || lower === 'preview') {
    return { status: statusPart || 'Unread' };
  }

  // Buy Now with price
  if (lower.startsWith('buy now')) {
    return { status: 'Buy Now' };
  }

  return { status: statusPart || 'Unread' };
}

function isGenre(line: string): boolean {
  const genres = [
    'nonfiction', 'fiction', 'business', 'biography', 'memoir',
    'travel', 'fiction & literature', 'business & finance',
  ];
  const lower = line.toLowerCase();
  return genres.some(g => lower === g || lower.startsWith(g));
}

function looksLikeAuthor(line: string): boolean {
  // Authors often have:
  // - Comma separating names: "John Smith, Jane Doe"
  // - "+N" suffix: "Author Name +2"
  // - PhD, Dr., etc.
  return (
    /,\s*[A-Z]/.test(line) || // Comma followed by capital letter
    /\+\d+$/.test(line) ||    // +N suffix
    /\b(PhD|Dr\.|MD|Jr\.|Sr\.)\b/i.test(line) || // Titles
    /^[A-Z][a-z]+\s+[A-Z]/.test(line) // Name pattern
  );
}

function looksLikeSeries(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /Book\s*\d+/i.test(line) ||
    /Series/i.test(line) ||
    /Vol(ume)?\.?\s*\d+/i.test(line) ||
    /Part\s*\d+/i.test(line) ||
    /Guide$/i.test(line) ||  // "Travel Guide", "Road Trips Guide"
    /Collection$/i.test(line) ||
    /Edition$/i.test(line) ||
    lower === 'travel guide' ||
    lower === 'road trips guide' ||
    lower.includes('signature collection') ||
    lower.includes('best trips')
  );
}

/**
 * Parse date from Kobo format (M/D/YYYY) to ISO format
 */
function parseKoboDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;

  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;

  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Convert Kobo book to CreateBookInput
 */
export function koboToBookInput(kobo: KoboBook): CreateBookInput | null {
  // Skip items that aren't actually owned (Buy Now, Preview)
  const statusLower = kobo.status.toLowerCase();
  if (statusLower.startsWith('buy now') || statusLower === 'preview') {
    return null;
  }

  // Map Kobo status to our status
  // Default to TBD - only mark as finished if 100%
  // Don't auto-mark as "reading" since partial progress doesn't mean actively reading
  let status: CreateBookInput['status'] = 'tbd';
  const progress = kobo.progress;

  if (progress === 100 || statusLower.includes('100%')) {
    status = 'finished';
  }
  // Everything else stays as TBD - user can manually change if actively reading

  // Parse authors (handle "Author1, Author2 +N" format)
  const authorClean = kobo.author.replace(/\s*\+\d+$/, ''); // Remove "+2" etc
  const authors = authorClean.split(',').map(a => a.trim()).filter(Boolean);

  // Parse date
  const dateAdded = parseKoboDate(kobo.dateAdded);

  return {
    title: kobo.title,
    authors: authors.length > 0 ? authors : ['Unknown'],
    status,
    progress,
    source: 'kobo',
    date_added: dateAdded,
    // If finished, use date_added as approximate finish date
    date_finished: status === 'finished' ? dateAdded : undefined,
  };
}

/**
 * Import Kobo library text and convert to book inputs
 * Automatically deduplicates within the import
 */
export function importKoboLibrary(text: string): CreateBookInput[] {
  const koboBooks = parseKoboLibrary(text);
  const bookInputs = koboBooks
    .map(koboToBookInput)
    .filter((b): b is CreateBookInput => b !== null);
  return dedupeBookInputs(bookInputs);
}
