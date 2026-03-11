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
// Store the promise so concurrent requests don't each trigger init
if (!globalThis.__dbInitPromise) {
  globalThis.__dbInitPromise = null;
}

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}

export async function ensureInitialized() {
  // Already completed — instant return, zero overhead
  if (globalThis.__dbInitPromise === true) return;
  // Already in progress — share the same promise
  if (globalThis.__dbInitPromise && globalThis.__dbInitPromise !== true) {
    return globalThis.__dbInitPromise;
  }
  // First call — start init and store promise
  globalThis.__dbInitPromise = initializeDatabase()
    .then(() => { globalThis.__dbInitPromise = true; console.log('DB initialized'); })
    .catch((e) => { globalThis.__dbInitPromise = null; console.error('DB init failed:', e); });
  return globalThis.__dbInitPromise;
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

    // Add enrichment tracking columns to campaign_leads
    await query(`ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending'`);
    await query(`ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITH TIME ZONE`);
    await query(`ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS enrichment_source TEXT`);
    await query(`CREATE INDEX IF NOT EXISTS idx_campaign_leads_enrichment_status ON campaign_leads(enrichment_status)`);

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

    // Unique constraint for campaign-specific custom fields (prevent duplicates per lead+field+campaign)
    try {
      await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lcf_unique ON lead_custom_fields(lead_id, field_name, COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'))`);
    } catch (e) {
      // Index may already exist or have conflicts
      if (!e.message.includes('already exists')) console.warn('idx_lcf_unique note:', e.message);
    }

    // ── CAMPAIGN_FIELD_TEMPLATES TABLE (Export Field Configuration) ──
    await query(`
      CREATE TABLE IF NOT EXISTS campaign_field_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        field_name TEXT NOT NULL,
        field_order INT DEFAULT 0,
        is_required BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cft_unique ON campaign_field_templates(campaign_id, field_name)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_cft_campaign ON campaign_field_templates(campaign_id)`);

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

    // ── USERS TABLE (Authentication & Role Management) ──
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        email_normalized TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        extraction_count INT DEFAULT 0,
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized ON users(email_normalized)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`);

    // Add created_by_user_id to activities for tracking who did what
    await query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_id UUID`);
    await query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_name TEXT`);

    // Add extracted_by to leads for tracking which assistant extracted the lead
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS extracted_by UUID`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS extracted_by_name TEXT`);

    // Add created_by to import_logs
    await query(`ALTER TABLE import_logs ADD COLUMN IF NOT EXISTS user_name TEXT`);

    // Seed default admin user if no users exist
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCount.rows[0].count) === 0) {
      const bcrypt = (await import('bcryptjs')).default;
      const hash = await bcrypt.hash('admin123', 10);
      await query(
        `INSERT INTO users (email, email_normalized, password_hash, name, role, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['admin@leados.com', 'admin@leados.com', hash, 'Admin', 'admin', 'active']
      );
      console.log('Default admin user created: admin@leados.com / admin123');
    }

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
