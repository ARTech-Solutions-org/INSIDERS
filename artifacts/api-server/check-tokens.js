import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM usher_push_tokens');
  console.log('Tokens in DB:', res.rows);
  await client.end();
}

run().catch(console.error);
