import type { GoodreadsBook, CreateBookInput, BookStatus } from '../types/book';
import { dedupeBookInputs } from './dedupeUtil';

/**
 * Parse Goodreads CSV export
 * CSV columns: Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,
 * My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,
 * Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,
 * Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies
 */
export function parseGoodreadsCSV(csvText: string): GoodreadsBook[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  // Skip header row
  const books: GoodreadsBook[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < 24) continue;

    books.push({
      bookId: values[0],
      title: values[1],
      author: values[2],
      authorLf: values[3],
      additionalAuthors: values[4],
      isbn: cleanISBN(values[5]),
      isbn13: cleanISBN(values[6]),
      myRating: parseInt(values[7]) || 0,
      averageRating: parseFloat(values[8]) || 0,
      publisher: values[9],
      binding: values[10],
      numberOfPages: parseInt(values[11]) || 0,
      yearPublished: parseInt(values[12]) || 0,
      originalPublicationYear: parseInt(values[13]) || 0,
      dateRead: values[14],
      dateAdded: values[15],
      bookshelves: values[16],
      bookshelvesWithPositions: values[17],
      exclusiveShelf: values[18],
      myReview: values[19],
      spoiler: values[20],
      privateNotes: values[21],
      readCount: parseInt(values[22]) || 0,
      ownedCopies: parseInt(values[23]) || 0,
    });
  }

  return books;
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
        // Escaped quote
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
 * Clean ISBN format (Goodreads wraps in ="...")
 */
function cleanISBN(isbn: string): string {
  // Remove ="..." wrapper
  return isbn.replace(/^="?|"?$/g, '').trim();
}

/**
 * Map Goodreads exclusive shelf to BookStatus
 */
function mapShelfToStatus(shelf: string): BookStatus {
  switch (shelf.toLowerCase()) {
    case 'read':
      return 'finished';
    case 'currently-reading':
    case 'to-read':
    default:
      // Default to TBD - user can manually change status
      return 'tbd';
  }
}

/**
 * Parse Goodreads date format (YYYY/MM/DD or empty)
 */
function parseGoodreadsDate(dateStr: string): string | undefined {
  if (!dateStr || dateStr.trim() === '') return undefined;
  // Convert YYYY/MM/DD to ISO format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  return undefined;
}

/**
 * Convert Goodreads book to CreateBookInput
 */
export function goodreadsToBookInput(gr: GoodreadsBook): CreateBookInput {
  // Combine review and private notes
  let notes = '';
  if (gr.myReview) {
    notes = gr.myReview;
  }
  if (gr.privateNotes) {
    notes = notes ? `${notes}\n\n---\nPrivate Notes:\n${gr.privateNotes}` : gr.privateNotes;
  }

  // Parse authors (combine main author with additional authors)
  const authors = [gr.author];
  if (gr.additionalAuthors) {
    authors.push(...gr.additionalAuthors.split(',').map(a => a.trim()).filter(Boolean));
  }

  // Extract tags from bookshelves (excluding standard ones)
  const standardShelves = ['to-read', 'currently-reading', 'read'];
  const tags = gr.bookshelves
    .split(',')
    .map(s => s.trim())
    .filter(s => s && !standardShelves.includes(s.toLowerCase()));

  return {
    title: gr.title,
    authors,
    isbn: gr.isbn13 || gr.isbn || undefined,
    page_count: gr.numberOfPages || undefined,
    first_published: gr.originalPublicationYear || gr.yearPublished || undefined,
    publisher: gr.publisher || undefined,
    status: mapShelfToStatus(gr.exclusiveShelf),
    rating: gr.myRating > 0 ? gr.myRating : undefined,
    notes: notes || undefined,
    tags: tags.length > 0 ? tags : undefined,
    source: 'goodreads',
    source_id: gr.bookId,
    date_added: parseGoodreadsDate(gr.dateAdded),
    date_finished: parseGoodreadsDate(gr.dateRead),
    goodreads_avg_rating: gr.averageRating > 0 ? gr.averageRating : undefined,
  };
}

/**
 * Parse and convert entire Goodreads CSV to book inputs
 * Automatically deduplicates within the import
 */
export function importGoodreadsCSV(csvText: string): CreateBookInput[] {
  const goodreadsBooks = parseGoodreadsCSV(csvText);
  const bookInputs = goodreadsBooks.map(goodreadsToBookInput);
  return dedupeBookInputs(bookInputs);
}
