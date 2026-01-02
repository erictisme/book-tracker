import { useState, useMemo } from 'react';
import { Book as BookIcon, Star, MoreVertical, BookOpen, Check, Clock, ThumbsUp, ThumbsDown, Minus, Pause, HelpCircle, Square, CheckSquare, MousePointer2 } from 'lucide-react';

// Goodreads icon SVG
const GoodreadsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12.01 2.5c-4.4 0-6.57 2.73-6.57 6.93 0 4.32 2.24 6.66 6.32 6.66 2.1 0 3.76-.8 4.66-2.35h.08v1.97c0 2.66-1.26 4.24-4.24 4.24-2.16 0-3.58-.9-3.94-2.53H5.69c.34 2.96 2.9 4.77 6.66 4.77 4.66 0 7.15-2.45 7.15-6.9V2.8h-2.53v2.2h-.08c-.9-1.55-2.4-2.5-4.88-2.5zm.33 11.3c-2.66 0-4.08-1.87-4.08-4.58 0-2.72 1.42-4.66 4.08-4.66 2.74 0 4.24 1.95 4.24 4.66 0 2.7-1.5 4.58-4.24 4.58z"/>
  </svg>
);
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { Book, BookStatus } from '../../types/book';
import { cn } from '../../lib/utils';

type SortMode = 'date' | 'status' | 'title' | 'rating';

interface BookGridProps {
  books: Book[];
  onStatusChange: (id: string, status: BookStatus) => void;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

const statusConfig: Record<BookStatus, { label: string; icon: typeof BookIcon; color: string; dot: string; btnClass: string }> = {
  'tbd': { label: 'TBD', icon: HelpCircle, color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-400', btnClass: 'hover:bg-purple-100 hover:text-purple-700' },
  'want-to-read': { label: 'Want', icon: Clock, color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', btnClass: 'hover:bg-blue-100 hover:text-blue-700' },
  'reading': { label: 'Reading', icon: BookOpen, color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500', btnClass: 'hover:bg-yellow-100 hover:text-yellow-700' },
  'finished': { label: 'Done', icon: Check, color: 'bg-green-100 text-green-800', dot: 'bg-green-500', btnClass: 'hover:bg-green-100 hover:text-green-700' },
  'parked': { label: 'Parked', icon: Pause, color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-400', btnClass: 'hover:bg-gray-100 hover:text-gray-700' },
};

// Status order for display and sorting
const statusOrder: BookStatus[] = ['tbd', 'want-to-read', 'reading', 'finished', 'parked'];
const statusPriority: Record<BookStatus, number> = {
  'reading': 0,
  'want-to-read': 1,
  'tbd': 2,
  'finished': 3,
  'parked': 4,
};

// Generate Goodreads URL for a book
function getGoodreadsUrl(book: Book): string {
  if (book.isbn) {
    return `https://www.goodreads.com/book/isbn/${book.isbn}`;
  }
  // Fallback to search
  const query = encodeURIComponent(`${book.title} ${book.authors[0] || ''}`);
  return `https://www.goodreads.com/search?q=${query}`;
}

export function BookGrid({ books, onStatusChange, onEdit, onDelete, selectedIds, onSelectionChange }: BookGridProps) {
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [selectMode, setSelectMode] = useState(false);

  const sortedBooks = useMemo(() => {
    const sorted = [...books];
    switch (sortMode) {
      case 'date':
        return sorted.sort((a, b) => {
          const dateA = a.date_finished || a.date_added || '';
          const dateB = b.date_finished || b.date_added || '';
          return dateB.localeCompare(dateA);
        });
      case 'status':
        return sorted.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);
      case 'title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'rating':
        return sorted.sort((a, b) => (b.goodreads_avg_rating || 0) - (a.goodreads_avg_rating || 0));
      default:
        return sorted;
    }
  }, [books, sortMode]);

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === books.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(books.map(b => b.id)));
    }
  };

  const allSelected = books.length > 0 && selectedIds.size === books.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < books.length;

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <BookIcon className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No books yet</p>
        <p className="text-sm">Search and add your first book!</p>
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-2">
      {/* Header with select mode, select all, sort toggle, and status legend */}
      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground pb-2 border-b">
        <div className="flex items-center gap-4">
          {/* Select Mode toggle */}
          <button
            onClick={() => {
              setSelectMode(!selectMode);
              if (selectMode) onSelectionChange(new Set()); // Clear selection when exiting select mode
            }}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
              selectMode ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            <span>Select</span>
          </button>

          {/* Select all (only in select mode) */}
          {selectMode && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 hover:text-foreground transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : someSelected ? (
                <div className="h-4 w-4 border-2 border-primary rounded bg-primary/20" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'All'}</span>
            </button>
          )}

