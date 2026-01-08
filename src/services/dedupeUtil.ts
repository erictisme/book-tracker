import type { CreateBookInput, Book } from '../types/book';

/**
 * Normalize title for comparison (lowercase, remove punctuation)
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    // Remove common edition/version suffixes
    .replace(/\s*\(.*?edition.*?\)/gi, '')
    .replace(/\s*\(.*?version.*?\)/gi, '')
    .replace(/\s*,?\s*(expanded|enhanced|revised|updated|complete|unabridged)\s*edition/gi, '')
    .replace(/\s*\(goodreads author\)/gi, '')
    // Remove punctuation and normalize spaces
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get core title (remove subtitle after colon/dash)
 */
export function getCoreTitle(title: string): string {
  return title
    .toLowerCase()
    .split(/[:\-–—]/)[0] // Split on colon or various dashes
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize author for comparison
 * Handles variations like "C. S. Lewis" vs "C.S. Lewis" vs "CS Lewis"
 */
export function normalizeAuthor(author: string): string {
  return author
    .toLowerCase()
    // Remove common suffixes
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical (Goodreads Author)
    .replace(/,?\s*(jr\.?|sr\.?|ph\.?d\.?|md|ii|iii|iv)$/gi, '')
    // Remove all punctuation and extra spaces
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get author's last name for comparison
 */
export function getAuthorLastName(author: string): string {
  const normalized = normalizeAuthor(author);
  const parts = normalized.split(' ');
  // Return last part (last name)
  return parts[parts.length - 1] || normalized;
}

/**
 * Calculate simple similarity between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1;

  // Check if shorter is contained in longer
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }

  // Simple word overlap
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  let matches = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) matches++;
  }
  const totalWords = Math.max(wordsA.size, wordsB.size);
  return totalWords > 0 ? matches / totalWords : 0;
}

/**
 * Check if two authors are likely the same person
 */
function authorsMatch(authorsA: string[], authorsB: string[]): boolean {
  const normalizedA = authorsA.map(normalizeAuthor).filter(Boolean);
  const normalizedB = authorsB.map(normalizeAuthor).filter(Boolean);

  // Get last names too for fallback matching
  const lastNamesA = authorsA.map(getAuthorLastName).filter(Boolean);
  const lastNamesB = authorsB.map(getAuthorLastName).filter(Boolean);

  // Check if any author matches
  return normalizedA.some(authorA =>
    normalizedB.some(authorB => {
      if (!authorA || !authorB) return false;
      // Exact match after normalization
      if (authorA === authorB) return true;
      // One contains the other (handles "C S Lewis" vs "Clive Staples Lewis")
      if (authorA.includes(authorB) || authorB.includes(authorA)) return true;
      return false;
    })
  ) || lastNamesA.some(lastA =>
    lastNamesB.some(lastB => {
      // Last name match (handles different first name formats)
      if (lastA && lastB && lastA.length >= 3 && lastA === lastB) return true;
      return false;
    })
  );
}

/**
 * Check if two books are likely the same
 * Works with both CreateBookInput and Book types
 */
export function isSameBook(
  a: { title: string; authors: string[]; isbn?: string },
  b: { title: string; authors: string[]; isbn?: string }
): boolean {
  // ISBN match is definitive
  if (a.isbn && b.isbn && a.isbn === b.isbn) {
    return true;
  }

  // Check if authors match
  if (!authorsMatch(a.authors, b.authors)) return false;

  // Full normalized title match
  const titleA = normalizeTitle(a.title);
  const titleB = normalizeTitle(b.title);
  if (titleA === titleB) return true;

  // Core title match (without subtitle) - catches "Life 3.0" vs "Life 3.0: Being Human..."
  const coreA = getCoreTitle(a.title);
  const coreB = getCoreTitle(b.title);
  if (coreA === coreB && coreA.length >= 3) return true;

  // One title contains the other (for short vs long versions)
  if (titleA.length >= 5 && titleB.length >= 5) {
    if (titleA.includes(titleB) || titleB.includes(titleA)) return true;
  }

  // Fuzzy match: high word overlap with same author
  const similarity = stringSimilarity(coreA, coreB);
  if (similarity >= 0.7 && coreA.length >= 5) return true;

  return false;
}

/**
 * Generate a deduplication key for a book
 * Used for faster lookups in large datasets
 */
export function getDedupeKey(title: string, author: string): string {
  const coreTitle = getCoreTitle(title);
  const normAuthor = normalizeAuthor(author.split(',')[0]); // First author only
  return `${coreTitle}|${normAuthor}`;
}

/**
 * Deduplicate a list of CreateBookInput
 * Keeps the "best" version when duplicates are found:
 * - Prefers entries with rating
 * - Prefers entries with more data (notes, tags, etc.)
 * - Prefers entries with longer titles (usually more complete)
 */
export function dedupeBookInputs(books: CreateBookInput[]): CreateBookInput[] {
  const seen = new Map<string, CreateBookInput>();

  for (const book of books) {
    const key = getDedupeKey(book.title, book.authors[0] || '');

    // Check if we've seen this key before
    if (seen.has(key)) {
      const existing = seen.get(key)!;

      // Also do a full isSameBook check for edge cases
      if (isSameBook(book, existing)) {
        // Merge: keep the better one
        const merged = mergeDuplicates(existing, book);
        seen.set(key, merged);
        continue;
      }
    }

    // Also check against all existing entries with isSameBook
    // (catches cases where dedupeKey differs but they're still duplicates)
    let foundDupe = false;
    for (const [existingKey, existing] of seen.entries()) {
      if (isSameBook(book, existing)) {
        const merged = mergeDuplicates(existing, book);
        seen.set(existingKey, merged);
        foundDupe = true;
        break;
      }
    }

    if (!foundDupe) {
      seen.set(key, book);
    }
  }

  return Array.from(seen.values());
}

/**
 * Merge two duplicate book entries, keeping the best data from each
 */
function mergeDuplicates(a: CreateBookInput, b: CreateBookInput): CreateBookInput {
  // Score each entry
  const scoreA = scoreBookInput(a);
  const scoreB = scoreBookInput(b);

  // Start with the higher-scored entry
  const base = scoreA >= scoreB ? { ...a } : { ...b };
  const other = scoreA >= scoreB ? b : a;

  // Merge in missing data from the other
  if (!base.rating && other.rating) base.rating = other.rating;
  if (!base.notes && other.notes) base.notes = other.notes;
  if (!base.isbn && other.isbn) base.isbn = other.isbn;
  if (!base.cover_url && other.cover_url) base.cover_url = other.cover_url;
  if (!base.page_count && other.page_count) base.page_count = other.page_count;
  if (!base.publisher && other.publisher) base.publisher = other.publisher;
  if (!base.goodreads_avg_rating && other.goodreads_avg_rating) {
    base.goodreads_avg_rating = other.goodreads_avg_rating;
  }
  if (!base.goodreads_rating_count && other.goodreads_rating_count) {
    base.goodreads_rating_count = other.goodreads_rating_count;
  }
  if (!base.date_started && other.date_started) base.date_started = other.date_started;
  if (!base.date_finished && other.date_finished) base.date_finished = other.date_finished;

  // Merge tags
  if (other.tags && other.tags.length > 0) {
    const existingTags = new Set(base.tags || []);
    other.tags.forEach(t => existingTags.add(t));
    base.tags = Array.from(existingTags);
  }

  // Prefer the more "complete" status
  // finished > reading > want-to-read > tbd
  const statusPriority: Record<string, number> = {
    'finished': 4,
    'reading': 3,
    'want-to-read': 2,
    'parked': 1,
    'tbd': 0,
  };
  const aPriority = statusPriority[a.status || 'tbd'] || 0;
  const bPriority = statusPriority[b.status || 'tbd'] || 0;
  if (bPriority > aPriority) base.status = b.status;
  if (aPriority > bPriority) base.status = a.status;

  return base;
}

/**
 * Score a book input based on completeness
 */
function scoreBookInput(book: CreateBookInput): number {
  let score = 0;

  if (book.rating) score += 10;
  if (book.goodreads_avg_rating) score += 5;
  if (book.notes) score += 3;
  if (book.status === 'finished') score += 3;
  if (book.status === 'reading') score += 2;
  if (book.isbn) score += 2;
  if (book.cover_url) score += 2;
  if (book.page_count) score += 1;
  if (book.tags && book.tags.length > 0) score += 1;
  if (book.title.length > 30) score += 1; // Longer titles usually more complete
  if (book.date_finished) score += 2;

  return score;
}

/**
 * Check if a new book input is a duplicate of any existing book
 */
export function isDuplicateOfExisting(
  input: CreateBookInput,
  existingBooks: Book[]
): Book | null {
  for (const existing of existingBooks) {
    if (isSameBook(input, existing)) {
      return existing;
    }
  }
  return null;
}
