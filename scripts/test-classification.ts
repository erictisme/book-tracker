/**
 * Test script to verify book classification fix
 * Run with: npx tsx scripts/test-classification.ts
 */

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

// Books that were previously misclassified as podcasts
const testBooks = [
  { title: "Copywriting Secrets: How Everyone Can Use The Power Of Words To Get More Clicks, Sales and Profits", author: "Jim Edwards" },
  { title: "Honest Evangelism: How to talk about Jesus even when it's tough (Live Different)", author: "Rico Tice" },
  { title: "2084: Artificial Intelligence, the Future of Humanity, and the God Question", author: "John C. Lennox" },
  { title: "When God Writes Your Love Story (Expanded Edition): The Ultimate Guide to Guy/Girl Relationships", author: "Eric Ludy" },
  { title: "The Man Who Mistook His Wife For A Hat: And Other Clinical Tales", author: "Oliver Sacks" },
  { title: "Is God anti-gay? (Questions Christians Ask)", author: "Sam Allberry" },
  { title: "The Five Dysfunctions of a Team, Enhanced Edition: A Leadership Fable (J-B Lencioni Series)", author: "Patrick M. Lencioni" },
  { title: "On Marriage (How to Find God Book 2)", author: "Timothy Keller" },
];

// Podcasts that should correctly be identified as non-books
const testPodcasts = [
  { title: "147. On Hell", author: "Undeceptions with John Dickson" },
  { title: "Part 3: Three ways anyone can make a difference", author: "The 80,000 Hours Career Guide" },
  { title: "Dan Sundheim of D1 Capital on investing", author: "Cheeky Pint" },
  { title: "#42 How to Build Better Habits", author: "The Tim Ferriss Show" },
  { title: "Why Trump Just Gave China the Keys", author: "The Daily" },
  { title: "Seeing The Future from AI Companions", author: "The a16z Podcast" },
];

// Additional edge case books
const edgeCaseBooks = [
  { title: "1984", author: "George Orwell" }, // Year as title
  { title: "Fahrenheit 451", author: "Ray Bradbury" }, // Number in title
  { title: "Catch-22", author: "Joseph Heller" }, // Number with hyphen
  { title: "The 7 Habits of Highly Effective People", author: "Stephen R. Covey" }, // Number at start
  { title: "Deep Work: Rules for Focused Success in a Distracted World", author: "Cal Newport" }, // Subtitle
  { title: "How to Win Friends & Influence People", author: "Dale Carnegie" }, // Classic
];

function normalizeTitleForSearch(title: string): string[] {
  const variants: string[] = [];
  const original = title.replace(/["']/g, '').trim();
  const mainTitle = original.split(':')[0].trim();
  const withoutParens = mainTitle.replace(/\s*\([^)]*\)\s*$/g, '').trim();
  const cleaned = withoutParens.replace(/[?!.,]/g, '').trim();

  if (cleaned && cleaned.length >= 3) variants.push(cleaned);
  if (withoutParens !== cleaned && withoutParens.length >= 3) variants.push(withoutParens);
  if (mainTitle !== withoutParens && mainTitle.length >= 3) variants.push(mainTitle);

  return [...new Set(variants)];
}

async function searchGoogleBooksOnce(title: string, author?: string): Promise<boolean> {
  try {
    let query = `intitle:${encodeURIComponent(title)}`;
    if (author) {
      query += `+inauthor:${encodeURIComponent(author)}`;
    }

    const response = await fetch(`${GOOGLE_BOOKS_API}?q=${query}&maxResults=1`);
    if (!response.ok) return false;

    const data = await response.json();
    return (data.totalItems || 0) > 0;
  } catch {
    return false;
  }
}

async function existsOnGoogleBooks(title: string, author?: string): Promise<boolean> {
  const titleVariants = normalizeTitleForSearch(title);
  const authorName = author?.split(',')[0].trim();

  console.log(`  Title variants: ${JSON.stringify(titleVariants)}`);

  for (const variant of titleVariants) {
    if (authorName) {
      const found = await searchGoogleBooksOnce(variant, authorName);
      if (found) {
        console.log(`  ✓ Found with: "${variant}" + "${authorName}"`);
        return true;
      }
    }

    const foundTitleOnly = await searchGoogleBooksOnce(variant);
    if (foundTitleOnly) {
      console.log(`  ✓ Found with title only: "${variant}"`);
      return true;
    }
  }

  console.log(`  ✗ Not found in any variant`);
  return false;
}

/**
 * Quick heuristic check (matches the production code)
 */
function quickClassify(title: string, author: string): 'book' | 'podcast' | 'article' | null {
  const authorLower = author.toLowerCase();

  // Obvious podcasts
  if (authorLower.includes('podcast') ||
      authorLower.endsWith(' show') ||
      authorLower.includes('your uploads') ||
      authorLower.includes('private feed')) {
    return 'podcast';
  }

  // Episode number patterns (1-3 digits to avoid years like "2084:")
  if (/^\d{1,3}[\.\):\s]/.test(title) || /^#\d{1,3}/.test(title)) {
    return 'podcast';
  }

  // "Title | Show Name" format
  if (title.includes(' | ')) {
    return 'podcast';
  }

  // Obvious articles/newsletters
  if (authorLower.includes('newsletter') ||
      authorLower.includes('substack') ||
      authorLower.endsWith(' reads') ||
      authorLower.includes('guide chapter')) {
    return 'article';
  }

  // "Part X:" format
  if (/^part \d+:/i.test(title)) {
    return 'article';
  }

  return null; // Need API check
}

