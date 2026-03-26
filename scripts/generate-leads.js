require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const firstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Raymond', 'Gregory', 'Frank', 'Alexander', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Dorothy', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen', 'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather'];

const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'];

const companies = ['TechCorp', 'InnovateTech', 'DataDriven', 'CloudFirst', 'AIVentures', 'DigitalEdge', 'SmartSolutions', 'FutureTech', 'NextGen Systems', 'Quantum Labs', 'CyberSecure', 'BlockChain Inc', 'MetaVerse Co', 'RoboTech', 'BioTech Labs', 'GreenEnergy', 'FinTech Pro', 'HealthTech', 'EduTech', 'AgriTech', 'SpaceTech', 'AutoDrive', 'IoT Solutions', 'ML Dynamics', 'Deep Learning Co', 'Neural Networks', 'Crypto Ventures', 'Web3 Labs', 'SaaS Platform', 'DevOps Pro', 'Acme Corp', 'Global Industries', 'Premier Solutions', 'Elite Services', 'Prime Tech', 'Alpha Systems', 'Beta Labs', 'Gamma Corp', 'Delta Tech', 'Omega Solutions', 'Apex Industries', 'Summit Group', 'Pinnacle Tech', 'Zenith Corp', 'Vertex Labs', 'Horizon Systems', 'Catalyst Inc', 'Synergy Tech', 'Fusion Labs', 'Momentum Corp'];

const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'techcorp.com', 'innovate.io', 'company.com', 'enterprise.net', 'business.org', 'startup.co', 'corp.com', 'inc.net', 'llc.com', 'group.io', 'solutions.com', 'services.net', 'digital.io', 'cloud.com', 'data.io', 'ai.co', 'tech.io', 'dev.com', 'app.io', 'web.co', 'net.io', 'sys.com', 'lab.io', 'hub.co', 'pro.io', 'plus.com'];

const sources = ['LinkedIn', 'Website', 'Referral', 'Cold Outreach', 'Conference', 'Webinar', 'Social Media', 'Email Campaign', 'Partner', 'Organic Search', 'Paid Ads', 'Trade Show', 'Content Marketing', 'Direct Mail', 'Networking Event'];

const statuses = ['active', 'contacted', 'qualified', 'negotiation', 'closed', 'lost'];

const tags = ['enterprise', 'smb', 'startup', 'hot-lead', 'cold-lead', 'warm-lead', 'decision-maker', 'influencer', 'technical', 'executive', 'marketing', 'sales', 'finance', 'hr', 'it', 'operations', 'c-suite', 'vp-level', 'director', 'manager'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTags() {
  const count = Math.floor(Math.random() * 4);
  const selected = [];
  for (let i = 0; i < count; i++) {
    const tag = randomElement(tags);
    if (!selected.includes(tag)) selected.push(tag);
  }
  return selected;
}

function generatePhone() {
  const area = Math.floor(Math.random() * 900) + 100;
  const mid = Math.floor(Math.random() * 900) + 100;
  const end = Math.floor(Math.random() * 9000) + 1000;
  return `+1-${area}-${mid}-${end}`;
}

function generateLead(index) {
  const firstName = randomElement(firstNames);
  const lastName = randomElement(lastNames);
  const company = randomElement(companies);
  const domain = Math.random() > 0.4 ? `${company.toLowerCase().replace(/\s+/g, '')}.com` : randomElement(domains);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${domain}`;
  
  return {
    email,
    email_normalized: email.toLowerCase(),
    first_name: firstName,
    last_name: lastName,
    company,
    domain,
    phone: generatePhone(),
    linkedin_url: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${index}`,
    source: randomElement(sources),
    status: randomElement(statuses),
    tags: randomTags()
  };
}

async function insertBatch(leads) {
  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  for (const lead of leads) {
    placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10})`);
    values.push(
      lead.email,
      lead.email_normalized,
      lead.first_name,
      lead.last_name,
      lead.company,
      lead.domain,
      lead.phone,
      lead.linkedin_url,
      lead.source,
      lead.status,
      lead.tags
    );
    paramIndex += 11;
  }

  const query = `
    INSERT INTO leads (email, email_normalized, first_name, last_name, company, domain, phone, linkedin_url, source, status, tags)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (email_normalized) DO NOTHING
  `;

  await pool.query(query, values);
}

async function main() {
  const TOTAL_LEADS = 50000;
  const BATCH_SIZE = 1000;
  
  console.log(`Starting to generate and insert ${TOTAL_LEADS} leads...`);
  console.log(`Using batch size of ${BATCH_SIZE}`);
  
  const startTime = Date.now();
  let inserted = 0;

  for (let i = 0; i < TOTAL_LEADS; i += BATCH_SIZE) {
    const batch = [];
    const batchEnd = Math.min(i + BATCH_SIZE, TOTAL_LEADS);
    
    for (let j = i; j < batchEnd; j++) {
      batch.push(generateLead(j));
    }

    await insertBatch(batch);
    inserted += batch.length;
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (inserted / elapsed).toFixed(0);
    console.log(`Inserted ${inserted}/${TOTAL_LEADS} leads (${rate} leads/sec)`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nCompleted! Inserted ${TOTAL_LEADS} leads in ${totalTime} seconds`);
  
  const count = await pool.query('SELECT COUNT(*) FROM leads');
  console.log(`Total leads in database: ${count.rows[0].count}`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
