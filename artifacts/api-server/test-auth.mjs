import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });

async function test() {
  try {
    const res = await pool.query('SELECT * FROM admins');
    console.log('Admins count:', res.rows.length);
    for (const admin of res.rows) {
      console.log('Admin email:', admin.email);
      console.log('Password Hash:', admin.password_hash);
      const match = await bcrypt.compare('password123', admin.password_hash);
      console.log('Match with password123:', match);
    }
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await pool.end();
  }
}

test();
