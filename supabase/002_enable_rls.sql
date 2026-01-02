-- 002: Enable Row Level Security
-- This ensures users can only see/edit their own books

-- Enable RLS on books table
alter table books enable row level security;

-- Policy: Users can only see their own books
create policy "Users can view own books"
  on books for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own books
create policy "Users can insert own books"
  on books for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own books
create policy "Users can update own books"
  on books for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own books
create policy "Users can delete own books"
  on books for delete
  using (auth.uid() = user_id);
