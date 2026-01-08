/**
 * AI-powered parser using Google Gemini for messy import data
 *
 * Note: For personal use only. The API key is bundled in frontend.
 * For production, use a backend proxy.
 */

import type { CreateBookInput, Book } from '../types/book';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface ParsedBook {
  title: string;
  author: string;
  series?: string;
  genre?: string;
  status?: string;
  progress?: number;
  dateAdded?: string;
}

export type ImportSource = 'kobo' | 'kindle' | 'generic';

/**
 * Use Gemini to parse messy book data into structured format
 */
export async function parseWithAI(rawText: string, source: ImportSource = 'generic'): Promise<CreateBookInput[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const sourceHints: Record<ImportSource, string> = {
    kobo: 'This is from Kobo library. Skip "Buy Now" or "Preview" items. Status may be concatenated with date like "Unread1/1/2026".',
    kindle: 'This is from Kindle library. Format is usually "Title\\nAuthor" pairs.',
    generic: 'Parse any book data format.',
  };

  const prompt = `Parse this book library data into a JSON array. Each book should have:
- title (string, required)
- author (string, required - combine multiple authors with comma)
- series (string, optional - e.g. "Travel Guide", "Book 1")
- genre (string, optional)
- status (string, optional - "unread", "X% read", "100% read/played", "finished")
- progress (number 0-100, optional - extract from status like "65% read")
- dateAdded (string, optional - M/D/YYYY or YYYY-MM-DD format)

${sourceHints[source]}

Raw data:
${rawText}

Return ONLY a valid JSON array, no explanation. Example format:
[{"title": "Book Title", "author": "Author Name", "genre": "Nonfiction", "status": "unread", "dateAdded": "1/1/2026"}]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini response:', content);

    // Extract JSON from response (Claude might wrap it in markdown)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      throw new Error('Failed to parse AI response');
    }

    const parsed: ParsedBook[] = JSON.parse(jsonMatch[0]);

    // Convert to CreateBookInput format
    return parsed.map(book => {
      // Parse progress from status
      let progress: number | undefined;
      let finalStatus: CreateBookInput['status'] = 'tbd';

      if (book.progress !== undefined) {
        progress = book.progress;
      } else if (book.status) {
        const progressMatch = book.status.match(/(\d+)%/);
        if (progressMatch) {
          progress = parseInt(progressMatch[1], 10);
        }
      }

      // Only mark as finished if 100%
      if (progress === 100) {
        finalStatus = 'finished';
      }

      // Parse date
      let dateAdded: string | undefined;
      if (book.dateAdded) {
        const match = book.dateAdded.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) {
          const [, month, day, year] = match;
          dateAdded = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Parse authors
      const authors = book.author
        .replace(/\s*\+\d+$/, '') // Remove "+2" etc
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      return {
        title: book.title,
        authors: authors.length > 0 ? authors : ['Unknown'],
        status: finalStatus,
        progress,
        source: source === 'generic' ? 'manual' : source,
        date_added: dateAdded,
        date_finished: finalStatus === 'finished' ? dateAdded : undefined,
      } as CreateBookInput;
    });
  } catch (error) {
    console.error('AI parsing failed:', error);
    throw error;
  }
}

/**
 * Check if AI parsing is available (API key configured)
 */
export function isAIParsingAvailable(): boolean {
  return !!GEMINI_API_KEY;
}

/**
 * Call Gemini API helper
 */
async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Use AI to intelligently merge duplicate book data
 * Returns the best merged version of the book data
 */
export async function mergeWithAI(books: Book[]): Promise<Partial<Book>> {
  if (!GEMINI_API_KEY || books.length < 2) {
    return {};
  }

  const booksData = books.map(b => ({
    title: b.title,
    authors: b.authors,
    cover_url: b.cover_url ? 'has cover' : null,
    page_count: b.page_count,
    description: b.description ? b.description.slice(0, 200) + '...' : null,
    genres: b.genres,
    isbn: b.isbn,
    publisher: b.publisher,
    first_published: b.first_published,
    rating: b.rating,
    goodreads_avg_rating: b.goodreads_avg_rating,
    notes: b.notes ? 'has notes' : null,
    status: b.status,
    source: b.source,
  }));

  const prompt = `These are duplicate entries for the same book from different sources.
Choose the best/most complete data for each field.

Books:
${JSON.stringify(booksData, null, 2)}

Return a JSON object with the best values for:
- title (prefer longer/more complete title)
- authors (array)
- genres (combine unique genres)
- isbn
- publisher
- first_published
- page_count

Return ONLY valid JSON, no explanation.`;

  try {
    const content = await callGemini(prompt);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('AI merge failed:', error);
    return {};
  }
}

/**
 * Use AI to classify entries as books vs podcasts
 * Returns array of booleans (true = podcast)
 */
export async function classifyPodcastsWithAI(
  entries: Array<{ title: string; author: string }>
): Promise<boolean[]> {
  if (!GEMINI_API_KEY || entries.length === 0) {
    return entries.map(() => false);
  }

  // Format entries for the prompt
  const entriesList = entries.map((e, i) => `${i}. "${e.title}" by "${e.author}"`).join('\n');

  const prompt = `Classify each entry as BOOK (false) or PODCAST/ARTICLE (true).

BOOK (false) = Published book you can buy on Amazon/bookstores. Has a real author name.
Examples of BOOKS:
- "Deep Learning for Coders with fastai and PyTorch" by "Jeremy Howard" → false (technical book)
- "The Screwtape Letters" by "C. S. Lewis" → false (classic book)
- "Working Identity" by "Herminia Ibarra" → false (business book)
- "Culture Making" by "Andy Crouch" → false (Christian book)

PODCAST/ARTICLE (true) = Podcast episode, newsletter, video, online guide chapter. Author is usually a show/publication name.
Examples of PODCASTS:
- "Part 3: Three ways anyone can make a difference" by "The 80,000 Hours Career Guide" → true (guide chapter)
- "147. On Hell" by "Undeceptions with John Dickson" → true (podcast episode with number)
- "Dan Sundheim of D1 Capital on investing" by "Cheeky Pint" → true (podcast interview)
- "Seeing The Future from AI Companions" by "The a16z Show" → true (podcast)
- "Why Trump Just Gave China the Keys" by "The Daily" → true (news podcast)

KEY SIGNALS FOR PODCAST:
- Author contains "Podcast", "Show", "Daily", "Guide", "Reads"
- Title starts with "Part X:" or episode number "147."
- Title mentions specific people being interviewed "X on Y"

Entries to classify:
${entriesList}

Return ONLY a JSON array of ${entries.length} booleans (true=podcast, false=book).
Example format: [false, true, false, true]`;

  try {
    const content = await callGemini(prompt);
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON found in podcast classification response');
      return entries.map(() => false);
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate length
    if (result.length !== entries.length) {
      console.warn(`AI returned ${result.length} results for ${entries.length} entries`);
      // Pad or trim to match
      while (result.length < entries.length) result.push(false);
      return result.slice(0, entries.length);
    }

    return result;
  } catch (error) {
    console.error('AI podcast classification failed:', error);
    return entries.map(() => false);
  }
}

/**
 * Use AI to find potential duplicate groups that heuristics might miss
 */
export async function findDuplicatesWithAI(books: Book[]): Promise<string[][]> {
  if (!GEMINI_API_KEY || books.length < 2) {
    return [];
  }

  // Only send essential info to reduce tokens
  const booksInfo = books.map(b => ({
    id: b.id,
    title: b.title,
    author: b.authors[0],
  }));

  const prompt = `Find duplicate books in this list. Duplicates have:
- Same book with different title variations (e.g., with/without subtitle)
- Same author, similar title

Books:
${JSON.stringify(booksInfo, null, 2)}

Return a JSON array of arrays, where each inner array contains IDs of duplicate books.
Only include groups with 2+ duplicates. Return [] if no duplicates.
Return ONLY valid JSON, no explanation.`;

  try {
    const content = await callGemini(prompt);
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('AI duplicate detection failed:', error);
    return [];
  }
}
