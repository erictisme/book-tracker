import { useState } from 'react';
import { Copy, Check, Book as BookIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import type { Book } from '../../types/book';

interface DuplicateFinderProps {
  duplicateGroups: Book[][];
  onDelete: (ids: string[]) => Promise<{ deleted: number }>;
  onMerge: (id: string, updates: Partial<Book>) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Merge data from all duplicate books into the best version
 * Takes the most complete data from each field
 */
function mergeBookData(books: Book[], keepId: string): Partial<Book> {
  const kept = books.find(b => b.id === keepId);
  if (!kept) return {};

  const others = books.filter(b => b.id !== keepId);
  const updates: Partial<Book> = {};

  // For each field, take from others if kept doesn't have it
  for (const other of others) {
    // Cover URL - prefer any cover
    if (!kept.cover_url && other.cover_url) {
      updates.cover_url = other.cover_url;
    }

    // Goodreads rating - take if missing
    if (!kept.goodreads_avg_rating && other.goodreads_avg_rating) {
      updates.goodreads_avg_rating = other.goodreads_avg_rating;
      updates.goodreads_rating_count = other.goodreads_rating_count;
    }

    // Page count
    if (!kept.page_count && other.page_count) {
      updates.page_count = other.page_count;
    }

    // Description
    if (!kept.description && other.description) {
      updates.description = other.description;
    }

    // ISBN
    if (!kept.isbn && other.isbn) {
      updates.isbn = other.isbn;
    }

    // Genres - merge arrays
    if (other.genres && other.genres.length > 0) {
      const existingGenres = kept.genres || updates.genres || [];
      const newGenres = [...new Set([...existingGenres, ...other.genres])];
      if (newGenres.length > existingGenres.length) {
        updates.genres = newGenres;
      }
    }

    // Publisher
    if (!kept.publisher && other.publisher) {
      updates.publisher = other.publisher;
    }

    // First published year
    if (!kept.first_published && other.first_published) {
      updates.first_published = other.first_published;
    }

    // Highlights - merge arrays
    if (other.highlights && other.highlights.length > 0) {
      const existing = kept.highlights || updates.highlights || [];
      const merged = [...new Set([...existing, ...other.highlights])];
      if (merged.length > existing.length) {
        updates.highlights = merged;
      }
    }

    // Tags - merge arrays
    if (other.tags && other.tags.length > 0) {
      const existing = kept.tags || updates.tags || [];
      const merged = [...new Set([...existing, ...other.tags])];
      if (merged.length > existing.length) {
        updates.tags = merged;
      }
    }

    // Notes - append if different
    if (other.notes && other.notes !== kept.notes) {
      const existingNotes = kept.notes || updates.notes || '';
      if (!existingNotes.includes(other.notes)) {
        updates.notes = existingNotes
          ? `${existingNotes}\n\n---\n[From ${other.source}]\n${other.notes}`
          : other.notes;
      }
    }

    // Quotes - merge arrays
    if (other.quotes && other.quotes.length > 0) {
      const existing = kept.quotes || updates.quotes || [];
      const merged = [...new Set([...existing, ...other.quotes])];
      if (merged.length > existing.length) {
        updates.quotes = merged;
      }
    }

    // Use longer title (usually has subtitle)
    if (other.title.length > (updates.title?.length || kept.title.length)) {
      updates.title = other.title;
    }
  }

  return updates;
}

/**
 * Pick the best book from a group to keep (the one with most data)
 */
function pickBestBook(group: Book[]): Book {
  return group.reduce((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (a.rating) scoreA += 10;
    if (b.rating) scoreB += 10;
    if (a.goodreads_avg_rating) scoreA += 5;
    if (b.goodreads_avg_rating) scoreB += 5;
    if (a.status === 'finished') scoreA += 3;
    if (b.status === 'finished') scoreB += 3;
    if (a.cover_url) scoreA += 4;
    if (b.cover_url) scoreB += 4;
    if (a.notes) scoreA += 2;
    if (b.notes) scoreB += 2;
    if (a.title.length > b.title.length) scoreA += 1;
    if (b.title.length > a.title.length) scoreB += 1;

    return scoreA >= scoreB ? a : b;
  });
}

export function DuplicateFinder({ duplicateGroups, onDelete, onMerge, open, onOpenChange }: DuplicateFinderProps) {
  const [isMerging, setIsMerging] = useState(false);

  const handleMergeAll = async () => {
    if (duplicateGroups.length === 0) return;

    setIsMerging(true);
    try {
      const idsToDelete: string[] = [];

      // Process each group: merge data into best book, collect others for deletion
      for (const group of duplicateGroups) {
        const best = pickBestBook(group);
        const mergeUpdates = mergeBookData(group, best.id);

        if (Object.keys(mergeUpdates).length > 0) {
          await onMerge(best.id, mergeUpdates);
        }

        // Mark all others for deletion
        group.forEach(book => {
          if (book.id !== best.id) {
            idsToDelete.push(book.id);
          }
        });
      }

      // Delete all duplicates
      if (idsToDelete.length > 0) {
        const result = await onDelete(idsToDelete);
        if (result.deleted > 0) {
          onOpenChange(false);
        }
      }
    } finally {
      setIsMerging(false);
    }
  };

  if (duplicateGroups.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Duplicate Finder
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="font-medium">No duplicates found!</p>
            <p className="text-sm text-muted-foreground mt-1">Your library is clean.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Calculate total duplicates to remove
  const totalToRemove = duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-amber-500" />
            Found {duplicateGroups.length} Duplicate Groups
          </DialogTitle>
          <DialogDescription>
            Each group will be merged into one book, combining covers, ratings, notes, and other data.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-4">
          <div className="space-y-4">
            {duplicateGroups.map((group, groupIndex) => {
              const best = pickBestBook(group);
              // Collect what data comes from each source
              const dataFromSources: string[] = [];
              group.forEach(book => {
                const contributions: string[] = [];
                if (book.cover_url) contributions.push('cover');
                if (book.goodreads_avg_rating) contributions.push(`GR ${book.goodreads_avg_rating.toFixed(1)}`);
                if (book.rating) contributions.push(`${book.rating}★`);
                if (book.notes) contributions.push('notes');
                if (book.highlights?.length) contributions.push('highlights');
                if (book.status === 'finished') contributions.push('finished');
                if (contributions.length > 0) {
                  dataFromSources.push(`${book.source}: ${contributions.join(', ')}`);
                }
              });

              return (
                <div key={groupIndex} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    {/* Show cover from any source that has it */}
                    {group.some(b => b.cover_url) ? (
                      <img
                        src={group.find(b => b.cover_url)?.cover_url}
                        alt=""
                        className="w-12 h-18 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-18 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        <BookIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Use longest title */}
                      <p className="font-medium text-sm">
                        {group.reduce((a, b) => a.title.length > b.title.length ? a : b).title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {best.authors[0]}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {group.map(book => (
                          <Badge
                            key={book.id}
                            variant="outline"
                            className="text-xs"
                          >
                            {book.source}
                            {book.cover_url && ' 🖼'}
                            {book.goodreads_avg_rating && ' ⭐'}
                            {book.notes && ' 📝'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {duplicateGroups.length} groups → {duplicateGroups.length} books ({totalToRemove} removed)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMergeAll}
              disabled={isMerging}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Check className="h-4 w-4 mr-2" />
              {isMerging ? 'Merging...' : `Merge ${duplicateGroups.length} Groups`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
