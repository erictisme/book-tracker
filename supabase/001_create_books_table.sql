-- 001: Create books table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/aiprtwztbsbdhwmuavyz/sql

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- From Open Library API
  open_library_id text,
  title text not null,
  authors text[] not null default '{}',
  cover_url text,
  page_count integer,
  first_published integer,
  genres text[] default '{}',
  isbn text,
  description text,

  -- User data
  status text not null default 'want-to-read' check (status in ('want-to-read', 'reading', 'finished', 'dropped')),
  rating integer check (rating >= 1 and rating <= 5),
  feelings text[] default '{}',
  notes text,
  quotes text[] default '{}',
  would_recommend text check (would_recommend in ('yes', 'no', 'maybe')),

  -- Enhanced tracking
  worldview_impact text,
  tags text[] default '{}',
  progress integer default 0 check (progress >= 0 and progress <= 100),
  highlights text[] default '{}',

  -- Dates
  date_added timestamp with time zone default now(),
  date_started timestamp with time zone,
  date_finished timestamp with time zone,

  -- Source tracking
  source text not null default 'manual' check (source in ('manual', 'goodreads', 'libby', 'kindle', 'kobo', 'libro', 'paste')),
  source_id text,

  -- Timestamps
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index for faster queries
create index if not exists books_user_id_idx on books(user_id);
create index if not exists books_status_idx on books(status);
create index if not exists books_date_finished_idx on books(date_finished);
