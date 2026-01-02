import { useState, useCallback } from 'react';
import { Search, Plus, Loader2, Book } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { searchBooks, getCoverUrl, searchResultToBookInput } from '../../services/openLibrary';
import type { OpenLibrarySearchResult, CreateBookInput } from '../../types/book';

interface BookSearchProps {
  onAddBook: (book: CreateBookInput) => void;
}

export function BookSearch({ onAddBook }: BookSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenLibrarySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const searchResults = await searchBooks(query, 10);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleAddBook = (result: OpenLibrarySearchResult) => {
    const bookInput = searchResultToBookInput(result);
    onAddBook(bookInput);
    // Remove from results after adding
    setResults(prev => prev.filter(r => r.key !== result.key));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for a book..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Search'
          )}
        </Button>
      </div>

      {hasSearched && (
        <ScrollArea className="h-[400px]">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Book className="h-8 w-8 mb-2" />
              <p>No books found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map(result => (
                <Card
                  key={result.key}
                  className="p-3 flex gap-3 hover:bg-accent transition-colors"
                >
                  {result.cover_i ? (
                    <img
                      src={getCoverUrl(result.cover_i, 'S')}
                      alt={result.title}
                      className="w-12 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-muted rounded flex items-center justify-center">
                      <Book className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{result.title}</h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {result.author_name?.join(', ') || 'Unknown Author'}
                    </p>
                    {result.first_publish_year && (
                      <p className="text-xs text-muted-foreground">
                        {result.first_publish_year}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddBook(result)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
