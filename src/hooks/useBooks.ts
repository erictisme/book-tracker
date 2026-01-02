import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Book, BookStatus, CreateBookInput, ImportResult } from '../types/book';
import { isSameBook, dedupeBookInputs, isDuplicateOfExisting } from '../services/dedupeUtil';

const STORAGE_KEY = 'book-tracker-books';

/**
 * Convert Supabase row to Book type
 */
function rowToBook(row: Record<string, unknown>): Book {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    open_library_id: row.open_library_id as string | undefined,
    title: row.title as string,
    authors: row.authors as string[],
    cover_url: row.cover_url as string | undefined,
    page_count: row.page_count as number | undefined,
    first_published: row.first_published as number | undefined,
    genres: row.genres as string[] | undefined,
    isbn: row.isbn as string | undefined,
    description: row.description as string | undefined,
    publisher: row.publisher as string | undefined,
    status: row.status as BookStatus,
    rating: row.rating as number | undefined,
    feelings: row.feelings as Book['feelings'],
    notes: row.notes as string | undefined,
    quotes: row.quotes as string[] | undefined,
    would_recommend: row.would_recommend as Book['would_recommend'],
    worldview_impact: row.worldview_impact as string | undefined,
    tags: row.tags as string[] | undefined,
    progress: row.progress as number | undefined,
    highlights: row.highlights as string[] | undefined,
    date_added: row.date_added as string,
    date_started: row.date_started as string | undefined,
    date_finished: row.date_finished as string | undefined,
    goodreads_avg_rating: row.goodreads_avg_rating as number | undefined,
    goodreads_rating_count: row.goodreads_rating_count as number | undefined,
    source: row.source as Book['source'],
    source_id: row.source_id as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/**
 * Hook to manage books with Supabase persistence
 */
export function useBooks() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load books from Supabase on mount / user change
  useEffect(() => {
    if (!user) {
      setBooks([]);
      setIsLoading(false);
      return;
    }

    async function loadBooks() {
      if (!user) return;
      setIsLoading(true);
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load books:', error);
      } else {
        setBooks((data || []).map(rowToBook));
      }
      setIsLoading(false);
    }

    loadBooks();
  }, [user]);

  // Migrate localStorage data on first login
  useEffect(() => {
    if (!user || isLoading || books.length > 0) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const localBooks = JSON.parse(stored) as Book[];
      if (localBooks.length > 0) {
        // Migrate to Supabase
        migrateLocalBooks(localBooks);
      }
    } catch (e) {
      console.error('Failed to parse stored books:', e);
    }
  }, [user, isLoading, books.length]);

  async function migrateLocalBooks(localBooks: Book[]) {
    if (!user) return;

    const booksToInsert = localBooks.map(book => ({
      ...book,
      id: undefined, // Let Supabase generate new IDs
      user_id: user.id,
    }));

    const { data, error } = await supabase
      .from('books')
      .insert(booksToInsert)
      .select();

    if (error) {
      console.error('Failed to migrate books:', error);
    } else {
      setBooks((data || []).map(rowToBook));
      // Clear localStorage after successful migration
      localStorage.removeItem(STORAGE_KEY);
      console.log(`Migrated ${data?.length || 0} books from localStorage`);
    }
  }

  const addBook = useCallback(async (input: CreateBookInput): Promise<Book | null> => {
    if (!user) return null;

    const now = new Date().toISOString();
    const newBook = {
      user_id: user.id,
      open_library_id: input.open_library_id,
      title: input.title,
      authors: input.authors,
      cover_url: input.cover_url,
      page_count: input.page_count,
      first_published: input.first_published,
      genres: input.genres,
      isbn: input.isbn,
      description: input.description,
      publisher: input.publisher,
      status: input.status || 'tbd',
      rating: input.rating,
      notes: input.notes,
      tags: input.tags,
      worldview_impact: input.worldview_impact,
      highlights: input.highlights,
      source: input.source || 'manual',
      source_id: input.source_id,
      date_added: input.date_added || now,
      date_started: input.date_started,
      date_finished: input.date_finished,
      goodreads_avg_rating: input.goodreads_avg_rating,
      goodreads_rating_count: input.goodreads_rating_count,
    };

    const { data, error } = await supabase
      .from('books')
      .insert(newBook)
      .select()
      .single();

    if (error) {
      console.error('Failed to add book:', error);
      return null;
    }

    const book = rowToBook(data);
    setBooks(prev => [book, ...prev]);
    return book;
  }, [user]);

  const updateBook = useCallback(async (id: string, updates: Partial<Book>) => {
    const { error } = await supabase
      .from('books')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to update book:', error);
      return;
    }

    setBooks(prev =>
      prev.map(book =>
        book.id === id
          ? { ...book, ...updates, updated_at: new Date().toISOString() }
          : book
      )
    );
  }, []);

  const updateStatus = useCallback(async (id: string, status: BookStatus, finishDate?: string) => {
    const now = new Date().toISOString();
    const book = books.find(b => b.id === id);
    if (!book) return;

    const updates: Partial<Book> = {
      status,
      updated_at: now,
    };

    // Auto-capture dates on status change
    if (status === 'reading' && !book.date_started) {
      updates.date_started = now;
    } else if (status === 'finished') {
      // Use provided date or current date
      updates.date_finished = finishDate || now;
    }

    const { error } = await supabase
      .from('books')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Failed to update status:', error);
      return;
    }

    setBooks(prev =>
      prev.map(b => (b.id === id ? { ...b, ...updates } : b))
    );
  }, [books]);

  const deleteBook = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete book:', error);
      return;
    }

    setBooks(prev => prev.filter(book => book.id !== id));
  }, []);

  const getBooksByStatus = useCallback(
    (status: BookStatus) => books.filter(book => book.status === status),
    [books]
  );

  const getBooksByYear = useCallback(
    (year: number) =>
      books.filter(book => {
        if (!book.date_finished) return false;
        return new Date(book.date_finished).getFullYear() === year;
      }),
    [books]
  );

  /**
   * Bulk add books with dedupe logic
   */
  const bulkAddBooks = useCallback(
    async (inputs: CreateBookInput[]): Promise<ImportResult> => {
      if (!user) {
        return { added: 0, skipped: 0, merged: 0, errors: ['Not logged in'] };
      }

      const result: ImportResult = {
        added: 0,
        skipped: 0,
        merged: 0,
        errors: [],
      };

      // First, dedupe the input list itself (merges duplicates within import)
      const dedupedInputs = dedupeBookInputs(inputs);
      const skippedInDedupe = inputs.length - dedupedInputs.length;
      result.merged = skippedInDedupe;

      const now = new Date().toISOString();
      const booksToInsert: Record<string, unknown>[] = [];

      for (const input of dedupedInputs) {
        try {
          // Check for existing book in database
          const existing = isDuplicateOfExisting(input, books);

          if (existing) {
            result.skipped++;
            continue;
          }

          // Create new book
          const newBook = {
            user_id: user.id,
            title: input.title,
            authors: input.authors,
            open_library_id: input.open_library_id,
            cover_url: input.cover_url,
            page_count: input.page_count,
            first_published: input.first_published,
            genres: input.genres,
            isbn: input.isbn,
            description: input.description,
            publisher: input.publisher,
            status: input.status || 'tbd',
            rating: input.rating,
            notes: input.notes,
            tags: input.tags,
            worldview_impact: input.worldview_impact,
            highlights: input.highlights,
            progress: input.progress,
            source: input.source || 'manual',
            source_id: input.source_id,
            date_added: input.date_added || now,
            date_started: input.date_started,
            date_finished: input.date_finished,
            goodreads_avg_rating: input.goodreads_avg_rating,
            goodreads_rating_count: input.goodreads_rating_count,
          };

          booksToInsert.push(newBook);
          result.added++;
        } catch (error) {
          result.errors.push(`Failed to add "${input.title}": ${error}`);
        }
      }

      // Bulk insert in batches of 50 to avoid Supabase limits
      if (booksToInsert.length > 0) {
        const batchSize = 50;
        const allNewBooks: Book[] = [];
        let actualAdded = 0;

        for (let i = 0; i < booksToInsert.length; i += batchSize) {
          const batch = booksToInsert.slice(i, i + batchSize);

          // Remove undefined/null fields that might not exist in schema
          const cleanBatch = batch.map(book => {
            const clean: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(book)) {
              if (value !== undefined && value !== null) {
                clean[key] = value;
              }
            }
            return clean;
          });

          const { data, error } = await supabase
            .from('books')
            .insert(cleanBatch)
            .select();

          if (error) {
            console.error('Batch insert failed:', error, 'First book in batch:', cleanBatch[0]);
            result.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          } else {
            const newBooks = (data || []).map(rowToBook);
            allNewBooks.push(...newBooks);
            actualAdded += newBooks.length;
          }
        }

        result.added = actualAdded;
        if (allNewBooks.length > 0) {
          setBooks(prev => [...allNewBooks, ...prev]);
        }
      }

      return result;
    },
    [user, books]
  );

  /**
   * Bulk update status for selected books (batched for large numbers)
   */
  const bulkUpdateStatus = useCallback(async (bookIds: string[], newStatus: BookStatus) => {
    console.log('bulkUpdateStatus called:', { bookIds: bookIds.length, newStatus, userId: user?.id });
    if (!user || bookIds.length === 0) {
      console.log('Early return - no user or empty bookIds');
      return { updated: 0 };
    }

    // Batch updates in chunks of 100 to avoid Supabase limits
    const batchSize = 100;
    let totalUpdated = 0;

    for (let i = 0; i < bookIds.length; i += batchSize) {
      const batch = bookIds.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}, size: ${batch.length}`);

      const { data, error } = await supabase
        .from('books')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('id', batch)
        .select('id');

      if (error) {
        console.error(`BATCH ERROR: ${error.message} | Code: ${error.code} | Details: ${error.details} | Hint: ${error.hint}`);
        continue;
      }
      console.log(`Batch updated successfully: ${data?.length || 0} books`);
      totalUpdated += data?.length || 0;
    }

    console.log('Total updated:', totalUpdated);
    if (totalUpdated > 0) {
      // Update local state
      setBooks(prev => prev.map(book =>
        bookIds.includes(book.id) ? { ...book, status: newStatus } : book
      ));
    }
    return { updated: totalUpdated };
  }, [user]);

  /**
   * Bulk delete selected books (batched for large numbers)
   */
  const bulkDeleteBooks = useCallback(async (bookIds: string[]) => {
    console.log('bulkDeleteBooks called:', { count: bookIds.length, userId: user?.id });
    if (!user || bookIds.length === 0) return { deleted: 0 };

    // Batch deletes in chunks of 100 to avoid Supabase limits
    const batchSize = 100;
    let totalDeleted = 0;

    for (let i = 0; i < bookIds.length; i += batchSize) {
      const batch = bookIds.slice(i, i + batchSize);
      console.log(`Deleting batch ${Math.floor(i / batchSize) + 1}, size: ${batch.length}`);

      const { error } = await supabase
        .from('books')
        .delete()
        .eq('user_id', user.id)
        .in('id', batch);

      if (error) {
        console.error(`DELETE BATCH ERROR: ${error.message} | Code: ${error.code}`);
        continue;
      }
      console.log(`Batch deleted successfully: ${batch.length} books`);
      totalDeleted += batch.length;
    }

    console.log('Total deleted:', totalDeleted);
    if (totalDeleted > 0) {
      setBooks(prev => prev.filter(book => !bookIds.includes(book.id)));
    }
    return { deleted: totalDeleted };
  }, [user]);

  /**
   * Clear all books
   */
  const clearAllBooks = useCallback(async () => {
    if (!user) return;

    const { error } = await supabase
      .from('books')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to clear books:', error);
      return;
    }

    setBooks([]);
  }, [user]);

  /**
   * Find duplicate books in the library
   * Returns groups of books that are likely the same
   */
  const findDuplicates = useCallback((): Book[][] => {
    const duplicateGroups: Book[][] = [];
    const checked = new Set<string>();

    for (let i = 0; i < books.length; i++) {
      if (checked.has(books[i].id)) continue;

      const group: Book[] = [books[i]];

      for (let j = i + 1; j < books.length; j++) {
        if (checked.has(books[j].id)) continue;

        if (isSameBook(
          { title: books[i].title, authors: books[i].authors, isbn: books[i].isbn },
          books[j]
        )) {
          group.push(books[j]);
          checked.add(books[j].id);
        }
      }

      if (group.length > 1) {
        duplicateGroups.push(group);
        checked.add(books[i].id);
      }
    }

    return duplicateGroups;
  }, [books]);

  return {
    books,
    isLoading,
    addBook,
    updateBook,
    updateStatus,
    deleteBook,
    getBooksByStatus,
    getBooksByYear,
    bulkAddBooks,
    bulkUpdateStatus,
    bulkDeleteBooks,
    clearAllBooks,
    findDuplicates,
  };
}
