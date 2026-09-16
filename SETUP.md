# SplitTab Setup Guide

## 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Run the migration SQL in **SQL Editor**:
   ```
   supabase/migrations/0001_schema.sql
   ```
4. Create storage bucket in **Storage**:
   - Name: `receipts`
   - Public: ✓
   - File size limit: 5 MB
   - Allowed MIME types: `image/jpeg, image/png, image/webp`

## 2. Environment Variables

Copy `.env.local` and fill in your values:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 3. Auth Settings (Supabase Dashboard)

Go to **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

## 4. Run Locally

```bash
bun install
bun dev
```

App runs at [http://localhost:3000](http://localhost:3000)

## 5. AI Model (Gemini)

Receipt parsing uses the **Gemini API** via the `@google/genai` SDK — no local
model download required.

1. Get a free API key at [aistudio.google.com](https://aistudio.google.com) → "Get API key"
2. Add to `.env.local`:
   ```
   GEMINI_API_KEY=AIza...
   ```

Free tier: 1,500 requests/day. Each parse takes ~2 seconds.

### Choosing a model

The default is `gemini-3.8-flash`. Override it, and the thinking budget, without
a code change:

```
GEMINI_MODEL=gemini-3.7-flash
GEMINI_THINKING_BUDGET=1024     # -1 dynamic, 0 off (default)
```

**Do not switch to a `flash-lite` model.** Every lite variant tested (2.5, 3.1,
3.5) misreads receipts whose amount column is printed offset by a line, with or
without a thinking budget. Every full `flash` model reads them correctly.

Check any replacement against a real receipt before shipping it:

```
bun parse:receipt ~/Downloads/receipt.jpg --expect 307
```

## Bill Flow

```
/login → /dashboard → /bills/new → /bills/{id}/upload
  → [AI parse, ~10-30s]
  → /bills/{id}/verify
  → /bills/{id}
```
