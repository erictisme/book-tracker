import { useState, useMemo } from 'react';
import { Tag, Pencil, Trash2, Plus, Sparkles, X, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import type { Book } from '../../types/book';

interface TagManagerProps {
  books: Book[];
  onUpdateBookTags: (bookId: string, tags: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Common reading category suggestions
const SUGGESTED_CATEGORIES = [
  { tag: 'fiction', description: 'Novels and stories' },
  { tag: 'non-fiction', description: 'Factual and informative' },
  { tag: 'self-help', description: 'Personal development' },
  { tag: 'biography', description: 'Life stories' },
  { tag: 'business', description: 'Professional and career' },
  { tag: 'history', description: 'Historical events' },
  { tag: 'science', description: 'Scientific topics' },
  { tag: 'philosophy', description: 'Philosophical ideas' },
  { tag: 'religion', description: 'Spiritual and religious' },
  { tag: 'psychology', description: 'Mind and behavior' },
  { tag: 'parenting', description: 'Raising children' },
  { tag: 'health', description: 'Wellness and fitness' },
  { tag: 'memoir', description: 'Personal accounts' },
  { tag: 'fantasy', description: 'Fantasy worlds' },
  { tag: 'mystery', description: 'Crime and detective' },
  { tag: 'romance', description: 'Love stories' },
  { tag: 'classic', description: 'Timeless literature' },
  { tag: 'productivity', description: 'Getting things done' },
];

// Genre to tag mappings for auto-suggestions
const GENRE_TO_TAG_MAP: Record<string, string[]> = {
  'fiction': ['fiction'],
  'novel': ['fiction'],
  'fantasy': ['fiction', 'fantasy'],
  'science fiction': ['fiction', 'sci-fi'],
  'mystery': ['fiction', 'mystery'],
  'thriller': ['fiction', 'thriller'],
  'romance': ['fiction', 'romance'],
  'biography': ['non-fiction', 'biography'],
  'autobiography': ['non-fiction', 'biography', 'memoir'],
  'memoir': ['non-fiction', 'memoir'],
  'history': ['non-fiction', 'history'],
  'self-help': ['non-fiction', 'self-help'],
  'business': ['non-fiction', 'business'],
  'psychology': ['non-fiction', 'psychology'],
  'philosophy': ['non-fiction', 'philosophy'],
  'religion': ['non-fiction', 'religion'],
  'spirituality': ['non-fiction', 'religion'],
  'christianity': ['non-fiction', 'religion', 'christianity'],
  'science': ['non-fiction', 'science'],
  'health': ['non-fiction', 'health'],
  'cooking': ['non-fiction', 'cooking'],
  'parenting': ['non-fiction', 'parenting'],
  'children': ['children'],
  'young adult': ['young-adult'],
  'classic': ['classic'],
  'literary fiction': ['fiction', 'literary'],
};

export function suggestTagsForBook(book: Book): string[] {
  const suggestions = new Set<string>();

  // Check genres
  if (book.genres) {
    for (const genre of book.genres) {
      const lowerGenre = genre.toLowerCase();
      for (const [key, tags] of Object.entries(GENRE_TO_TAG_MAP)) {
        if (lowerGenre.includes(key)) {
          tags.forEach(t => suggestions.add(t));
        }
      }
    }
  }

  // Check title for common keywords
  const titleLower = book.title.toLowerCase();
  if (titleLower.includes('memoir') || titleLower.includes('my life')) {
    suggestions.add('memoir');
  }
  if (titleLower.includes('business') || titleLower.includes('startup') || titleLower.includes('entrepreneur')) {
    suggestions.add('business');
  }
  if (titleLower.includes('history of') || titleLower.includes('a history')) {
    suggestions.add('history');
  }

  return Array.from(suggestions);
}

export function TagManager({ books, onUpdateBookTags, open, onOpenChange }: TagManagerProps) {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [selectedBooksForTag, setSelectedBooksForTag] = useState<Set<string>>(new Set());
  const [addingNewTag, setAddingNewTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Calculate all unique tags with counts and book lists
  const tagData = useMemo(() => {
    const data: Record<string, { count: number; bookIds: string[] }> = {};

    books.forEach(book => {
      book.tags?.forEach(tag => {
        if (!data[tag]) {
          data[tag] = { count: 0, bookIds: [] };
        }
        data[tag].count++;
        data[tag].bookIds.push(book.id);
      });
    });

    return Object.entries(data)
      .sort((a, b) => b[1].count - a[1].count);
  }, [books]);

  // Get untagged books
  const untaggedBooks = useMemo(() =>
    books.filter(b => !b.tags || b.tags.length === 0),
    [books]
  );

  // Get tags not yet used
  const unusedSuggestions = useMemo(() =>
    SUGGESTED_CATEGORIES.filter(s => !tagData.some(([tag]) => tag === s.tag)),
    [tagData]
  );

  const handleRenameTag = (oldTag: string) => {
    if (!newTagName.trim() || newTagName === oldTag) {
      setEditingTag(null);
      return;
    }

    const booksWithTag = books.filter(b => b.tags?.includes(oldTag));
    booksWithTag.forEach(book => {
      const updatedTags = book.tags!.map(t => t === oldTag ? newTagName.toLowerCase() : t);
      onUpdateBookTags(book.id, [...new Set(updatedTags)]);
    });

    setEditingTag(null);
    setNewTagName('');
  };

  const handleDeleteTag = (tagToDelete: string) => {
    const booksWithTag = books.filter(b => b.tags?.includes(tagToDelete));
    booksWithTag.forEach(book => {
      const updatedTags = book.tags!.filter(t => t !== tagToDelete);
      onUpdateBookTags(book.id, updatedTags);
    });
  };

  const handleAddTagToBooks = (tag: string, bookIds: string[]) => {
    bookIds.forEach(bookId => {
      const book = books.find(b => b.id === bookId);
      if (book) {
        const currentTags = book.tags || [];
        if (!currentTags.includes(tag)) {
          onUpdateBookTags(bookId, [...currentTags, tag]);
        }
      }
    });
    setSelectedBooksForTag(new Set());
    setAddingNewTag(false);
    setNewTagInput('');
  };

  const handleAutoSuggestAll = () => {
    let updatedCount = 0;
    books.forEach(book => {
      const suggestions = suggestTagsForBook(book);
      if (suggestions.length > 0) {
        const currentTags = book.tags || [];
        const newTags = suggestions.filter(t => !currentTags.includes(t));
        if (newTags.length > 0) {
          onUpdateBookTags(book.id, [...currentTags, ...newTags]);
          updatedCount++;
        }
      }
    });
    return updatedCount;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tag Manager
          </DialogTitle>
          <DialogDescription>
            Organize your books with tags. {untaggedBooks.length > 0 && `${untaggedBooks.length} books have no tags.`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Auto-tag section */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    Auto-Tag Books
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Automatically suggest tags based on book genres and titles
                  </p>
                </div>
                <Button
                  onClick={() => handleAutoSuggestAll()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-Tag All
                </Button>
              </div>
            </div>

            <Separator />

            {/* Existing tags */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Your Tags ({tagData.length})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingNewTag(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New Tag
                </Button>
              </div>

              {addingNewTag && (
                <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
                  <Input
                    placeholder="Enter new tag name..."
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newTagInput.trim()) {
                        handleAddTagToBooks(newTagInput.toLowerCase().trim(), Array.from(selectedBooksForTag));
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newTagInput.trim()) {
                        handleAddTagToBooks(newTagInput.toLowerCase().trim(), Array.from(selectedBooksForTag));
                      }
                    }}
                    disabled={!newTagInput.trim()}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAddingNewTag(false);
                      setNewTagInput('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {tagData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No tags yet. Add tags to your books or use auto-tag!
                </p>
              ) : (
                <div className="space-y-2">
                  {tagData.map(([tag, { count }]) => (
                    <div
                      key={tag}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group"
                    >
                      {editingTag === tag ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={newTagName}
                            onChange={e => setNewTagName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameTag(tag);
                              if (e.key === 'Escape') setEditingTag(null);
                            }}
                            className="h-8 max-w-[200px]"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={() => handleRenameTag(tag)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingTag(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-sm">
                              {tag}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {count} book{count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditingTag(tag);
                                setNewTagName(tag);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteTag(tag)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Suggested tags */}
            {unusedSuggestions.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Suggested Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {unusedSuggestions.slice(0, 12).map(({ tag, description }) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                      title={description}
                      onClick={() => {
                        setAddingNewTag(true);
                        setNewTagInput(tag);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Untagged books preview */}
            {untaggedBooks.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Untagged Books ({untaggedBooks.length})
                  </Label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {untaggedBooks.slice(0, 10).map(book => {
                      const suggestions = suggestTagsForBook(book);
                      return (
                        <div
                          key={book.id}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{book.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {book.authors[0]}
                            </p>
                          </div>
                          {suggestions.length > 0 && (
                            <div className="flex items-center gap-1 ml-2">
                              <span className="text-xs text-muted-foreground">Suggest:</span>
                              {suggestions.slice(0, 2).map(tag => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs cursor-pointer hover:bg-primary/10"
                                  onClick={() => {
                                    const currentTags = book.tags || [];
                                    onUpdateBookTags(book.id, [...currentTags, tag]);
                                  }}
                                >
                                  +{tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {untaggedBooks.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        +{untaggedBooks.length - 10} more untagged books
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
