import React, { useState, useCallback, type DragEvent } from 'react';
import { Upload, FileText, Book as BookIcon, Check, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { importGoodreadsCSV } from '../../services/goodreadsImport';
import { importLibbyCSV } from '../../services/libbyImport';
import { importKindleText } from '../../services/kindleImport';
import { importKoboLibrary } from '../../services/koboImport';
import { batchEnrichBooks } from '../../services/googleBooksApi';
import { parseWithAI, isAIParsingAvailable } from '../../services/aiParser';
import {
  parseKindleClippings,
  groupHighlightsByBook,
  findMatchingBook,
  type BookHighlights,
  type HighlightImportResult,
} from '../../services/kindleHighlightsImport';
import type { CreateBookInput, ImportResult, Book } from '../../types/book';

interface ImportPageProps {
  onImport: (books: CreateBookInput[]) => ImportResult | Promise<ImportResult>;
  onClose: () => void;
  existingBooks?: Book[];
  onUpdateHighlights?: (bookId: string, highlights: string[]) => void;
}

type ImportSource = 'goodreads' | 'libby' | 'kindle' | 'kobo' | 'highlights';

export function ImportPage({ onImport, onClose, existingBooks = [], onUpdateHighlights }: ImportPageProps) {
  const [activeTab, setActiveTab] = useState<ImportSource>('goodreads');
  const [preview, setPreview] = useState<CreateBookInput[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kindleText, setKindleText] = useState('');
  const [koboText, setKoboText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [highlightsPreview, setHighlightsPreview] = useState<BookHighlights[]>([]);
  const [highlightResult, setHighlightResult] = useState<HighlightImportResult | null>(null);
  const [enrichEnabled, setEnrichEnabled] = useState(true);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });
  const [isAIParsing, setIsAIParsing] = useState(false);

  const processFile = useCallback(async (file: File, source: ImportSource) => {
    setError(null);
    setResult(null);
    setHighlightResult(null);

    try {
      const text = await file.text();

      if (source === 'highlights') {
        // Parse Kindle clippings
        const clippings = parseKindleClippings(text);
        const grouped = groupHighlightsByBook(clippings);
        setHighlightsPreview(grouped);
        setPreview([]);
      } else {
        let books: CreateBookInput[];

        if (source === 'goodreads') {
          books = importGoodreadsCSV(text);
        } else if (source === 'libby') {
          books = importLibbyCSV(text);
        } else {
          books = importKindleText(text);
        }

        setPreview(books);
        setHighlightsPreview([]);
      }
    } catch (err) {
      setError(`Failed to parse file: ${err}`);
      setPreview([]);
      setHighlightsPreview([]);
    }
  }, []);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>, source: ImportSource) => {
      const file = event.target.files?.[0];
      if (!file) return;
      processFile(file, source);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLLabelElement>, source: ImportSource) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      processFile(file, source);
    } else {
      setError('Please drop a CSV file');
    }
  }, [processFile]);

  const handleKindleTextChange = useCallback((text: string) => {
    setKindleText(text);
    setError(null);
    setResult(null);

    if (text.trim()) {
      try {
        const books = importKindleText(text);
        setPreview(books);
      } catch (err) {
        setError(`Failed to parse text: ${err}`);
        setPreview([]);
      }
    } else {
      setPreview([]);
    }
  }, []);

  // Debounce timer ref
  const koboDebounceRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleKoboTextChange = useCallback((text: string) => {
    setKoboText(text);
    setError(null);
    setResult(null);

    // Clear existing debounce
    if (koboDebounceRef.current) {
      clearTimeout(koboDebounceRef.current);
    }

    if (!text.trim()) {
      setPreview([]);
      return;
    }

    // Debounce parsing (500ms)
    koboDebounceRef.current = setTimeout(async () => {
      const lines = text.trim().split('\n').filter(l => l.trim()).length;
      let books: CreateBookInput[] = [];
      let useAI = false;

      // Try regular parser first
      try {
        books = importKoboLibrary(text);

        // Detect bad parse: many lines but few books = parser confused
        if (lines >= 10 && books.length < 3) {
          useAI = true;
        }
      } catch (err) {
        console.warn('Regular parser failed:', err);
        useAI = true;
      }

      // Auto-fallback to AI if needed
      if (useAI && isAIParsingAvailable()) {
        setIsAIParsing(true);
        setError(null);

        try {
          books = await parseWithAI(text, 'kobo');
        } catch (aiErr) {
          console.error('AI fallback also failed:', aiErr);
          setError(`Parsing failed. AI fallback error: ${aiErr}`);
          setPreview([]);
          setIsAIParsing(false);
          return;
        }

        setIsAIParsing(false);
      }

      setPreview(books);
    }, 500);
  }, []);

  const handleAIParse = useCallback(async (text: string, source: 'kobo' | 'kindle') => {
    if (!text.trim()) return;

    setIsAIParsing(true);
    setError(null);

    try {
      const books = await parseWithAI(text, source);
      setPreview(books);
    } catch (err) {
      setError(`AI parsing failed: ${err}`);
    } finally {
      setIsAIParsing(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (preview.length === 0) return;

    let booksToImport = preview;

    // Optionally enrich books with Google Books data
    if (enrichEnabled) {
      setIsEnriching(true);
      setEnrichProgress({ current: 0, total: preview.length });

      try {
        booksToImport = await batchEnrichBooks(
          preview,
          250, // 250ms delay between API calls
          (current, total) => setEnrichProgress({ current, total })
        );
      } catch (err) {
        console.warn('Enrichment failed:', err);
        // Continue with original books if enrichment fails
      }

      setIsEnriching(false);
    }

    const importResult = await onImport(booksToImport);
    setResult(importResult);
    setPreview([]);
    setKindleText('');
    setKoboText('');
  }, [preview, onImport, enrichEnabled]);

  const handleImportHighlights = useCallback(() => {
    if (highlightsPreview.length === 0 || !onUpdateHighlights) return;

    const existingTitles = existingBooks.map(b => b.title);
    let matched = 0;
    let totalHighlights = 0;
    const unmatchedBooks: string[] = [];

    for (const bookHighlights of highlightsPreview) {
      totalHighlights += bookHighlights.highlights.length;

      const matchedTitle = findMatchingBook(bookHighlights.bookTitle, existingTitles);

      if (matchedTitle) {
        const matchedBook = existingBooks.find(b => b.title === matchedTitle);
        if (matchedBook) {
          // Merge with existing highlights
          const existingHighlights = matchedBook.highlights || [];
          const newHighlights = bookHighlights.highlights.filter(
            h => !existingHighlights.includes(h)
          );
          if (newHighlights.length > 0) {
            onUpdateHighlights(matchedBook.id, [...existingHighlights, ...newHighlights]);
            matched++;
          }
        }
      } else {
        unmatchedBooks.push(bookHighlights.bookTitle);
      }
    }

    setHighlightResult({
      matched,
      unmatched: unmatchedBooks.length,
      totalHighlights,
      unmatchedBooks,
    });
    setHighlightsPreview([]);
  }, [highlightsPreview, existingBooks, onUpdateHighlights]);

  return (
    <div className="space-y-6 overflow-hidden">
      {/* Result alert */}
      {result && (
        <Alert variant={result.errors.length > 0 ? 'destructive' : 'default'}>
          <Check className="h-4 w-4" />
          <AlertTitle>Import Complete</AlertTitle>
          <AlertDescription>
            Added {result.added} books, skipped {result.skipped} duplicates.
            {result.errors.length > 0 && (
              <span className="block mt-1 text-destructive">
                {result.errors.length} errors occurred.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as ImportSource);
        setPreview([]);
        setHighlightsPreview([]);
        setResult(null);
        setHighlightResult(null);
        setError(null);
      }}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="goodreads">Goodreads</TabsTrigger>
          <TabsTrigger value="libby">Libby</TabsTrigger>
          <TabsTrigger value="kindle">Kindle</TabsTrigger>
          <TabsTrigger value="kobo">Kobo</TabsTrigger>
          <TabsTrigger value="highlights">Highlights</TabsTrigger>
        </TabsList>

        {/* Goodreads Tab */}
        <TabsContent value="goodreads">
          <Card>
            <CardHeader>
              <CardTitle>Import from Goodreads</CardTitle>
              <CardDescription>
                Export your library from Goodreads (My Books → Import/Export → Export Library)
                and upload the CSV file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  isDragging ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'goodreads')}
              >
                <Upload className={`h-8 w-8 mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">
                  Drag & drop or click to upload goodreads_library_export.csv
                </span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'goodreads')}
                />
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Libby Tab */}
        <TabsContent value="libby">
          <Card>
            <CardHeader>
              <CardTitle>Import from Libby</CardTitle>
              <CardDescription>
                Export your timeline from Libby (Settings → Timeline → Export Timeline)
                and upload the CSV file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  isDragging ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'libby')}
              >
                <Upload className={`h-8 w-8 mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">
                  Drag & drop or click to upload libbytimeline-all-loans.csv
                </span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'libby')}
                />
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kindle Tab */}
        <TabsContent value="kindle">
          <Card>
            <CardHeader>
              <CardTitle>Import from Kindle</CardTitle>
              <CardDescription>
                Copy your Kindle library list and paste it below.
                Format: Title on one line, Author on the next.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="The SaaS Playbook: Build a Multimillion-Dollar Startup
