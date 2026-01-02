import type { OpenLibrarySearchResponse, OpenLibrarySearchResult, CreateBookInput } from '../types/book';

const BASE_URL = 'https://openlibrary.org';

/**
 * Search for books using Open Library API
 */
export async function searchBooks(query: string, limit = 10): Promise<OpenLibrarySearchResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
    fields: 'key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject',
  });

  const response = await fetch(`${BASE_URL}/search.json?${params}`);

  if (!response.ok) {
    throw new Error('Failed to search books');
  }

  const data: OpenLibrarySearchResponse = await response.json();
  return data.docs;
}

/**
 * Get cover image URL from cover ID
 */
export function getCoverUrl(coverId: number | undefined, size: 'S' | 'M' | 'L' = 'M'): string | undefined {
  if (!coverId) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/**
 * Get cover image URL from ISBN
 */
export function getCoverUrlByIsbn(isbn: string | undefined, size: 'S' | 'M' | 'L' = 'M'): string | undefined {
  if (!isbn) return undefined;
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
}

/**
 * Convert Open Library search result to CreateBookInput
 */
export function searchResultToBookInput(result: OpenLibrarySearchResult): CreateBookInput {
  return {
    title: result.title,
    authors: result.author_name || ['Unknown Author'],
    open_library_id: result.key,
    cover_url: getCoverUrl(result.cover_i, 'L'),
    page_count: result.number_of_pages_median,
    first_published: result.first_publish_year,
    genres: result.subject?.slice(0, 5), // Take first 5 subjects as genres
    isbn: result.isbn?.[0],
    source: 'manual',
    status: 'want-to-read',
  };
}

/**
 * Get detailed book information by work ID
 */
export async function getBookDetails(workId: string): Promise<{
  description?: string;
  subjects?: string[];
}> {
  // workId format: "/works/OL45804W" or "OL45804W"
  const id = workId.startsWith('/works/') ? workId : `/works/${workId}`;

  const response = await fetch(`${BASE_URL}${id}.json`);

  if (!response.ok) {
    return {};
  }

  const data = await response.json();

  return {
    description: typeof data.description === 'string'
      ? data.description
      : data.description?.value,
    subjects: data.subjects,
  };
}
