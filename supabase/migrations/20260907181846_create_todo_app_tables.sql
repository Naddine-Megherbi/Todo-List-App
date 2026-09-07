/*
# Create authenticated to-do application tables

1. New Tables
- `todo_themes` stores each user's personal visual theme choices, including a name and color.
- `todo_tasks` stores each user's tasks, optional notes, selected theme, deadline, reminder time, completion status, and completion timestamp.

2. Relationships
- Every theme and task belongs to one authenticated user.
- Tasks may optionally reference one of the owner's themes.

3. Security
- Row Level Security is enabled on both tables.
- Separate authenticated-only policies allow each user to create, read, update, and delete only their own data.

4. Important Notes
- Ownership defaults to the current signed-in user so new rows are safe even when the client does not send a user ID.
- Completed tasks remain stored for history while the app can visually fade them from the active list.
*/

CREATE TABLE IF NOT EXISTS public.todo_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.todo_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id uuid REFERENCES public.todo_themes(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  due_at timestamptz,
  reminder_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS todo_themes_user_id_idx ON public.todo_themes(user_id);
CREATE INDEX IF NOT EXISTS todo_tasks_user_id_idx ON public.todo_tasks(user_id);
CREATE INDEX IF NOT EXISTS todo_tasks_due_at_idx ON public.todo_tasks(user_id, due_at);

ALTER TABLE public.todo_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own todo themes" ON public.todo_themes;
CREATE POLICY "Users can view own todo themes" ON public.todo_themes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own todo themes" ON public.todo_themes;
CREATE POLICY "Users can create own todo themes" ON public.todo_themes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own todo themes" ON public.todo_themes;
CREATE POLICY "Users can update own todo themes" ON public.todo_themes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own todo themes" ON public.todo_themes;
CREATE POLICY "Users can delete own todo themes" ON public.todo_themes FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own todo tasks" ON public.todo_tasks;
CREATE POLICY "Users can view own todo tasks" ON public.todo_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own todo tasks" ON public.todo_tasks;
CREATE POLICY "Users can create own todo tasks" ON public.todo_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own todo tasks" ON public.todo_tasks;
CREATE POLICY "Users can update own todo tasks" ON public.todo_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own todo tasks" ON public.todo_tasks;
CREATE POLICY "Users can delete own todo tasks" ON public.todo_tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);
