/**
 * AI-powered book categorization using Google Gemini
 */

import type { Book } from '../types/book';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Default categories - user can customize
export const DEFAULT_CATEGORIES = [
  'fiction',
  'non-fiction',
  'theology',
  'biography',
  'self-help',
  'business',
  'history',
  'science',
  'philosophy',
  'psychology',
  'parenting',
  'health',
  'memoir',
  'fantasy',
  'mystery',
  'romance',
  'classic',
  'productivity',
  'christianity',
  'leadership',
  'relationships',
  'finance',
  'technology',
  'politics',
  'education',
];

export interface TagSuggestion {
  bookId: string;
  title: string;
  suggestedTags: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface AITaggingResult {
  suggestions: TagSuggestion[];
  errors: string[];
  processed: number;
}

/**
 * Check if AI tagging is available (API key exists)
 */
export function isAITaggingAvailable(): boolean {
  return !!GEMINI_API_KEY && GEMINI_API_KEY.length > 0;
}

/**
 * Tag a batch of books using AI
 * @param books - Books to tag
 * @param categories - Available categories to choose from
 * @param batchSize - Number of books per API call (default 25)
 */
export async function tagBooksWithAI(
  books: Book[],
  categories: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<AITaggingResult> {
  if (!isAITaggingAvailable()) {
    return {
      suggestions: [],
      errors: ['Gemini API key not configured'],
      processed: 0,
    };
  }

  const allSuggestions: TagSuggestion[] = [];
  const allErrors: string[] = [];
  const BATCH_SIZE = 25;

  // Process in batches
  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE);

    try {
      const batchSuggestions = await tagBatch(batch, categories);
      allSuggestions.push(...batchSuggestions);
    } catch (error) {
      allErrors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error}`);
    }

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, books.length), books.length);
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < books.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return {
    suggestions: allSuggestions,
    errors: allErrors,
    processed: allSuggestions.length,
  };
}

/**
 * Tag a single batch of books
 */
async function tagBatch(books: Book[], categories: string[]): Promise<TagSuggestion[]> {
  const bookList = books.map((b, idx) =>
    `${idx + 1}. "${b.title}" by ${b.authors.join(', ')}`
  ).join('\n');

  const prompt = `You are a librarian categorizing books. For each book below, assign 1-3 tags from this list ONLY:

Available tags: ${categories.join(', ')}

Books to categorize:
${bookList}

Respond with a JSON array. Each item must have:
- "index": the book number (1-based)
- "tags": array of 1-3 tags from the available list
- "confidence": "high", "medium", or "low"

Example response:
[
  {"index": 1, "tags": ["theology", "christianity"], "confidence": "high"},
  {"index": 2, "tags": ["fiction", "fantasy"], "confidence": "medium"}
]

ONLY output the JSON array, nothing else.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as Array<{
    index: number;
    tags: string[];
    confidence: 'high' | 'medium' | 'low';
  }>;

  // Map back to book IDs
  return parsed.map(item => ({
    bookId: books[item.index - 1]?.id || '',
    title: books[item.index - 1]?.title || '',
    suggestedTags: item.tags.filter(t => categories.includes(t)), // Only keep valid tags
    confidence: item.confidence,
  })).filter(s => s.bookId); // Remove any invalid mappings
}

/**
 * Quick tag a single book
 */
export async function tagSingleBook(
  book: Book,
  categories: string[]
): Promise<string[]> {
  const result = await tagBooksWithAI([book], categories);
  return result.suggestions[0]?.suggestedTags || [];
}
