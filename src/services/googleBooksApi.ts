/**
 * Google Books API integration for data enrichment
 * Free tier, no API key required (rate limited)
 */

export interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{
      type: string; // ISBN_10, ISBN_13, OTHER
      identifier: string;
    }>;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
    };
    language?: string;
  };
}

export interface GoogleBooksSearchResponse {
  kind: string;
  totalItems: number;
  items?: GoogleBooksVolume[];
}

export interface BookEnrichmentData {
  cover_url?: string;
  page_count?: number;
  description?: string;
  genres?: string[];
  publisher?: string;
  first_published?: number;
  isbn?: string;
}

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

/**
 * Search Google Books by ISBN
 */
export async function searchByISBN(isbn: string): Promise<GoogleBooksVolume | null> {
  try {
    // Clean ISBN (remove dashes, spaces)
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    const response = await fetch(`${GOOGLE_BOOKS_API}?q=isbn:${cleanIsbn}&maxResults=1`);

    if (!response.ok) {
      console.warn('Google Books API error:', response.status);
      return null;
    }

    const data: GoogleBooksSearchResponse = await response.json();
    return data.items?.[0] || null;
  } catch (error) {
    console.warn('Google Books API fetch error:', error);
    return null;
  }
}

/**
 * Search Google Books by title and author
 */
export async function searchByTitleAuthor(
  title: string,
  author?: string
): Promise<GoogleBooksVolume | null> {
  try {
    // Build search query
    let query = `intitle:${encodeURIComponent(title)}`;
    if (author) {
      query += `+inauthor:${encodeURIComponent(author)}`;
    }

    const response = await fetch(`${GOOGLE_BOOKS_API}?q=${query}&maxResults=5`);

    if (!response.ok) {
      console.warn('Google Books API error:', response.status);
      return null;
    }

    const data: GoogleBooksSearchResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      return null;
    }

    // Find best match - prefer exact title match
    const normalizedTitle = title.toLowerCase().trim();
    const bestMatch = data.items.find(item => {
      const itemTitle = item.volumeInfo.title?.toLowerCase().trim() || '';
      return itemTitle === normalizedTitle || itemTitle.startsWith(normalizedTitle);
    });

    return bestMatch || data.items[0];
  } catch (error) {
    console.warn('Google Books API fetch error:', error);
    return null;
  }
}

/**
 * Get the best available cover URL from Google Books
 */
function getBestCoverUrl(imageLinks?: GoogleBooksVolume['volumeInfo']['imageLinks']): string | undefined {
  if (!imageLinks) return undefined;

  // Prefer larger images, convert to HTTPS
  const url = imageLinks.large ||
              imageLinks.medium ||
              imageLinks.small ||
              imageLinks.thumbnail ||
              imageLinks.smallThumbnail;

  if (!url) return undefined;

  // Convert to HTTPS and request larger zoom
  return url
    .replace('http://', 'https://')
    .replace('zoom=1', 'zoom=2')
    .replace('&edge=curl', ''); // Remove curl effect
}

/**
 * Extract year from Google Books publishedDate
 */
