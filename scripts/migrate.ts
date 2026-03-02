import postgres from "postgres";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error("Error: SUPABASE_DB_URL is not set in .env.local");
  console.error(
    "\nFind it at: Supabase Dashboard → Settings → Database → Connection string (URI)"
  );
  console.error(
    "It looks like: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
  );
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: "require", max: 1 });

// Create migrations tracking table if it doesn't exist
await sql`
  create table if not exists public.schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`;

// Find all migration files, sorted by name
const migrationsDir = resolve(import.meta.dir, "../supabase/migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// Fetch already-applied migrations
const applied = await sql<{ name: string }[]>`
  select name from public.schema_migrations
`;
const appliedSet = new Set(applied.map((r) => r.name));

const pending = files.filter((f) => !appliedSet.has(f));

if (pending.length === 0) {
  console.log("Nothing to run — all migrations already applied.");
  await sql.end();
  process.exit(0);
}

for (const file of pending) {
  const migrationFile = resolve(migrationsDir, file);
  const migration = readFileSync(migrationFile, "utf-8");

  console.log(`Running migration: ${file} ...`);
  try {
    await sql.unsafe(migration);
    await sql`insert into public.schema_migrations (name) values (${file})`;
    console.log(`✓ ${file} applied`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${file} failed: ${msg}`);
    await sql.end();
    process.exit(1);
  }
}

await sql.end();
