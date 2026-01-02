// Book status (TBD = To Be Determined, default for new/undecided books)
export type BookStatus = 'tbd' | 'want-to-read' | 'reading' | 'finished' | 'parked';

// How the book made you feel
export type BookFeeling =
  | 'inspired'
  | 'enlightened'
  | 'entertained'
  | 'moved'
  | 'challenged'
  | 'relaxed'
  | 'sad'
  | 'anxious'
  | 'bored'
  | 'confused';

// Would recommend
export type Recommendation = 'yes' | 'no' | 'maybe';

// Source of book entry
export type BookSource =
  | 'manual'
  | 'goodreads'
  | 'libby'
  | 'kindle'
  | 'kobo'
  | 'libro'
  | 'paste';

// Shelf/Collection (like Trip in trip-scribe)
export interface Shelf {
  id: string;
  user_id: string;
  name: string; // "2025 Reads", "Favorites", "Work Books"
  description?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Book (like SavedPlace in trip-scribe)
export interface Book {
  id: string;
  user_id: string;
  shelf_id?: string;

  // From Open Library API
  open_library_id?: string;
  title: string;
  authors: string[];
  cover_url?: string;
  page_count?: number;
  first_published?: number;
  genres?: string[];
  isbn?: string;
  description?: string;
  publisher?: string;

  // User data
  status: BookStatus;
  rating?: number; // 1-5
  feelings?: BookFeeling[];
  notes?: string;
  quotes?: string[];
  would_recommend?: Recommendation;

  // NEW: Enhanced tracking
  worldview_impact?: string; // "Changed how I think about X"
  tags?: string[]; // Custom tags: "theology", "business", "parenting"
  progress?: number; // 0-100 reading percentage
  highlights?: string[]; // Imported highlights/notes from reading apps

  // Dates (auto-captured on status change)
  date_added: string;
  date_started?: string;
  date_finished?: string;

  // Community ratings (from Goodreads, etc.)
  goodreads_avg_rating?: number; // e.g., 4.12
  goodreads_rating_count?: number; // e.g., 125000

  // Source tracking
  source: BookSource;
  source_id?: string; // Original ID from source (Goodreads Book Id, etc.)

  created_at: string;
  updated_at: string;
}

// For creating a new book
export interface CreateBookInput {
  title: string;
  authors: string[];
  open_library_id?: string;
  cover_url?: string;
  page_count?: number;
  first_published?: number;
  genres?: string[];
  isbn?: string;
  description?: string;
  publisher?: string;
  status?: BookStatus;
  rating?: number;
  notes?: string;
  shelf_id?: string;
  source?: BookSource;
  source_id?: string;
  tags?: string[];
  worldview_impact?: string;
  highlights?: string[];
  progress?: number;
  date_added?: string;
  date_started?: string;
  date_finished?: string;
  goodreads_avg_rating?: number;
  goodreads_rating_count?: number;
}

// Open Library API response types
export interface OpenLibrarySearchResult {
  key: string; // e.g., "/works/OL45804W"
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number; // cover ID
  isbn?: string[];
  number_of_pages_median?: number;
  subject?: string[];
}

export interface OpenLibrarySearchResponse {
  numFound: number;
  start: number;
  docs: OpenLibrarySearchResult[];
}

// Year in Review stats
export interface YearStats {
  year: number;
  booksRead: number;
  pagesRead: number;
  averageRating: number;
  booksPerMonth: { month: string; count: number }[];
  genreBreakdown: { genre: string; count: number }[];
  tagBreakdown: { tag: string; count: number }[];
  topRatedBooks: Book[];
  readingStreak: number; // consecutive months with at least 1 book
}

// Goodreads CSV row
export interface GoodreadsBook {
  bookId: string;
  title: string;
  author: string;
  authorLf: string;
  additionalAuthors: string;
  isbn: string;
  isbn13: string;
  myRating: number;
  averageRating: number;
  publisher: string;
  binding: string;
  numberOfPages: number;
  yearPublished: number;
  originalPublicationYear: number;
  dateRead: string;
  dateAdded: string;
  bookshelves: string;
  bookshelvesWithPositions: string;
  exclusiveShelf: string;
  myReview: string;
  spoiler: string;
  privateNotes: string;
  readCount: number;
  ownedCopies: number;
}

// Libby CSV row
export interface LibbyLoan {
  cover: string;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  timestamp: string;
  activity: 'Borrowed' | 'Returned';
  details: string;
  library: string;
}

// Import result
export interface ImportResult {
  added: number;
  skipped: number;
  merged: number;
  errors: string[];
}
