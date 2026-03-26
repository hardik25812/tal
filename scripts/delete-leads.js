require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function deleteAllLeads() {
  console.log('Counting leads...');
  const countResult = await pool.query('SELECT COUNT(*) FROM leads');
  const count = parseInt(countResult.rows[0].count);
  console.log(`Found ${count} leads`);

  console.log('Deleting all leads...');
  await pool.query('DELETE FROM leads');
  
  console.log(`Deleted ${count} leads successfully!`);
  
  await pool.end();
}

deleteAllLeads().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
