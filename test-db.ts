import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const sql = neon("postgresql://neondb_owner:npg_PHuxZ72AoLaR@ep-lucky-salad-ass0np77-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
const db = drizzle(sql);

async function test() {
  const start = Date.now();
  try {
    const res = await sql`SELECT 1`;
    console.log("DB connected successfully in", Date.now() - start, "ms");
  } catch (err) {
    console.error("DB connection failed:", err);
  }
}
test();
