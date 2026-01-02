import { useState, useMemo } from 'react';
import { BookOpen, Plus, Grid, List, Upload, BarChart3, Search, LogOut, Loader2, Check, Book as BookIcon, Trash2, X, HelpCircle, Clock, Pause, Tag, Copy, Star } from 'lucide-react';
import { Button } from './components/ui/button';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import { BookSearch } from './components/Books/BookSearch';
import { FinishDateDialog } from './components/Books/FinishDateDialog';
import { Input } from './components/ui/input';
import { BookGrid } from './components/Books/BookGrid';
import { BookCard } from './components/Books/BookCard';
import { BookDetailModal } from './components/Books/BookDetailModal';
import { ImportPage } from './components/Import/ImportPage';
import { YearStats } from './components/Stats/YearStats';
import { TagManager } from './components/Tags/TagManager';
import { DuplicateFinder } from './components/Tools/DuplicateFinder';
import { AuthPage } from './components/Auth/AuthPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useBooks } from './hooks/useBooks';
import { Toaster, toast } from 'sonner';
import type { Book, BookStatus, BookSource, CreateBookInput } from './types/book';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | BookStatus;
type FilterSource = 'all' | BookSource;

function MainApp() {
  const { user, signOut } = useAuth();
  const { books, addBook, updateBook, updateStatus, deleteBook, bulkAddBooks, bulkUpdateStatus, bulkDeleteBooks, findDuplicates } = useBooks();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterSource, setFilterSource] = useState<FilterSource>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [finishingBook, setFinishingBook] = useState<{ id: string; title: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [duplicateFinderOpen, setDuplicateFinderOpen] = useState(false);

  const handleAddBook = (input: CreateBookInput) => {
    addBook(input);
    toast.success(`Added "${input.title}" to your library`);
  };

  const handleStatusChange = (id: string, status: BookStatus) => {
    const book = books.find(b => b.id === id);
    if (!book) return;

    if (status === 'finished') {
      // Show date picker dialog for finish date
      setFinishingBook({ id, title: book.title });
    } else {
      updateStatus(id, status);
      toast.success(`Marked "${book.title}" as ${status.replace(/-/g, ' ')}`);
    }
  };

  const handleFinishConfirm = (date: string | null) => {
    if (!finishingBook) return;
    const book = books.find(b => b.id === finishingBook.id);

    // Update with the selected date (or null for current date)
    updateStatus(finishingBook.id, 'finished', date || undefined);

    setFinishingBook(null);

    // Prompt to add rating with clickable stars
    if (book) {
      const toastId = toast.success(
        <div className="flex flex-col gap-2">
          <span>Finished "{book.title}"!</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => {
                  updateBook(book.id, { rating: star });
                  toast.dismiss(toastId);
                  toast.success(`Rated ${star} star${star > 1 ? 's' : ''}`);
                }}
                className="p-0.5 hover:scale-125 transition-transform"
              >
                <Star className="h-5 w-5 text-yellow-400 hover:fill-yellow-400" />
              </button>
            ))}
          </div>
        </div>,
        { duration: 8000 }
      );
    }
  };

  const handleSaveBook = (updates: Partial<Book>) => {
    if (editingBook) {
      updateBook(editingBook.id, updates);
      toast.success('Book updated');
      setEditingBook(null);
    }
  };

  const handleDeleteBook = (id: string) => {
    const book = books.find(b => b.id === id);
    deleteBook(id);
    if (book) {
      toast.success(`Removed "${book.title}" from your library`);
    }
  };

  const handleBulkImport = async (booksToImport: CreateBookInput[]) => {
    const result = await bulkAddBooks(booksToImport);
    if (result.added > 0) {
      toast.success(`Imported ${result.added} books${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''}`);
    }
    return result;
  };

  const handleUpdateBookTags = (bookId: string, tags: string[]) => {
    updateBook(bookId, { tags });
  };

  const handleBulkStatusChange = async (status: BookStatus) => {
    if (isBulkUpdating) return;

    const ids = Array.from(selectedIds);
    console.log('handleBulkStatusChange called:', { status, selectedCount: ids.length });

    setIsBulkUpdating(true);
    toast.loading(`Updating ${ids.length} books...`, { id: 'bulk-update' });

    try {
      const result = await bulkUpdateStatus(ids, status);
      console.log('handleBulkStatusChange result:', result);

      if (result.updated > 0) {
        toast.success(`Updated ${result.updated} books to ${status.replace(/-/g, ' ')}`, { id: 'bulk-update' });
        setSelectedIds(new Set());
      } else {
        toast.error('No books updated - check console for details', { id: 'bulk-update' });
      }
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error(`Failed to update: ${error}`, { id: 'bulk-update' });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDelete = () => {
    console.log('handleBulkDelete called, selectedIds:', selectedIds.size);
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    console.log('Deleting books:', ids.length);
    const result = await bulkDeleteBooks(ids);
    console.log('Delete result:', result);
    if (result.deleted > 0) {
      toast.success(`Deleted ${result.deleted} books`);
      setSelectedIds(new Set());
    } else {
      toast.error('Failed to delete books');
    }
    setShowDeleteConfirm(false);
  };

  const filteredBooks = useMemo(() => {
    let result = books;

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(book => book.status === filterStatus);
    }

    // Filter by source
    if (filterSource !== 'all') {
      result = result.filter(book => book.source === filterSource);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(book =>
        book.title.toLowerCase().includes(query) ||
        book.authors.some(a => a.toLowerCase().includes(query)) ||
        book.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    return result;
  }, [books, filterStatus, filterSource, searchQuery]);

  const statusCounts = {
    all: books.length,
    'tbd': books.filter(b => b.status === 'tbd').length,
    'want-to-read': books.filter(b => b.status === 'want-to-read').length,
    'reading': books.filter(b => b.status === 'reading').length,
    'finished': books.filter(b => b.status === 'finished').length,
    'parked': books.filter(b => b.status === 'parked').length,
  };

  const sourceCounts = {
    all: books.length,
    manual: books.filter(b => b.source === 'manual').length,
    goodreads: books.filter(b => b.source === 'goodreads').length,
    libby: books.filter(b => b.source === 'libby').length,
    kindle: books.filter(b => b.source === 'kindle').length,
    kobo: books.filter(b => b.source === 'kobo').length,
    libro: books.filter(b => b.source === 'libro').length,
    paste: books.filter(b => b.source === 'paste').length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              <h1 className="text-xl font-bold">Book Tracker</h1>
            </div>

            <div className="flex items-center gap-2">
              <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Stats
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Year in Review</DialogTitle>
                  </DialogHeader>
                  <YearStats books={books} />
                </DialogContent>
              </Dialog>

              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Import Books</DialogTitle>
                  </DialogHeader>
                  <ImportPage
                    onImport={handleBulkImport}
                    onClose={() => setImportOpen(false)}
                    existingBooks={books}
                    onUpdateHighlights={(bookId, highlights) => {
                      updateBook(bookId, { highlights });
                      toast.success('Highlights imported');
                    }}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Book
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add a Book</DialogTitle>
                  </DialogHeader>
                  <BookSearch onAddBook={handleAddBook} />
                </DialogContent>
              </Dialog>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    {user?.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        {/* Quick Stats Dashboard */}
        {books.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">This Year</p>
              <p className="text-2xl font-bold">
                {books.filter(b => b.status === 'finished' && b.date_finished && new Date(b.date_finished).getFullYear() === new Date().getFullYear()).length}
              </p>
              <p className="text-xs text-muted-foreground">books finished</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Currently</p>
              <p className="text-2xl font-bold">{statusCounts.reading}</p>
              <p className="text-xs text-muted-foreground">reading</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Avg Rating</p>
              <p className="text-2xl font-bold">
                {books.filter(b => b.rating).length > 0
                  ? (books.filter(b => b.rating).reduce((sum, b) => sum + (b.rating || 0), 0) / books.filter(b => b.rating).length).toFixed(1)
                  : '-'}
              </p>
              <p className="text-xs text-muted-foreground">
                {books.filter(b => b.rating).length} rated
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Top Tags</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDuplicateFinderOpen(true)}
                    className="text-xs text-amber-600 hover:underline flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Dedupe
                  </button>
                  <button
                    onClick={() => setTagManagerOpen(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Tag className="h-3 w-3" />
                    Tags
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(() => {
                  const tagCounts: Record<string, number> = {};
                  books.forEach(b => b.tags?.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
                  const topTags = Object.entries(tagCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);

                  if (topTags.length === 0) {
                    return <span className="text-xs text-muted-foreground">No tags yet</span>;
                  }

                  return topTags.map(([tag, count]) => (
                    <button
                      key={tag}
                      onClick={() => setSearchQuery(tag)}
                      className="text-xs bg-background px-1.5 py-0.5 rounded hover:bg-primary/10 hover:text-primary transition-colors"
                      title={`${count} books`}
                    >
                      {tag}
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Selection Toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium mr-2">
              {isBulkUpdating ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating...
                </span>
              ) : (
                `${selectedIds.size} selected`
              )}
            </span>
            <div className="flex items-center gap-1 border-l pl-2">
              <Button size="sm" variant="ghost" onClick={() => handleBulkStatusChange('tbd')} disabled={isBulkUpdating} title="Mark as TBD">
                <HelpCircle className="h-4 w-4 mr-1" />
                TBD
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleBulkStatusChange('want-to-read')} disabled={isBulkUpdating} title="Mark as Want to Read">
                <Clock className="h-4 w-4 mr-1" />
                Want
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleBulkStatusChange('reading')} disabled={isBulkUpdating} title="Mark as Reading">
                <BookOpen className="h-4 w-4 mr-1" />
                Reading
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleBulkStatusChange('finished')} disabled={isBulkUpdating} title="Mark as Done">
                <Check className="h-4 w-4 mr-1" />
                Done
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleBulkStatusChange('parked')} disabled={isBulkUpdating} title="Mark as Parked">
                <Pause className="h-4 w-4 mr-1" />
                Parked
              </Button>
            </div>
            <div className="flex items-center gap-1 border-l pl-2">
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleBulkDelete} disabled={isBulkUpdating}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedIds(new Set())} disabled={isBulkUpdating}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, author, or tag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Status filter tabs */}
            <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)} className="flex-1 overflow-x-auto">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all">
                  All ({statusCounts.all})
                </TabsTrigger>
                <TabsTrigger value="tbd">
                  TBD ({statusCounts.tbd})
                </TabsTrigger>
                <TabsTrigger value="want-to-read">
                  Want ({statusCounts['want-to-read']})
                </TabsTrigger>
                <TabsTrigger value="reading">
                  Reading ({statusCounts.reading})
                </TabsTrigger>
                <TabsTrigger value="finished">
                  Done ({statusCounts.finished})
                </TabsTrigger>
                <TabsTrigger value="parked">
                  Parked ({statusCounts.parked})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Source filter dropdown */}
            <Select value={filterSource} onValueChange={(v) => setFilterSource(v as FilterSource)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sourceCounts.goodreads > 0 && (
                  <SelectItem value="goodreads">Goodreads ({sourceCounts.goodreads})</SelectItem>
                )}
                {sourceCounts.libby > 0 && (
                  <SelectItem value="libby">Libby ({sourceCounts.libby})</SelectItem>
                )}
                {sourceCounts.kindle > 0 && (
                  <SelectItem value="kindle">Kindle ({sourceCounts.kindle})</SelectItem>
                )}
                {sourceCounts.kobo > 0 && (
                  <SelectItem value="kobo">Kobo ({sourceCounts.kobo})</SelectItem>
                )}
                {sourceCounts.libro > 0 && (
                  <SelectItem value="libro">Libro.fm ({sourceCounts.libro})</SelectItem>
                )}
                {sourceCounts.manual > 0 && (
                  <SelectItem value="manual">Manual ({sourceCounts.manual})</SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* View toggle */}
            <div className="flex gap-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <Grid className="h-4 w-4" />
            </Button>
            </div>
          </div>
        </div>

        {/* Currently Reading - Quick access */}
        {filterStatus === 'all' && books.filter(b => b.status === 'reading').length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h2 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Currently Reading
            </h2>
            <div className="flex flex-wrap gap-3">
              {books.filter(b => b.status === 'reading').map(book => (
                <div
                  key={book.id}
                  className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-lg p-2 pr-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setEditingBook(book)}
                >
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} className="w-10 h-14 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                      <BookIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate max-w-[150px]">{book.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">{book.authors[0]}</p>
                  </div>
                  <Button
                    size="sm"
                    className="ml-2 bg-green-500 hover:bg-green-600 text-white h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(book.id, 'finished');
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Finish
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Books display */}
        {viewMode === 'grid' ? (
          <BookGrid
            books={filteredBooks}
            onStatusChange={handleStatusChange}
            onEdit={setEditingBook}
            onDelete={handleDeleteBook}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        ) : (
          <div className="space-y-3">
            {filteredBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <BookOpen className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">No books yet</p>
                <p className="text-sm">Search and add your first book!</p>
              </div>
            ) : (
              filteredBooks.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  onStatusChange={(status) => handleStatusChange(book.id, status)}
                  onEdit={() => setEditingBook(book)}
                  onDelete={() => handleDeleteBook(book.id)}
                />
              ))
            )}
          </div>
        )}
      </main>

      {/* Edit modal */}
      <BookDetailModal
        book={editingBook}
        open={!!editingBook}
        onOpenChange={(open) => !open && setEditingBook(null)}
        onSave={handleSaveBook}
        onStatusChange={(status) => {
          if (editingBook) {
            handleStatusChange(editingBook.id, status);
            // Update local state so modal shows new status immediately
            setEditingBook({ ...editingBook, status });
          }
        }}
      />

      {/* Finish date picker */}
      <FinishDateDialog
        open={!!finishingBook}
        bookTitle={finishingBook?.title || ''}
        onConfirm={handleFinishConfirm}
        onCancel={() => setFinishingBook(null)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} books?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected books from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TagManager
        books={books}
        selectedBookIds={selectedIds}
        onUpdateBookTags={handleUpdateBookTags}
        open={tagManagerOpen}
        onOpenChange={setTagManagerOpen}
      />

      <DuplicateFinder
        duplicateGroups={findDuplicates()}
        onDelete={bulkDeleteBooks}
        onMerge={updateBook}
        open={duplicateFinderOpen}
        onOpenChange={setDuplicateFinderOpen}
      />

      <Toaster position="bottom-right" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function PasswordResetForm() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    const { error } = await updatePassword(password);
    if (error) {
      setError(error.message);
    } else {
      toast.success('Password updated successfully!');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <BookOpen className="h-12 w-12" />
          <h1 className="text-2xl font-bold">Set New Password</h1>
          <p className="text-muted-foreground text-center">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">New Password</label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              minLength={6}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Update Password
          </Button>
        </form>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}

function AppContent() {
  const { user, isLoading, isRecovery } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isRecovery && user) {
    return <PasswordResetForm />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return <MainApp />;
}

export default App;
