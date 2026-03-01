import { Pool } from 'pg';

// Use globalThis to survive Next.js dev mode module re-evaluation
if (!globalThis.__pgPool) {
  globalThis.__pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });
  globalThis.__pgPool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
}
const pool = globalThis.__pgPool;

// Track DB init globally so it only runs ONCE even across dev reloads
if (globalThis.__dbInitialized === undefined) {
  globalThis.__dbInitialized = false;
}

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 80), duration, rows: res.rowCount });
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

export async function ensureInitialized() {
  if (globalThis.__dbInitialized) return;
  try {
    await initializeDatabase();
    globalThis.__dbInitialized = true;
  } catch (e) {
    console.error('DB init failed:', e);
  }
}

// Initialize database tables with scalable schema
export async function initializeDatabase() {
  try {
    // ── LEADS TABLE (Core Master Table) ──
    await query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        email_normalized TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        company TEXT,
        domain TEXT,
        phone TEXT,
        linkedin_url TEXT,
        source TEXT,
        status TEXT DEFAULT 'active',
        tags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Add columns if they don't exist (migration for existing DBs)
    const newLeadColumns = [
      { name: 'email_normalized', type: "TEXT DEFAULT ''" },
      { name: 'phone', type: 'TEXT' },
      { name: 'linkedin_url', type: 'TEXT' },
      { name: 'source', type: 'TEXT' },
      { name: 'status', type: "TEXT DEFAULT 'active'" },
    ];
    for (const col of newLeadColumns) {
      await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
    }

    // Populate email_normalized for any existing rows
    await query(`UPDATE leads SET email_normalized = LOWER(TRIM(email)) WHERE email_normalized IS NULL OR email_normalized = ''`);

    // Leads indexes
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_normalized ON leads(email_normalized)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_leads_domain ON leads(domain)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`);

    // Full-text search vector column (generated / stored)
    try {
      await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (
          to_tsvector('simple',
            coalesce(email,'') || ' ' ||
            coalesce(first_name,'') || ' ' ||
            coalesce(last_name,'') || ' ' ||
            coalesce(company,'')
          )
        ) STORED`);
    } catch (e) {
      // Column may already exist – ignore
      if (!e.message.includes('already exists')) console.warn('search_vector column note:', e.message);
    }
    await query(`CREATE INDEX IF NOT EXISTS idx_leads_search_vector ON leads USING GIN(search_vector)`);

    // ── CAMPAIGNS TABLE ──
    await query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        owner VARCHAR(255) DEFAULT 'System',
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_by UUID`);
    await query(`CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC)`);

    // ── CAMPAIGN_LEADS TABLE (Many-to-Many) ──
    await query(`
      CREATE TABLE IF NOT EXISTS campaign_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        send_count INT DEFAULT 0,
        last_sent_at TIMESTAMP WITH TIME ZONE,
        campaign_status TEXT DEFAULT 'active'
      )
    `);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_leads_unique ON campaign_leads(campaign_id, lead_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON campaign_leads(lead_id)`);

    // ── LEAD_CUSTOM_FIELDS TABLE (Dynamic Fields, Normalized) ──
    await query(`
      CREATE TABLE IF NOT EXISTS lead_custom_fields (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        field_name TEXT NOT NULL,
        field_value TEXT,
        campaign_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_lcf_lead ON lead_custom_fields(lead_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_lcf_campaign ON lead_custom_fields(campaign_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_lcf_field_name ON lead_custom_fields(field_name)`);

    // ── IMPORT_LOGS TABLE ──
    await query(`
      CREATE TABLE IF NOT EXISTS import_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_name TEXT,
        total_rows INT DEFAULT 0,
        inserted_count INT DEFAULT 0,
        updated_count INT DEFAULT 0,
        duplicate_count INT DEFAULT 0,
        error_count INT DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // ── LISTS TABLE ──
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

    // ── ACTIVITIES TABLE ──
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
    await query(`CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC)`);

    // ── DATA MIGRATION: campaigns TEXT[] → campaign_leads ──
    try {
      const colCheck = await query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'campaigns'
      `);
      if (colCheck.rows.length > 0) {
        await query(`
          INSERT INTO campaign_leads (campaign_id, lead_id)
          SELECT unnest(campaigns)::uuid, id FROM leads
          WHERE campaigns IS NOT NULL AND array_length(campaigns, 1) > 0
          ON CONFLICT (campaign_id, lead_id) DO NOTHING
        `);
      }
    } catch (e) {
      console.warn('Campaign migration note:', e.message);
    }

    // ── DATA MIGRATION: custom_fields JSONB → lead_custom_fields ──
    try {
      const cfCheck = await query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'custom_fields'
      `);
      if (cfCheck.rows.length > 0) {
        await query(`
          INSERT INTO lead_custom_fields (lead_id, field_name, field_value)
          SELECT l.id, kv.key, kv.value::text
          FROM leads l, jsonb_each_text(l.custom_fields) AS kv(key, value)
          WHERE l.custom_fields IS NOT NULL AND l.custom_fields != '{}'::jsonb
          ON CONFLICT DO NOTHING
        `);
      }
    } catch (e) {
      console.warn('Custom fields migration note:', e.message);
    }

    console.log('Database tables initialized successfully (scalable schema)');
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export default pool;
