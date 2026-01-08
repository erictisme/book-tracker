import { Book as BookIcon, Star, MoreVertical, BookOpen, Check, Clock, Pause, HelpCircle } from 'lucide-react';
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

interface BookListItemProps {
  book: Book;
  onStatusChange: (status: BookStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const statusConfig: Record<BookStatus, { label: string; icon: typeof BookIcon; color: string }> = {
  'tbd': { label: 'TBD', icon: HelpCircle, color: 'text-purple-600 dark:text-purple-400' },
  'want-to-read': { label: 'Want', icon: Clock, color: 'text-blue-600 dark:text-blue-400' },
  'reading': { label: 'Reading', icon: BookOpen, color: 'text-yellow-600 dark:text-yellow-400' },
  'finished': { label: 'Done', icon: Check, color: 'text-green-600 dark:text-green-400' },
  'parked': { label: 'Parked', icon: Pause, color: 'text-gray-600 dark:text-gray-400' },
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

export function BookListItem({ book, onStatusChange, onEdit, onDelete }: BookListItemProps) {
  const status = statusConfig[book.status];
  const StatusIcon = status.icon;
  const nextAction = getNextAction(book.status);
  const NextActionIcon = nextAction?.icon;

  return (
    <div className="flex items-center gap-4 py-2 px-3 hover:bg-muted/50 rounded-md transition-colors group">
      {/* Title & Author */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <span className="font-medium hover:underline">{book.title}</span>
        <span className="text-muted-foreground mx-2">—</span>
        <span className="text-muted-foreground text-sm">{book.authors.join(', ')}</span>
      </div>

      {/* Rating */}
      {book.rating && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                'h-3 w-3',
                i < book.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted'
              )}
            />
          ))}
        </div>
      )}

      {/* Status */}
      <div className={cn('flex items-center gap-1 text-xs font-medium flex-shrink-0 w-20', status.color)}>
        <StatusIcon className="h-3 w-3" />
        {status.label}
      </div>

      {/* Quick action */}
      {nextAction && NextActionIcon && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onStatusChange(nextAction.nextStatus)}
        >
          <NextActionIcon className="h-3 w-3 mr-1" />
          {nextAction.label}
        </Button>
      )}

      {/* Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>Edit details</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onStatusChange('tbd')}>
            <HelpCircle className="h-4 w-4 mr-2" /> TBD
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange('want-to-read')}>
            <Clock className="h-4 w-4 mr-2" /> Want to Read
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange('reading')}>
            <BookOpen className="h-4 w-4 mr-2" /> Reading
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange('finished')}>
            <Check className="h-4 w-4 mr-2" /> Done
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange('parked')}>
            <Pause className="h-4 w-4 mr-2" /> Parked
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
