/// <reference types="node" />
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/*",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
