const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../../artifacts/api-server/.env') });

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT id, name, status FROM ushers WHERE id = 10');
  console.log('Usher 10:', res.rows);
  await client.end();
}

run().catch(console.error);
