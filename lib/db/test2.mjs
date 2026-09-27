import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('../../.env', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim();

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
pool.query('SELECT * FROM admins WHERE id = 8').then(res => {
  console.log('ADMIN:', res.rows);
  pool.end();
}).catch(err => {
  console.error('QUERY ERROR:', err);
  pool.end();
});
