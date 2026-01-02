import { useState, useEffect } from 'react';
import { Book as BookIcon, Star, X, Calendar, Plus, Lightbulb, Quote, BookOpen, Check, Clock, Pause, HelpCircle, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { lookupBookEnrichment } from '../../services/googleBooksApi';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import type { Book, BookFeeling, BookStatus, Recommendation } from '../../types/book';
import { cn } from '../../lib/utils';

interface BookDetailModalProps {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Book>) => void;
  onStatusChange?: (status: BookStatus) => void;
}

const statusOptions: { value: BookStatus; label: string; icon: typeof BookIcon; color: string }[] = [
  { value: 'tbd', label: 'TBD', icon: HelpCircle, color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'want-to-read', label: 'Want to Read', icon: Clock, color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'reading', label: 'Reading', icon: BookOpen, color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'finished', label: 'Done', icon: Check, color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'parked', label: 'Parked', icon: Pause, color: 'bg-gray-100 text-gray-800 border-gray-300' },
];

const feelings: BookFeeling[] = [
  'inspired',
  'enlightened',
  'entertained',
  'moved',
  'challenged',
  'relaxed',
  'sad',
  'anxious',
  'bored',
  'confused',
];

const recommendOptions: { value: Recommendation; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

// Helper to format date for input
const formatDateForInput = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export function BookDetailModal({ book, open, onOpenChange, onSave, onStatusChange }: BookDetailModalProps) {
  const [rating, setRating] = useState(0);
  const [selectedFeelings, setSelectedFeelings] = useState<BookFeeling[]>([]);
  const [notes, setNotes] = useState('');
  const [quotes, setQuotes] = useState('');
  const [recommend, setRecommend] = useState<Recommendation | undefined>();
  const [dateAdded, setDateAdded] = useState('');
  const [dateStarted, setDateStarted] = useState('');
  const [dateFinished, setDateFinished] = useState('');
  const [worldviewImpact, setWorldviewImpact] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isEnriching, setIsEnriching] = useState(false);

  // Reset state when book changes
  useEffect(() => {
    if (book && open) {
      setRating(book.rating || 0);
      setSelectedFeelings(book.feelings || []);
      setNotes(book.notes || '');
      setQuotes(book.quotes?.join('\n') || '');
      setRecommend(book.would_recommend);
      setDateAdded(formatDateForInput(book.date_added));
      setDateStarted(formatDateForInput(book.date_started));
      setDateFinished(formatDateForInput(book.date_finished));
      setWorldviewImpact(book.worldview_impact || '');
      setTags(book.tags || []);
      setNewTag('');
    }
  }, [book, open]);

  const handleSave = () => {
    if (!book) return;

    onSave({
      rating: rating || undefined,
      feelings: selectedFeelings.length > 0 ? selectedFeelings : undefined,
      notes: notes.trim() || undefined,
      quotes: quotes.trim() ? quotes.split('\n').filter(q => q.trim()) : undefined,
      would_recommend: recommend,
      date_added: dateAdded || book.date_added,
      date_started: dateStarted || undefined,
      date_finished: dateFinished || undefined,
      worldview_impact: worldviewImpact.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });

    onOpenChange(false);
  };

  const toggleFeeling = (feeling: BookFeeling) => {
    setSelectedFeelings(prev =>
      prev.includes(feeling)
        ? prev.filter(f => f !== feeling)
        : [...prev, feeling]
    );
  };

  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleEnrich = async () => {
    if (!book || isEnriching) return;

    setIsEnriching(true);
    try {
      const enrichment = await lookupBookEnrichment(book.title, book.authors, book.isbn);

      if (enrichment) {
        // Save enriched data
        const updates: Partial<Book> = {};

        if (!book.cover_url && enrichment.cover_url) updates.cover_url = enrichment.cover_url;
        if (!book.page_count && enrichment.page_count) updates.page_count = enrichment.page_count;
        if (!book.description && enrichment.description) updates.description = enrichment.description;
        if (!book.publisher && enrichment.publisher) updates.publisher = enrichment.publisher;
        if (!book.first_published && enrichment.first_published) updates.first_published = enrichment.first_published;
        if ((!book.genres || book.genres.length === 0) && enrichment.genres) updates.genres = enrichment.genres;
        if (!book.isbn && enrichment.isbn) updates.isbn = enrichment.isbn;

        if (Object.keys(updates).length > 0) {
          onSave(updates);
        }
      }
    } catch (error) {
      console.error('Enrichment failed:', error);
    }
    setIsEnriching(false);
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Book Details</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Book info */}
            <div className="flex gap-4">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-24 h-36 object-cover rounded"
                />
              ) : (
                <div className="w-24 h-36 bg-muted rounded flex items-center justify-center">
                  <BookIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{book.title}</h3>
                <p className="text-muted-foreground">{book.authors.join(', ')}</p>
                {book.genres && book.genres.length > 0 && (
                  <p className="text-sm text-muted-foreground">{book.genres.slice(0, 3).join(', ')}</p>
                )}
                {book.page_count && (
                  <p className="text-sm text-muted-foreground">{book.page_count} pages</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground capitalize">
                    Source: {book.source}
                  </span>
                  <a
                    href={book.isbn
                      ? `https://www.goodreads.com/book/isbn/${book.isbn}`
                      : `https://www.goodreads.com/search?q=${encodeURIComponent(book.title + ' ' + book.authors[0])}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Goodreads
                  </a>
                  {/* Enrich button - show if missing key data */}
                  {(!book.cover_url || !book.page_count || !book.description) && (
                    <button
                      onClick={handleEnrich}
                      disabled={isEnriching}
                      className="text-xs text-amber-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      {isEnriching ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {isEnriching ? 'Enriching...' : 'Enrich'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status - Quick change */}
            {onStatusChange && (
              <div className="space-y-2">
                <Label>Reading Status</Label>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map(option => {
                    const Icon = option.icon;
                    const isActive = book.status === option.value;
                    return (
                      <Button
                        key={option.value}
                        variant="outline"
                        size="sm"
                        className={cn(
                          'border-2',
                          isActive && option.color
                        )}
                        onClick={() => onStatusChange(option.value)}
                      >
                        <Icon className="h-4 w-4 mr-1" />
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Dates */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Reading Dates
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="dateAdded" className="text-xs text-muted-foreground">Added</Label>
                  <Input
                    id="dateAdded"
                    type="date"
                    value={dateAdded}
                    onChange={e => setDateAdded(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="dateStarted" className="text-xs text-muted-foreground">Started</Label>
                  <Input
                    id="dateStarted"
                    type="date"
                    value={dateStarted}
                    onChange={e => setDateStarted(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="dateFinished" className="text-xs text-muted-foreground">Finished</Label>
                  <Input
                    id="dateFinished"
                    type="date"
                    value={dateFinished}
                    onChange={e => setDateFinished(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Rating */}
            <div className="space-y-2">
              <Label>Your Rating</Label>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setRating(i + 1)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={cn(
                        'h-6 w-6',
                        i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                      )}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <button
                    onClick={() => setRating(0)}
                    className="ml-2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer group"
                    onClick={() => removeTag(tag)}
                  >
                    {tag}
                    <X className="h-3 w-3 ml-1 opacity-50 group-hover:opacity-100" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={addTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Worldview Impact */}
            <div className="space-y-2">
              <Label htmlFor="worldview" className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                How did this book change your thinking?
              </Label>
              <Textarea
                id="worldview"
                placeholder="This book changed how I think about..."
                value={worldviewImpact}
                onChange={e => setWorldviewImpact(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Your thoughts about this book..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* Quotes */}
            <div className="space-y-2">
              <Label htmlFor="quotes" className="flex items-center gap-2">
                <Quote className="h-4 w-4" />
                Favorite Quotes (one per line)
              </Label>
              <Textarea
                id="quotes"
                placeholder="Add your favorite quotes..."
                value={quotes}
                onChange={e => setQuotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* Highlights (read-only if present) */}
            {book.highlights && book.highlights.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Imported Highlights ({book.highlights.length})
                </Label>
                <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                  {book.highlights.slice(0, 5).map((highlight, i) => (
                    <p key={i} className="text-sm italic border-l-2 border-primary pl-3">
                      "{highlight}"
                    </p>
                  ))}
                  {book.highlights.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{book.highlights.length - 5} more highlights
                    </p>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Feelings */}
            <div className="space-y-2">
              <Label>How did it make you feel?</Label>
              <div className="flex flex-wrap gap-2">
                {feelings.map(feeling => (
                  <Badge
                    key={feeling}
                    variant={selectedFeelings.includes(feeling) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => toggleFeeling(feeling)}
                  >
                    {feeling}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Would recommend */}
            <div className="space-y-2">
              <Label>Would you recommend this book?</Label>
              <div className="flex gap-2">
                {recommendOptions.map(option => (
                  <Button
                    key={option.value}
                    variant={recommend === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRecommend(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
