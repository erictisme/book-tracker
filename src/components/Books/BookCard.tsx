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

interface BookCardProps {
  book: Book;
  onStatusChange: (status: BookStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const statusConfig: Record<BookStatus, { label: string; icon: typeof BookIcon; color: string }> = {
  'tbd': { label: 'TBD', icon: HelpCircle, color: 'bg-purple-100 text-purple-800' },
  'want-to-read': { label: 'Want to Read', icon: Clock, color: 'bg-blue-100 text-blue-800' },
  'reading': { label: 'Reading', icon: BookOpen, color: 'bg-yellow-100 text-yellow-800' },
  'finished': { label: 'Done', icon: Check, color: 'bg-green-100 text-green-800' },
  'parked': { label: 'Parked', icon: Pause, color: 'bg-gray-100 text-gray-800' },
};

// Get the next logical action for a book based on its current status
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

export function BookCard({ book, onStatusChange, onEdit, onDelete }: BookCardProps) {
  const status = statusConfig[book.status];
  const StatusIcon = status.icon;
  const nextAction = getNextAction(book.status);
  const NextActionIcon = nextAction?.icon;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex">
        {/* Cover */}
        <div className="w-24 h-36 flex-shrink-0 cursor-pointer" onClick={onEdit}>
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <BookIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 flex flex-col min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 cursor-pointer" onClick={onEdit}>
              <h3 className="font-medium truncate">{book.title}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {book.authors.join(', ')}
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  Edit details
                </DropdownMenuItem>
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

          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            <Badge variant="secondary" className={cn('text-xs', status.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>

            <div className="flex items-center gap-2">
              {book.rating && (
                <div className="flex items-center gap-0.5">
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

              {/* Quick action button */}
              {nextAction && NextActionIcon && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onStatusChange(nextAction.nextStatus)}
                >
                  <NextActionIcon className="h-3 w-3 mr-1" />
                  {nextAction.label}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