/**
 * Full classification flow (matches production)
 */
async function classify(title: string, author: string): Promise<'book' | 'podcast' | 'article'> {
  // First try quick heuristics
  const quick = quickClassify(title, author);
  if (quick) {
    console.log(`  Quick classify: ${quick}`);
    return quick;
  }

  // Fall back to Google Books API
  console.log(`  Checking Google Books API...`);
  const found = await existsOnGoogleBooks(title, author);
  return found ? 'book' : 'article'; // Default to article if not found
}

async function main() {
  console.log('\n=== Testing Books (should classify as "book") ===\n');

  let booksCorrect = 0;
  for (const book of testBooks) {
    console.log(`Testing: "${book.title}" by ${book.author}`);
    const result = await classify(book.title, book.author);
    if (result === 'book') {
      booksCorrect++;
      console.log(`  Result: ✓ ${result.toUpperCase()} (correct)\n`);
    } else {
      console.log(`  Result: ✗ ${result.toUpperCase()} (WRONG - should be book)\n`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n=== Testing Podcasts (should classify as "podcast" or "article") ===\n');

  let podcastsCorrect = 0;
  for (const podcast of testPodcasts) {
    console.log(`Testing: "${podcast.title}" by ${podcast.author}`);
    const result = await classify(podcast.title, podcast.author);
    if (result !== 'book') {
      podcastsCorrect++;
      console.log(`  Result: ✓ ${result.toUpperCase()} (correct)\n`);
    } else {
      console.log(`  Result: ✗ ${result.toUpperCase()} (WRONG - should not be book)\n`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n=== Testing Edge Case Books (should classify as "book") ===\n');

  let edgeCasesCorrect = 0;
  for (const book of edgeCaseBooks) {
    console.log(`Testing: "${book.title}" by ${book.author}`);
    const result = await classify(book.title, book.author);
    if (result === 'book') {
      edgeCasesCorrect++;
      console.log(`  Result: ✓ ${result.toUpperCase()} (correct)\n`);
    } else {
      console.log(`  Result: ✗ ${result.toUpperCase()} (WRONG - should be book)\n`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  const totalBooks = testBooks.length + edgeCaseBooks.length;
  const totalBooksCorrect = booksCorrect + edgeCasesCorrect;

  console.log('\n=== Summary ===');
  console.log(`Original misclassified books: ${booksCorrect}/${testBooks.length}`);
  console.log(`Edge case books: ${edgeCasesCorrect}/${edgeCaseBooks.length}`);
  console.log(`Non-books correctly identified: ${podcastsCorrect}/${testPodcasts.length}`);
  console.log(`\nTotal accuracy: ${totalBooksCorrect + podcastsCorrect}/${totalBooks + testPodcasts.length}`);
}

main().catch(console.error);