          {/* Sort toggle */}
          <div className="flex items-center gap-1 border-l pl-3">
            <span className="text-muted-foreground mr-1">Sort:</span>
            <button
              onClick={() => setSortMode('date')}
              className={cn(
                'px-2 py-0.5 rounded transition-colors',
                sortMode === 'date' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              )}
            >
              Date
            </button>
            <button
              onClick={() => setSortMode('status')}
              className={cn(
                'px-2 py-0.5 rounded transition-colors',
                sortMode === 'status' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              )}
            >
              Status
            </button>
            <button
              onClick={() => setSortMode('title')}
              className={cn(
                'px-2 py-0.5 rounded transition-colors',
                sortMode === 'title' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              )}
            >
              A-Z
            </button>
            <button
              onClick={() => setSortMode('rating')}
              className={cn(
                'px-2 py-0.5 rounded transition-colors',
                sortMode === 'rating' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              )}
            >
              Rating
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {statusOrder.map(key => {
            const config = statusConfig[key];
            return (
              <div key={key} className="flex items-center gap-1">
                <div className={cn('w-2 h-2 rounded-full', config.dot)} />
                <span>{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Book List */}
      {sortedBooks.map(book => {
        const status = statusConfig[book.status];
        const displayDate = book.date_finished || book.date_started || book.date_added;

        const isSelected = selectedIds.has(book.id);

        return (
          <div
            key={book.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group",
              isSelected && "bg-primary/5"
            )}
            onClick={() => {
              if (selectMode) {
                toggleSelection(book.id);
              } else {
                onEdit(book);
              }
            }}
          >
            {/* Checkbox (only in select mode) */}
            {selectMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelection(book.id);
                }}
                className="flex-shrink-0 hover:scale-110 transition-transform"
              >
                {isSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
                )}
              </button>
            )}

            {/* Status dot */}
            <div className={cn('w-2 h-2 rounded-full flex-shrink-0', status.dot)} title={status.label} />

            {/* Title & Author */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="font-medium text-sm truncate">{book.title}</span>
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                {book.authors[0]}
              </span>
            </div>

            {/* Ratings column - fixed width for alignment */}
            <div className="flex items-center gap-3 flex-shrink-0 w-24 justify-end">
              {/* Personal Rating */}
              {book.rating ? (
                <div className="flex items-center gap-0.5 w-8 justify-end" title="Your rating">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  <span className="text-xs font-medium">{book.rating}</span>
                </div>
              ) : (
                <div className="w-8" />
              )}
              {/* Goodreads Rating */}
              {book.goodreads_avg_rating ? (
                <div className="flex items-center gap-0.5 justify-end" title={book.goodreads_rating_count ? `${book.goodreads_rating_count.toLocaleString()} ratings on Goodreads` : 'Goodreads rating'}>
                  <Star className="h-3 w-3 fill-orange-400 text-orange-400" />
                  <span className="text-xs text-muted-foreground">{book.goodreads_avg_rating.toFixed(1)}</span>
                  {book.goodreads_rating_count && (
                    <span className="text-[10px] text-muted-foreground/50">({book.goodreads_rating_count >= 1000 ? `${(book.goodreads_rating_count / 1000).toFixed(0)}k` : book.goodreads_rating_count})</span>
                  )}
                </div>
              ) : (
                <div className="w-12" />
              )}
            </div>

            {/* Recommendation */}
            {book.would_recommend && (
              <span className={cn(
                'flex-shrink-0',
                book.would_recommend === 'yes' && 'text-green-600',
                book.would_recommend === 'maybe' && 'text-yellow-600',
                book.would_recommend === 'no' && 'text-red-600'
              )}>
                {book.would_recommend === 'yes' && <ThumbsUp className="h-3 w-3" />}
                {book.would_recommend === 'maybe' && <Minus className="h-3 w-3" />}
                {book.would_recommend === 'no' && <ThumbsDown className="h-3 w-3" />}
              </span>
            )}

            {/* Tags */}
            {book.tags && book.tags.length > 0 && (
              <div className="hidden md:flex gap-1 flex-shrink-0">
                {book.tags.slice(0, 2).map((tag) => {
                  // Rotate through soft pastel colors
                  const colors = [
                    'bg-blue-50 text-blue-600/70 dark:bg-blue-950/30 dark:text-blue-400/70',
                    'bg-purple-50 text-purple-600/70 dark:bg-purple-950/30 dark:text-purple-400/70',
                    'bg-pink-50 text-pink-600/70 dark:bg-pink-950/30 dark:text-pink-400/70',
                    'bg-teal-50 text-teal-600/70 dark:bg-teal-950/30 dark:text-teal-400/70',
                    'bg-amber-50 text-amber-600/70 dark:bg-amber-950/30 dark:text-amber-400/70',
                  ];
                  const colorClass = colors[tag.charCodeAt(0) % colors.length];
                  return (
                    <span key={tag} className={cn('text-[10px] px-1.5 py-0.5 rounded', colorClass)}>
                      {tag}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Date - fixed width column */}
            <div className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block w-20 text-right">
              {displayDate ? formatDate(displayDate) : ''}
            </div>

            {/* Goodreads link */}
            <a
              href={getGoodreadsUrl(book)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-[#553b08] flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              title="View on Goodreads"
            >
              <GoodreadsIcon className="h-4 w-4" />
            </a>

            {/* Status buttons */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {statusOrder.map(s => {
                const cfg = statusConfig[s];
                const Icon = cfg.icon;
                const isActive = book.status === s;
                return (
                  <button
                    key={s}
                    className={cn(
                      'p-1 rounded transition-colors',
                      isActive ? cfg.color : 'text-muted-foreground/40',
                      !isActive && cfg.btnClass
                    )}
                    title={cfg.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(book.id, s);
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onEdit(book); }}>
                  Edit details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); onDelete(book.id); }}
                  className="text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
