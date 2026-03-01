import { Pool } from 'pg';

// Parse DATABASE_URL or use individual components
const DATABASE_URL = process.env.DATABASE_URL;

// Create a connection pool with explicit config for special characters in password
const pool = new Pool({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.owiysougtgclotshwjip',
  password: 'Hardik1503@#',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
});

// Test connection on startup
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}

// Initialize database tables
export async function initializeDatabase() {
  try {
    // Create leads table
    await query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        company VARCHAR(255),
        domain VARCHAR(255),
        tags TEXT[] DEFAULT '{}',
        campaigns TEXT[] DEFAULT '{}',
        custom_fields JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create index on email for faster lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email)
    `);

    // Create index on created_at for date filtering
    await query(`
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)
    `);

    // Create campaigns table
    await query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        owner VARCHAR(255) DEFAULT 'System',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create lists table
    await query(`
      CREATE TABLE IF NOT EXISTS lists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        filters JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create activities table
    await query(`
      CREATE TABLE IF NOT EXISTS activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action VARCHAR(255) NOT NULL,
        lead_id UUID,
        lead_email VARCHAR(255),
        campaign_id UUID,
        campaign_name VARCHAR(255),
        list_id UUID,
        list_name VARCHAR(255),
        details TEXT,
        "user" VARCHAR(255) DEFAULT 'System',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create index on activities for faster lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC)
    `);

    console.log('Database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export default pool;