Rob Walling
Impromptu: Amplifying Our Humanity Through AI
Reid Hoffman
..."
                value={kindleText}
                onChange={(e) => handleKindleTextChange(e.target.value)}
                rows={8}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Paste Title/Author pairs from Kindle library.
                </p>
                {isAIParsingAvailable() && kindleText.trim() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAIParse(kindleText, 'kindle')}
                    disabled={isAIParsing}
                  >
                    {isAIParsing ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        Reparse
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kobo Tab */}
        <TabsContent value="kobo">
          <Card>
            <CardHeader>
              <CardTitle>Import from Kobo</CardTitle>
              <CardDescription>
                Go to your Kobo library (kobo.com → My Books), select all the table rows, copy (Ctrl+C / Cmd+C), and paste below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Platonic
Marisa G. Franco, PhD
Nonfiction
Unread
1/1/2026
Together
Vivek H Murthy
Nonfiction
Unread
1/1/2026
..."
                value={koboText}
                onChange={(e) => handleKoboTextChange(e.target.value)}
                rows={8}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Note: Items marked "Buy Now" or "Preview" will be skipped.
                </p>
                {isAIParsing && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Using AI to parse...
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Highlights Tab */}
        <TabsContent value="highlights">
          <Card>
            <CardHeader>
              <CardTitle>Import Kindle Highlights</CardTitle>
              <CardDescription>
                Upload your "My Clippings.txt" file from Kindle.
                Find it by connecting your Kindle via USB → documents folder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  isDragging ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'highlights')}
              >
                <Upload className={`h-8 w-8 mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">
                  Drag & drop or click to upload My Clippings.txt
                </span>
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'highlights')}
                />
              </label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview */}
      {preview.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Preview ({preview.length} books)</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {preview.slice(0, 50).map((book, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded border"
                  >
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-8 h-12 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        <BookIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {book.authors.join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
                {preview.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    ...and {preview.length - 50} more books
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Highlights Preview */}
      {highlightsPreview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Preview: {highlightsPreview.reduce((sum, b) => sum + b.highlights.length, 0)} highlights from {highlightsPreview.length} books
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {highlightsPreview.slice(0, 10).map((bookH, i) => {
                  const existingTitles = existingBooks.map(b => b.title);
                  const matchedTitle = findMatchingBook(bookH.bookTitle, existingTitles);
                  const isMatched = !!matchedTitle;

                  return (
                    <div key={i} className="border rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{bookH.bookTitle}</p>
                          <p className="text-sm text-muted-foreground">{bookH.author}</p>
                        </div>
                        <Badge variant={isMatched ? 'default' : 'secondary'}>
                          {isMatched ? `✓ Matches: ${matchedTitle}` : 'No match found'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {bookH.highlights.length} highlights
                        {bookH.notes.length > 0 && `, ${bookH.notes.length} notes`}
                      </p>
                      {bookH.highlights.length > 0 && (
                        <p className="text-sm italic mt-2 text-muted-foreground border-l-2 pl-2 truncate">
                          "{bookH.highlights[0]}"
                        </p>
                      )}
                    </div>
                  );
                })}
                {highlightsPreview.length > 10 && (
                  <p className="text-center text-sm text-muted-foreground">
                    ...and {highlightsPreview.length - 10} more books with highlights
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Highlight Import Result */}
      {highlightResult && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertTitle>Highlights Imported</AlertTitle>
          <AlertDescription>
            Added highlights to {highlightResult.matched} books.
            {highlightResult.unmatched > 0 && (
              <span className="block mt-1">
                {highlightResult.unmatched} books not found in library (import them first).
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        {/* Enrichment toggle */}
        {activeTab !== 'highlights' && preview.length > 0 && (
          <div className="flex items-center gap-2">
            <Switch
              id="enrich"
              checked={enrichEnabled}
              onCheckedChange={setEnrichEnabled}
              disabled={isEnriching}
            />
            <Label htmlFor="enrich" className="text-sm flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Enrich with Google Books
            </Label>
          </div>
        )}

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={onClose} disabled={isEnriching}>
            Cancel
          </Button>
          {activeTab === 'highlights' ? (
            <Button
              onClick={handleImportHighlights}
              disabled={highlightsPreview.length === 0 || !onUpdateHighlights}
            >
              <FileText className="h-4 w-4 mr-2" />
              Import Highlights
            </Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={preview.length === 0 || isEnriching}
            >
              {isEnriching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enriching {enrichProgress.current}/{enrichProgress.total}...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Import {preview.length} Books
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
