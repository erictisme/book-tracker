-- =====================================================
-- BOOK TRACKER - MASTER SCHEMA
-- Run this ONCE to set up everything correctly
-- Safe to re-run (idempotent)
-- =====================================================

-- =====================================================
-- 1. BOOKS TABLE - Ensure all columns exist
-- =====================================================

-- Core metadata
ALTER TABLE books ADD COLUMN IF NOT EXISTS open_library_id TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS isbn TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS page_count INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS first_published INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS publisher TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS genres TEXT[];

-- User tracking fields
ALTER TABLE books ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE books ADD COLUMN IF NOT EXISTS feelings TEXT[];
ALTER TABLE books ADD COLUMN IF NOT EXISTS quotes TEXT[];
ALTER TABLE books ADD COLUMN IF NOT EXISTS highlights TEXT[];
ALTER TABLE books ADD COLUMN IF NOT EXISTS progress INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS would_recommend TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS worldview_impact TEXT;

-- Dates
ALTER TABLE books ADD COLUMN IF NOT EXISTS date_added TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE books ADD COLUMN IF NOT EXISTS date_started TIMESTAMPTZ;
ALTER TABLE books ADD COLUMN IF NOT EXISTS date_finished TIMESTAMPTZ;

-- Source tracking
ALTER TABLE books ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE books ADD COLUMN IF NOT EXISTS source_id TEXT;

-- Goodreads community ratings
ALTER TABLE books ADD COLUMN IF NOT EXISTS goodreads_avg_rating DECIMAL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS goodreads_rating_count INTEGER;

-- =====================================================
-- 2. FIX STATUS CONSTRAINT - Include 'tbd'
-- =====================================================

-- Drop old constraint and add new one with all valid statuses
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_status_check;
ALTER TABLE books ADD CONSTRAINT books_status_check
  CHECK (status IN ('tbd', 'want-to-read', 'reading', 'finished', 'parked'));

-- =====================================================
-- 3. RLS POLICIES FOR BOOKS
-- =====================================================

-- Enable RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies (idempotent)
DROP POLICY IF EXISTS "Users can view own books" ON books;
CREATE POLICY "Users can view own books" ON books
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own books" ON books;
CREATE POLICY "Users can create own books" ON books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own books" ON books;
CREATE POLICY "Users can update own books" ON books
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own books" ON books;
CREATE POLICY "Users can delete own books" ON books
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 4. SHELVES TABLE (for future collections feature)
-- =====================================================

CREATE TABLE IF NOT EXISTS shelves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add shelf_id to books if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'shelf_id'
  ) THEN
    ALTER TABLE books ADD COLUMN shelf_id UUID REFERENCES shelves(id) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS for shelves
ALTER TABLE shelves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own shelves" ON shelves;
CREATE POLICY "Users can view own shelves" ON shelves
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own shelves" ON shelves;
CREATE POLICY "Users can create own shelves" ON shelves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own shelves" ON shelves;
CREATE POLICY "Users can update own shelves" ON shelves
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own shelves" ON shelves;
CREATE POLICY "Users can delete own shelves" ON shelves
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- DONE! All schema changes applied.
-- =====================================================
