import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is missing.");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString });

async function seed() {
  const hash = await bcrypt.hash('password123', 10);
  try {
    await pool.query(
      'INSERT INTO admins (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      ['Admin', 'admin@artech.com', hash, 'super_admin']
    );
    console.log('Successfully created admin: admin@artech.com / password123');
  } catch (err) {
    if (err.code === '23505') {
       console.log('Admin already exists.');
    } else {
       console.error(err);
    }
  } finally {
    await pool.end();
  }
}

seed();