function extractYear(publishedDate?: string): number | undefined {
  if (!publishedDate) return undefined;
  const match = publishedDate.match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Extract ISBN from Google Books volume
 */
function extractISBN(identifiers?: GoogleBooksVolume['volumeInfo']['industryIdentifiers']): string | undefined {
  if (!identifiers) return undefined;

  // Prefer ISBN-13
  const isbn13 = identifiers.find(id => id.type === 'ISBN_13');
  if (isbn13) return isbn13.identifier;

  const isbn10 = identifiers.find(id => id.type === 'ISBN_10');
  return isbn10?.identifier;
}

/**
 * Convert Google Books volume to enrichment data
 */
export function volumeToEnrichmentData(volume: GoogleBooksVolume): BookEnrichmentData {
  const { volumeInfo } = volume;

  return {
    cover_url: getBestCoverUrl(volumeInfo.imageLinks),
    page_count: volumeInfo.pageCount,
    description: volumeInfo.description,
    genres: volumeInfo.categories,
    publisher: volumeInfo.publisher,
    first_published: extractYear(volumeInfo.publishedDate),
    isbn: extractISBN(volumeInfo.industryIdentifiers),
  };
}

/**
 * Look up enrichment data for a book
 * Tries ISBN first, then falls back to title+author search
 */
export async function lookupBookEnrichment(
  title: string,
  authors: string[],
  isbn?: string
): Promise<BookEnrichmentData | null> {
  let volume: GoogleBooksVolume | null = null;

  // Try ISBN first (most accurate)
  if (isbn) {
    volume = await searchByISBN(isbn);
  }

  // Fall back to title+author search
  if (!volume) {
    volume = await searchByTitleAuthor(title, authors[0]);
  }

  if (!volume) {
    return null;
  }

  return volumeToEnrichmentData(volume);
}

/**
 * Enrich a book input with Google Books data
 * Only fills in missing fields, doesn't overwrite existing data
 */
export async function enrichBookInput<T extends {
  title: string;
  authors: string[];
  isbn?: string;
  cover_url?: string;
  page_count?: number;
  description?: string;
  genres?: string[];
  publisher?: string;
  first_published?: number;
}>(book: T): Promise<T> {
  // Check if enrichment is needed
  const needsEnrichment = !book.cover_url || !book.page_count || !book.description;

  if (!needsEnrichment) {
    return book;
  }

  const enrichment = await lookupBookEnrichment(book.title, book.authors, book.isbn);

  if (!enrichment) {
    return book;
  }

  // Merge enrichment data, only filling in missing fields
  return {
    ...book,
    cover_url: book.cover_url || enrichment.cover_url,
    page_count: book.page_count || enrichment.page_count,
    description: book.description || enrichment.description,
    genres: book.genres || enrichment.genres,
    publisher: book.publisher || enrichment.publisher,
    first_published: book.first_published || enrichment.first_published,
    isbn: book.isbn || enrichment.isbn,
  };
}

/**
 * Normalize a title for Google Books search
 * Returns multiple variants from most specific to least specific
 */
function normalizeTitleForSearch(title: string): string[] {
  const variants: string[] = [];

  // Start with the original (cleaned of quotes)
  const original = title.replace(/["']/g, '').trim();

  // 1. Main title only (before first colon) - handles subtitles
  const mainTitle = original.split(':')[0].trim();

  // 2. Remove parenthetical suffixes: "(Book 2)", "(Enhanced Edition)", etc.
  const withoutParens = mainTitle.replace(/\s*\([^)]*\)\s*$/g, '').trim();

  // 3. Remove special chars that break search
  const cleaned = withoutParens.replace(/[?!.,]/g, '').trim();

  // Add variants in order of preference (cleaned first for best match chance)
  if (cleaned && cleaned.length >= 3) variants.push(cleaned);
  if (withoutParens !== cleaned && withoutParens.length >= 3) variants.push(withoutParens);
  if (mainTitle !== withoutParens && mainTitle.length >= 3) variants.push(mainTitle);

  // Dedupe while preserving order
  return [...new Set(variants)];
}

/**
 * Single search attempt against Google Books API
 */
async function searchGoogleBooksOnce(title: string, author?: string): Promise<boolean> {
  try {
    // Don't use quotes - they make the search too strict
    let query = `intitle:${encodeURIComponent(title)}`;
    if (author) {
      query += `+inauthor:${encodeURIComponent(author)}`;
    }

    const response = await fetch(`${GOOGLE_BOOKS_API}?q=${query}&maxResults=1`);

    if (!response.ok) {
      return false; // Don't assume book on error - let other variants try
    }

    const data: GoogleBooksSearchResponse = await response.json();
    return (data.totalItems || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Check if an entry exists on Google Books (i.e., is it a real book?)
 * Tries multiple title variants to handle subtitles, series info, and special chars
 * Returns true if found, false if not found (likely a podcast/article)
 */
export async function existsOnGoogleBooks(title: string, author?: string): Promise<boolean> {
  const titleVariants = normalizeTitleForSearch(title);
  const authorName = author?.split(',')[0].trim();

  // Try each title variant
  for (const variant of titleVariants) {
    // Try with author first (more specific)
    if (authorName) {
      const found = await searchGoogleBooksOnce(variant, authorName);
      if (found) return true;
    }

    // Try title only (broader search)
    const foundTitleOnly = await searchGoogleBooksOnce(variant);
    if (foundTitleOnly) return true;
  }

  // None of the variants found - assume not a book
  return false;
}

/**
 * Quick heuristic check - returns content type if obvious, null if needs API check
 * Only returns non-null for VERY obvious cases to avoid misclassification
 */
function quickClassify(title: string, author: string): 'book' | 'podcast' | 'article' | null {
  const authorLower = author.toLowerCase();

  // Obvious podcasts - only match very clear signals
  if (authorLower.includes('podcast') ||
      authorLower.endsWith(' show') ||
      authorLower.includes('your uploads') ||
      authorLower.includes('private feed')) {
    return 'podcast';
  }

  // Episode number patterns (e.g., "147. Title" or "#147:")
  // Only match 1-3 digit numbers to avoid catching years like "2084:"
  if (/^\d{1,3}[\.\):\s]/.test(title) || /^#\d{1,3}/.test(title)) {
    return 'podcast';
  }

  // "Title | Show Name" format (podcast episode format)
  if (title.includes(' | ')) {
    return 'podcast';
  }

  // Obvious articles/newsletters
  if (authorLower.includes('newsletter') ||
      authorLower.includes('substack') ||
      authorLower.endsWith(' reads') ||
      authorLower.includes('guide chapter')) {
    return 'article';
  }

  // "Part X:" format (guide chapters)
  if (/^part \d+:/i.test(title)) {
    return 'article';
  }

  // Don't assume anything based on author name - let API check decide
  // (Podcast hosts also have normal-looking names)
  return null;
}

/**
 * Batch classify entries as books vs non-books
 * CONSERVATIVE approach: Assume everything is a book unless heuristics are SURE it's a podcast
 * (Google Books API is unreliable due to rate limiting, so we don't rely on negative results)
 */
export async function classifyWithGoogleBooks(
  entries: Array<{ title: string; author: string }>,
  _concurrency = 5,
  onProgress?: (current: number, total: number) => void
): Promise<Array<'book' | 'podcast' | 'article'>> {
  const results: Array<'book' | 'podcast' | 'article'> = new Array(entries.length);

  // Use heuristics only - assume book unless we're SURE it's a podcast/article
  for (let i = 0; i < entries.length; i++) {
    const { title, author } = entries[i];
    const quickResult = quickClassify(title, author);

    // If heuristics say podcast/article, trust that
    // Otherwise, assume it's a book (conservative approach)
    results[i] = quickResult || 'book';

    // Progress callback
    if (onProgress && i % 10 === 0) {
      onProgress(i + 1, entries.length);
    }
  }

  if (onProgress) {
    onProgress(entries.length, entries.length);
  }

  return results;
}

/**
 * Batch enrich multiple books with rate limiting
 * @param books - Array of books to enrich
 * @param delayMs - Delay between API calls (default 200ms to avoid rate limits)
 * @param onProgress - Optional callback for progress updates
 */
export async function batchEnrichBooks<T extends {
  title: string;
  authors: string[];
  isbn?: string;
  cover_url?: string;
  page_count?: number;
  description?: string;
  genres?: string[];
  publisher?: string;
  first_published?: number;
}>(
  books: T[],
  delayMs = 200,
  onProgress?: (current: number, total: number) => void
): Promise<T[]> {
  const enrichedBooks: T[] = [];

  for (let i = 0; i < books.length; i++) {
    const book = books[i];

    // Only enrich if missing key data
    if (!book.cover_url || !book.page_count) {
      try {
        const enriched = await enrichBookInput(book);
        enrichedBooks.push(enriched);
      } catch (error) {
        console.warn(`Failed to enrich "${book.title}":`, error);
        enrichedBooks.push(book);
      }

      // Rate limiting delay
      if (i < books.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } else {
      enrichedBooks.push(book);
    }

    // Progress callback
    if (onProgress) {
      onProgress(i + 1, books.length);
    }
  }

  return enrichedBooks;
}
