import postgres from "postgres";
import { readFileSync } from "fs";
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

const migrationFile = resolve(
  import.meta.dir,
  "../supabase/migrations/0001_schema.sql"
);
const migration = readFileSync(migrationFile, "utf-8");

console.log("Running migration: 0001_schema.sql ...");

try {
  await sql.unsafe(migration);
  console.log("✓ Migration applied successfully");
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  // "already exists" errors are safe to ignore on re-runs
  if (msg.includes("already exists")) {
    console.log("✓ Migration already applied (tables/policies exist)");
  } else {
    console.error("Migration failed:", msg);
    process.exit(1);
  }
} finally {
  await sql.end();
}
