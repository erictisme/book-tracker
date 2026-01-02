-- 003: Auto-update updated_at timestamp

-- Create function to update timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger for books table
create trigger update_books_updated_at
  before update on books
  for each row
  execute function update_updated_at_column();
