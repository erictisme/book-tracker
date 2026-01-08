import { Book as BookIcon, Star, MoreVertical, BookOpen, Check, Clock, Pause, HelpCircle } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
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

interface BookCardGridProps {
  books: Book[];
  onStatusChange: (id: string, status: BookStatus) => void;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
}

const statusConfig: Record<BookStatus, { label: string; icon: typeof BookIcon; color: string }> = {
  'tbd': { label: 'TBD', icon: HelpCircle, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
  'want-to-read': { label: 'Want', icon: Clock, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  'reading': { label: 'Reading', icon: BookOpen, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  'finished': { label: 'Done', icon: Check, color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  'parked': { label: 'Parked', icon: Pause, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
};

function getNextAction(status: BookStatus): { label: string; nextStatus: BookStatus; icon: typeof BookIcon } | null {
  switch (status) {
    case 'tbd':
    case 'want-to-read':
      return { label: 'Start', nextStatus: 'reading', icon: BookOpen };
    case 'reading':
      return { label: 'Done', nextStatus: 'finished', icon: Check };
    case 'parked':
      return { label: 'Resume', nextStatus: 'reading', icon: BookOpen };
    default:
      return null;
  }
}

export function BookCardGrid({ books, onStatusChange, onEdit, onDelete }: BookCardGridProps) {
  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <BookIcon className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No books yet</p>
        <p className="text-sm">Search and add your first book!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {books.map(book => {
        const status = statusConfig[book.status];
        const StatusIcon = status.icon;
        const nextAction = getNextAction(book.status);
        const NextActionIcon = nextAction?.icon;

        return (
          <Card key={book.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
            {/* Cover */}
            <div
              className="aspect-[2/3] relative cursor-pointer bg-muted"
              onClick={() => onEdit(book)}
            >
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookIcon className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}

              {/* Status badge overlay */}
              <Badge
                variant="secondary"
                className={cn('absolute top-2 left-2 text-[10px] px-1.5 py-0', status.color)}
              >
                <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                {status.label}
              </Badge>

              {/* Quick action overlay */}
              {nextAction && NextActionIcon && (
                <Button
                  size="sm"
                  className="absolute bottom-2 right-2 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(book.id, nextAction.nextStatus);
                  }}
                >
                  <NextActionIcon className="h-3 w-3 mr-1" />
                  {nextAction.label}
                </Button>
              )}

              {/* Menu button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(book)}>Edit details</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onStatusChange(book.id, 'tbd')}>
                    <HelpCircle className="h-4 w-4 mr-2" /> TBD
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(book.id, 'want-to-read')}>
                    <Clock className="h-4 w-4 mr-2" /> Want to Read
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(book.id, 'reading')}>
                    <BookOpen className="h-4 w-4 mr-2" /> Reading
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(book.id, 'finished')}>
                    <Check className="h-4 w-4 mr-2" /> Done
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(book.id, 'parked')}>
                    <Pause className="h-4 w-4 mr-2" /> Parked
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(book.id)} className="text-destructive">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Title & Author */}
            <div className="p-2 cursor-pointer" onClick={() => onEdit(book)}>
              <p className="font-medium text-sm truncate">{book.title}</p>
              <p className="text-xs text-muted-foreground truncate">{book.authors.join(', ')}</p>
              {book.rating && (
                <div className="flex items-center gap-0.5 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-2.5 w-2.5',
                        i < book.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted'
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
