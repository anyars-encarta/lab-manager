import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = drizzle(neon(process.env.DATABASE_URL));
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations completed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
