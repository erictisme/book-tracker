import type { LibbyLoan, CreateBookInput } from '../types/book';
import { dedupeBookInputs } from './dedupeUtil';

/**
 * Parse Libby timeline CSV export
 * CSV columns: cover,title,author,publisher,isbn,timestamp,activity,details,library
 */
export function parseLibbyCSV(csvText: string): LibbyLoan[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  const loans: LibbyLoan[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < 9) continue;

    loans.push({
      cover: values[0],
      title: values[1],
      author: values[2],
      publisher: values[3],
      isbn: values[4],
      timestamp: values[5],
      activity: values[6] as 'Borrowed' | 'Returned',
      details: values[7],
      library: values[8],
    });
  }

  return loans;
}

/**
 * Parse a single CSV line, handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse Libby timestamp format: "December 28, 2025 14:49"
 */
function parseLibbyTimestamp(timestamp: string): string | undefined {
  if (!timestamp) return undefined;

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return undefined;
  }
}

/**
 * Normalize title for better deduplication
 * Removes subtitles, edition info, and normalizes formatting
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[:;]\s*.+$/, '') // Remove subtitle after : or ;
    .replace(/\s*\([^)]+\)\s*$/, '') // Remove parenthetical at end
    .replace(/\s*\[[^\]]+\]\s*$/, '') // Remove bracketed text at end
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize author for better matching
 */
function normalizeAuthor(author: string): string {
  // Take first author only, normalize
  const firstAuthor = author.split(/[,&]|and\s/i)[0];
  return firstAuthor
    .toLowerCase()
    .replace(/\s*(jr\.?|sr\.?|iii?|iv|ph\.?d\.?|m\.?d\.?|dr\.?)\s*$/i, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Group Libby loans by book title + author to consolidate multiple borrows
 * Returns the most recent borrow with all timestamps
 */
interface ConsolidatedBook {
  loan: LibbyLoan;
  borrowDates: string[];
  returnDates: string[];
}

function consolidateLoans(loans: LibbyLoan[]): ConsolidatedBook[] {
  const bookMap = new Map<string, ConsolidatedBook>();

  for (const loan of loans) {
    // Create unique key from normalized title + author
    const normalizedTitle = normalizeTitle(loan.title);
    const normalizedAuthor = normalizeAuthor(loan.author);
    const key = `${normalizedTitle}|${normalizedAuthor}`;

    if (!bookMap.has(key)) {
      bookMap.set(key, {
        loan,
        borrowDates: [],
        returnDates: [],
      });
    }

    const consolidated = bookMap.get(key)!;
    const date = parseLibbyTimestamp(loan.timestamp);

    if (date) {
      if (loan.activity === 'Borrowed') {
        consolidated.borrowDates.push(date);
      } else if (loan.activity === 'Returned') {
        consolidated.returnDates.push(date);
      }
    }

    // Keep the loan with the best cover URL
    if (loan.cover && (!consolidated.loan.cover || loan.cover.length > consolidated.loan.cover.length)) {
      consolidated.loan = { ...consolidated.loan, cover: loan.cover };
    }
  }

  return Array.from(bookMap.values());
}

/**
 * Convert Libby loan to CreateBookInput
 */
export function libbyToBookInput(consolidated: ConsolidatedBook): CreateBookInput {
  const { loan, borrowDates, returnDates } = consolidated;

  // Sort dates chronologically
  borrowDates.sort();
  returnDates.sort();

  // Use earliest borrow as date_started, latest return as date_finished
  const dateStarted = borrowDates.length > 0 ? borrowDates[0] : undefined;
  let dateFinished = returnDates.length > 0 ? returnDates[returnDates.length - 1] : undefined;

  // Determine status:
  // 1. If returned -> finished
  // 2. Otherwise -> tbd (let user decide, don't assume)
  const status: 'finished' | 'tbd' = dateFinished ? 'finished' : 'tbd';

  return {
    title: loan.title,
    authors: [loan.author],
    cover_url: loan.cover || undefined,
    isbn: loan.isbn || undefined,
    status,
    source: 'libby',
    date_added: dateStarted,
    date_started: dateStarted,
    date_finished: dateFinished,
    // Store borrow count in notes
    notes: borrowDates.length > 1 ? `Borrowed ${borrowDates.length} times from ${loan.library}` : undefined,
  };
}

/**
 * Parse and convert entire Libby CSV to book inputs
 * Consolidates multiple borrows and deduplicates
 */
export function importLibbyCSV(csvText: string): CreateBookInput[] {
  const loans = parseLibbyCSV(csvText);
  const consolidated = consolidateLoans(loans);
  const bookInputs = consolidated.map(libbyToBookInput);
  return dedupeBookInputs(bookInputs);
}
