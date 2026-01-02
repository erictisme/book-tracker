import { useMemo, useState } from 'react';
import { Book, BookOpen, Star, TrendingUp, Calendar } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import type { Book as BookType, YearStats as YearStatsType } from '../../types/book';

interface YearStatsProps {
  books: BookType[];
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function calculateYearStats(books: BookType[], year: number): YearStatsType {
  const finishedThisYear = books.filter(b => {
    if (b.status !== 'finished' || !b.date_finished) return false;
    return new Date(b.date_finished).getFullYear() === year;
  });

  // Books per month
  const booksPerMonth = MONTHS.map((month, index) => ({
    month,
    count: finishedThisYear.filter(b => {
      const date = new Date(b.date_finished!);
      return date.getMonth() === index;
    }).length,
  }));

  // Total pages
  const pagesRead = finishedThisYear.reduce(
    (sum, book) => sum + (book.page_count || 0),
    0
  );

  // Average rating (only rated books)
  const ratedBooks = finishedThisYear.filter(b => b.rating && b.rating > 0);
  const averageRating = ratedBooks.length > 0
    ? ratedBooks.reduce((sum, b) => sum + b.rating!, 0) / ratedBooks.length
    : 0;

  // Tag breakdown
  const tagCounts = new Map<string, number>();
  finishedThisYear.forEach(book => {
    book.tags?.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
    // Also count genres as tags
    book.genres?.forEach(genre => {
      tagCounts.set(genre, (tagCounts.get(genre) || 0) + 1);
    });
  });
  const tagBreakdown = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Genre breakdown (separate from tags)
  const genreCounts = new Map<string, number>();
  finishedThisYear.forEach(book => {
    book.genres?.forEach(genre => {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    });
  });
  const genreBreakdown = Array.from(genreCounts.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top rated books
  const topRatedBooks = [...finishedThisYear]
    .filter(b => b.rating && b.rating >= 4)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);

  // Reading streak (consecutive months with at least 1 book)
  let streak = 0;
  let maxStreak = 0;
  for (let i = 0; i < 12; i++) {
    if (booksPerMonth[i].count > 0) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }

  return {
    year,
    booksRead: finishedThisYear.length,
    pagesRead,
    averageRating,
    booksPerMonth,
    genreBreakdown,
    tagBreakdown,
    topRatedBooks,
    readingStreak: maxStreak,
  };
}

function getAvailableYears(books: BookType[]): number[] {
  const years = new Set<number>();
  const currentYear = new Date().getFullYear();

  books.forEach(book => {
    if (book.date_finished) {
      years.add(new Date(book.date_finished).getFullYear());
    }
    if (book.date_added) {
      years.add(new Date(book.date_added).getFullYear());
    }
  });

  // Always include current year and a few recent years
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.add(y);
  }

  return Array.from(years).sort((a, b) => b - a);
}

export function YearStats({ books }: YearStatsProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const availableYears = useMemo(() => getAvailableYears(books), [books]);
  const stats = useMemo(() => calculateYearStats(books, selectedYear), [books, selectedYear]);

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Year in Review</h2>
        <Select
          value={selectedYear.toString()}
          onValueChange={(v) => setSelectedYear(parseInt(v))}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Books Read</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.booksRead}</div>
            <p className="text-xs text-muted-foreground">
              {stats.booksRead > 0 ? `~${Math.round(stats.booksRead / 12 * 10) / 10}/month` : 'Start reading!'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pages Read</CardTitle>
            <Book className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pagesRead.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.booksRead > 0 ? `~${Math.round(stats.pagesRead / stats.booksRead)} avg/book` : 'No pages yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.averageRating > 0 ? 'out of 5 stars' : 'No ratings yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Streak</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.readingStreak}</div>
            <p className="text-xs text-muted-foreground">
              {stats.readingStreak > 0 ? 'consecutive months' : 'No streak yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Books by Month Chart */}
      {stats.booksRead > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Books by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.booksPerMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="Books"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Genre Breakdown */}
      {stats.genreBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Genres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.genreBreakdown}
                    dataKey="count"
                    nameKey="genre"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {stats.genreBreakdown.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Rated Books */}
      {stats.topRatedBooks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Top Rated Books
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {stats.topRatedBooks.map((book) => (
                  <div
                    key={book.id}
                    className="flex items-center gap-3"
                  >
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-10 h-14 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                        <Book className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{book.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {book.authors.join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{book.rating}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {stats.booksRead === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">No books finished in {selectedYear}</p>
            <p className="text-sm">Mark books as finished to see your stats!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
