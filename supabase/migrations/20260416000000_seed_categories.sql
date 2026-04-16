-- Seed initial content categories.
-- ON CONFLICT DO NOTHING makes the migration idempotent.

INSERT INTO categories (name) VALUES
  ('Cars'),
  ('Food'),
  ('Jokes'),
  ('Stand-up'),
  ('Daily Life'),
  ('Grooming'),
  ('Shopping'),
  ('Current Affairs')
ON CONFLICT (name) DO NOTHING;
