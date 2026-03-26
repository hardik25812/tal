require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function exportLeads() {
  console.log('Fetching leads from database...');
  
  const result = await pool.query(`
    SELECT 
      email,
      first_name,
      last_name,
      company,
      domain,
      phone,
      linkedin_url,
      source,
      status,
      array_to_string(tags, ';') as tags
    FROM leads
    ORDER BY created_at DESC
  `);

  console.log(`Found ${result.rows.length} leads`);

  // Create CSV content
  const headers = ['email', 'first_name', 'last_name', 'company', 'domain', 'phone', 'linkedin_url', 'source', 'status', 'tags'];
  
  let csv = headers.join(',') + '\n';
  
  for (const row of result.rows) {
    const values = headers.map(h => {
      const val = row[h] || '';
      // Escape commas and quotes in values
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csv += values.join(',') + '\n';
  }

  const outputPath = path.join(__dirname, '..', 'leads_export_50k.csv');
  fs.writeFileSync(outputPath, csv);
  
  console.log(`\nExported to: ${outputPath}`);
  console.log(`Total rows: ${result.rows.length}`);
  
  await pool.end();
}

exportLeads().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
