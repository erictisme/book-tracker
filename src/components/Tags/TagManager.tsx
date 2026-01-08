import { useState, useMemo, useCallback, useEffect } from 'react';
import { Tag, Pencil, Trash2, Plus, X, Check, Loader2, Brain } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
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
import {
  DEFAULT_CATEGORIES,
  isAITaggingAvailable,
  tagBooksWithAI,
  type TagSuggestion,
} from '../../services/aiTagger';

interface TagManagerProps {
  books: Book[];
  selectedBookIds?: Set<string>;
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

export function TagManager({ books, selectedBookIds, onUpdateBookTags, open, onOpenChange }: TagManagerProps) {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [selectedBooksForTag, setSelectedBooksForTag] = useState<Set<string>>(new Set());
  const [addingNewTag, setAddingNewTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Get existing tags from books as default categories
  const existingTags = useMemo(() => {
    const tagSet = new Set<string>();
    books.forEach(book => book.tags?.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [books]);

  // AI Tagging state - use existing tags, or fall back to defaults if no tags exist
  const [aiCategories, setAiCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Initialize categories from existing tags when dialog opens
  useEffect(() => {
    if (open && aiCategories.length === 0) {
      if (existingTags.length > 0) {
        setAiCategories(existingTags);
      } else {
        // Only use defaults if no existing tags
        setAiCategories(DEFAULT_CATEGORIES.slice(0, 10)); // Start with fewer defaults
      }
    }
  }, [open, existingTags, aiCategories.length]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState({ processed: 0, total: 0 });
  const [aiSuggestions, setAiSuggestions] = useState<TagSuggestion[]>([]);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

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

  // AI Tagging functions
  const booksToTag = useMemo(() => {
    if (selectedBookIds && selectedBookIds.size > 0) {
      return books.filter(b => selectedBookIds.has(b.id));
    }
    return books;
  }, [books, selectedBookIds]);

  const handleAddCategory = useCallback(() => {
    const trimmed = newCategoryInput.trim().toLowerCase();
    if (trimmed && !aiCategories.includes(trimmed)) {
      setAiCategories(prev => [...prev, trimmed]);
      setNewCategoryInput('');
    }
  }, [newCategoryInput, aiCategories]);

  const handleRemoveCategory = useCallback((cat: string) => {
    setAiCategories(prev => prev.filter(c => c !== cat));
  }, []);

  const handleAITag = useCallback(async (tagAll: boolean, sampleSize?: number) => {
    // Prevent running if already in preview mode
    if (aiPreviewOpen) return;

    let targetBooks = tagAll ? books : booksToTag;

    // If sample size specified, take a random sample of untagged books
    if (sampleSize) {
      const untagged = books.filter(b => !b.tags || b.tags.length === 0);
      // Shuffle and take sample
      const shuffled = [...untagged].sort(() => Math.random() - 0.5);
      targetBooks = shuffled.slice(0, sampleSize);
    }

    if (targetBooks.length === 0) return;

    // Confirm for large batches
    if (targetBooks.length > 50 && !sampleSize) {
      const confirmed = window.confirm(
        `This will use AI to tag ${targetBooks.length} books. This may take a minute and uses API credits. Continue?`
      );
      if (!confirmed) return;
    }

    setAiLoading(true);
    setAiProgress({ processed: 0, total: targetBooks.length });

    try {
      const result = await tagBooksWithAI(
        targetBooks,
        aiCategories,
        (processed, total) => setAiProgress({ processed, total })
      );

      setAiSuggestions(result.suggestions);
      // Pre-select all suggestions
      setSelectedSuggestions(new Set(result.suggestions.map(s => s.bookId)));
      setAiPreviewOpen(true);
    } catch (error) {
      console.error('AI tagging error:', error);
    } finally {
      setAiLoading(false);
    }
  }, [books, booksToTag, aiCategories, aiPreviewOpen]);

  const handleApplySuggestions = useCallback(() => {
    aiSuggestions.forEach(suggestion => {
      if (selectedSuggestions.has(suggestion.bookId)) {
        const book = books.find(b => b.id === suggestion.bookId);
        if (book) {
          const currentTags = book.tags || [];
          const newTags = suggestion.suggestedTags.filter(t => !currentTags.includes(t));
          if (newTags.length > 0) {
            onUpdateBookTags(suggestion.bookId, [...currentTags, ...newTags]);
          }
        }
      }
    });
    setAiSuggestions([]);
    setAiPreviewOpen(false);
    setSelectedSuggestions(new Set());
  }, [aiSuggestions, selectedSuggestions, books, onUpdateBookTags]);

  const toggleSuggestionSelection = useCallback((bookId: string) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  }, []);

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
            {/* AI Tagging Section */}
            {isAITaggingAvailable() && !aiPreviewOpen && (
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="space-y-4">
                  {/* Step 1: Categories */}
                  <div>
                    <h3 className="font-medium flex items-center gap-2 mb-2">
                      <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded">1</span>
                      Choose categories to tag with
                    </h3>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {aiCategories.map(cat => (
                        <Badge
                          key={cat}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-destructive/20"
                          onClick={() => handleRemoveCategory(cat)}
                        >
                          {cat}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                      {aiCategories.length === 0 && (
                        <span className="text-xs text-muted-foreground">No categories - add some below</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add category (e.g., fiction, theology, business)..."
                        value={newCategoryInput}
                        onChange={e => setNewCategoryInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAddCategory}
                        disabled={!newCategoryInput.trim()}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Step 2: Tag Books */}
                  <div className="pt-2 border-t">
                    <div>
                      <h3 className="font-medium flex items-center gap-2 mb-2">
                        <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded">2</span>
                        Tag your books
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Test on a few books first to make sure the AI is working well, then tag all.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAITag(false, 10)}
                          disabled={aiLoading || aiCategories.length === 0}
                        >
                          {aiLoading && aiProgress.total <= 10 ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <Brain className="h-4 w-4 mr-2" />
                              Test with 10 Books
                            </>
                          )}
                        </Button>
                        {selectedBookIds && selectedBookIds.size > 0 ? (
                          <Button
                            onClick={() => handleAITag(false)}
                            disabled={aiLoading || aiCategories.length === 0}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {aiLoading && aiProgress.total > 10 ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {aiProgress.processed}/{aiProgress.total}
                              </>
                            ) : (
                              <>
                                <Brain className="h-4 w-4 mr-2" />
                                Tag {selectedBookIds.size} Selected
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleAITag(true)}
                            disabled={aiLoading || aiCategories.length === 0}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {aiLoading && aiProgress.total > 10 ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {aiProgress.processed}/{aiProgress.total}
                              </>
                            ) : (
                              <>
                                <Brain className="h-4 w-4 mr-2" />
                                Tag All {books.length} Books
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Preview Section */}
            {aiPreviewOpen && aiSuggestions.length > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium flex items-center gap-2 text-green-800 dark:text-green-200">
                      <Check className="h-4 w-4" />
                      Review & Apply Tags
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI suggested tags for {aiSuggestions.length} books. Uncheck any you don't want.
                    </p>
                  </div>

                  {/* Action buttons - always visible at top */}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAiPreviewOpen(false);
                        setAiSuggestions([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleApplySuggestions}
                      disabled={selectedSuggestions.size === 0}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Apply ({selectedSuggestions.size})
                    </Button>
                  </div>

                  {/* Tag summary */}
                  <div className="bg-white/50 dark:bg-black/20 rounded p-2">
                    <p className="text-xs text-muted-foreground mb-1">Tags that will be applied:</p>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(new Set(
                        aiSuggestions
                          .filter(s => selectedSuggestions.has(s.bookId))
                          .flatMap(s => s.suggestedTags)
                      )).map(tag => (
                        <Badge key={tag} className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Select all / none */}
                  <div className="flex gap-2 text-xs">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => setSelectedSuggestions(new Set(aiSuggestions.map(s => s.bookId)))}
                    >
                      Select all
                    </Button>
                    <span className="text-muted-foreground">|</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => setSelectedSuggestions(new Set())}
                    >
                      Select none
                    </Button>
                  </div>

                  {/* Suggestions list */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {aiSuggestions.map(suggestion => (
                      <div
                        key={suggestion.bookId}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedSuggestions.has(suggestion.bookId)
                            ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                            : 'bg-white dark:bg-muted/30 border border-transparent hover:bg-muted/50'
                        }`}
                        onClick={() => toggleSuggestionSelection(suggestion.bookId)}
                      >
                        <Checkbox
                          checked={selectedSuggestions.has(suggestion.bookId)}
                          onCheckedChange={() => toggleSuggestionSelection(suggestion.bookId)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate flex-1">{suggestion.title}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              suggestion.confidence === 'high'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : suggestion.confidence === 'medium'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }`}>
                              {suggestion.confidence === 'high' ? '✓' : suggestion.confidence === 'medium' ? '~' : '?'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {suggestion.suggestedTags.length > 0 ? (
                              suggestion.suggestedTags.map(tag => (
                                <Badge
                                  key={tag}
                                  className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200"
                                >
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No tags suggested</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
