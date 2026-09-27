import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const env = fs.readFileSync('../../.env', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL='))!.split('=').slice(1).join('=').trim();

const sql = neon(dbUrl);
sql`ALTER TABLE ushers ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ`
  .then(() => console.log('Column added successfully'))
  .catch(e => console.error('Error:', e.message));
