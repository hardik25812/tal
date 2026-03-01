import { NextResponse } from 'next/server';
import { query, initializeDatabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Initialize database on first request
let dbInitialized = false;

async function ensureDbInitialized() {
  if (!dbInitialized) {
    try {
      await initializeDatabase();
      dbInitialized = true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Helper to convert leads to CSV
function leadsToCSV(leads) {
  if (leads.length === 0) return '';
  
  const headers = ['email', 'first_name', 'last_name', 'company', 'domain', 'tags', 'created_at'];
  const customFieldKeys = new Set();
  
  leads.forEach(lead => {
    if (lead.custom_fields) {
      Object.keys(lead.custom_fields).forEach(key => customFieldKeys.add(key));
    }
  });
  
  const allHeaders = [...headers, ...Array.from(customFieldKeys)];
  const csvRows = [allHeaders.join(',')];
  
  leads.forEach(lead => {
    const row = allHeaders.map(header => {
      if (header === 'tags') {
        return `"${(lead.tags || []).join(';')}"`;
      }
      if (customFieldKeys.has(header)) {
        return `"${(lead.custom_fields?.[header] || '').toString().replace(/"/g, '""')}"`;
      }
      const value = lead[header] || '';
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
}

// Transform DB row to API response format
function transformLead(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    company: row.company,
    domain: row.domain,
    tags: row.tags || [],
    campaigns: row.campaigns || [],
    customFields: row.custom_fields || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function transformCampaign(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    owner: row.owner,
    leadsCount: parseInt(row.leads_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function transformList(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    filters: row.filters || {},
    leadsCount: parseInt(row.leads_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function transformActivity(row) {
  return {
    id: row.id,
    action: row.action,
    leadId: row.lead_id,
    leadEmail: row.lead_email,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    listId: row.list_id,
    listName: row.list_name,
    details: row.details,
    user: row.user,
    createdAt: row.created_at
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request, { params }) {
  await ensureDbInitialized();
  
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';
  const { searchParams } = new URL(request.url);

  try {
    // Health check
    if (pathStr === 'health') {
      try {
        await query('SELECT 1');
        return NextResponse.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() }, { headers: corsHeaders() });
      } catch (e) {
        return NextResponse.json({ status: 'error', database: 'disconnected', error: e.message }, { status: 500, headers: corsHeaders() });
      }
    }

    // Dashboard stats
    if (pathStr === 'dashboard/stats') {
      const totalLeads = await query('SELECT COUNT(*) as count FROM leads');
      const totalCampaigns = await query('SELECT COUNT(*) as count FROM campaigns');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const leadsToday = await query('SELECT COUNT(*) as count FROM leads WHERE created_at >= $1', [today.toISOString()]);
      const activeCampaigns = await query("SELECT COUNT(*) as count FROM campaigns WHERE status = 'active'");
      
      return NextResponse.json({
        totalLeads: parseInt(totalLeads.rows[0].count),
        totalCampaigns: parseInt(totalCampaigns.rows[0].count),
        leadsToday: parseInt(leadsToday.rows[0].count),
        activeCampaigns: parseInt(activeCampaigns.rows[0].count)
      }, { headers: corsHeaders() });
    }

    // Recent activity
    if (pathStr === 'dashboard/activity') {
      const result = await query('SELECT * FROM activities ORDER BY created_at DESC LIMIT 10');
      return NextResponse.json(result.rows.map(transformActivity), { headers: corsHeaders() });
    }

    // Get all leads with pagination, search, and filters
    if (pathStr === 'leads') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const search = searchParams.get('search') || '';
      const sortBy = searchParams.get('sortBy') || 'created_at';
      const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';
      const campaignId = searchParams.get('campaignId');
      const listId = searchParams.get('listId');
      const tag = searchParams.get('tag');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');

      let whereClause = 'WHERE 1=1';
      const queryParams = [];
      let paramIndex = 1;

      if (search) {
        whereClause += ` AND (email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR company ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (campaignId) {
        whereClause += ` AND $${paramIndex} = ANY(campaigns)`;
        queryParams.push(campaignId);
        paramIndex++;
      }

      if (tag) {
        whereClause += ` AND $${paramIndex} = ANY(tags)`;
        queryParams.push(tag);
        paramIndex++;
      }

      if (dateFrom) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        queryParams.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        queryParams.push(dateTo + 'T23:59:59.999Z');
        paramIndex++;
      }

      // If listId provided, get list filters and apply them
      if (listId) {
        const listResult = await query('SELECT filters FROM lists WHERE id = $1', [listId]);
        if (listResult.rows.length > 0) {
          const filters = listResult.rows[0].filters;
          if (filters.dateFrom) {
            whereClause += ` AND created_at >= $${paramIndex}`;
            queryParams.push(filters.dateFrom);
            paramIndex++;
          }
          if (filters.dateTo) {
            whereClause += ` AND created_at <= $${paramIndex}`;
            queryParams.push(filters.dateTo + 'T23:59:59.999Z');
            paramIndex++;
          }
          if (filters.tags && filters.tags.length > 0) {
            whereClause += ` AND tags && $${paramIndex}`;
            queryParams.push(filters.tags);
            paramIndex++;
          }
        }
      }

      // Map frontend sortBy to database columns
      const sortColumn = sortBy === 'createdAt' ? 'created_at' : 
                         sortBy === 'firstName' ? 'first_name' : 
                         sortBy === 'lastName' ? 'last_name' : sortBy;

      const countResult = await query(`SELECT COUNT(*) as count FROM leads ${whereClause}`, queryParams);
      const total = parseInt(countResult.rows[0].count);

      const offset = (page - 1) * limit;
      const leadsResult = await query(
        `SELECT * FROM leads ${whereClause} ORDER BY ${sortColumn} ${sortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      return NextResponse.json({
        leads: leadsResult.rows.map(transformLead),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }, { headers: corsHeaders() });
    }

    // Export leads to CSV
    if (pathStr === 'leads/export') {
      const search = searchParams.get('search') || '';
      const campaignId = searchParams.get('campaignId');
      const tag = searchParams.get('tag');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');
      const leadIds = searchParams.get('leadIds');

      let whereClause = 'WHERE 1=1';
      const queryParams = [];
      let paramIndex = 1;

      if (leadIds) {
        const ids = leadIds.split(',');
        whereClause += ` AND id = ANY($${paramIndex})`;
        queryParams.push(ids);
        paramIndex++;
      } else {
        if (search) {
          whereClause += ` AND (email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR company ILIKE $${paramIndex})`;
          queryParams.push(`%${search}%`);
          paramIndex++;
        }
        if (campaignId) {
          whereClause += ` AND $${paramIndex} = ANY(campaigns)`;
          queryParams.push(campaignId);
          paramIndex++;
        }
        if (tag) {
          whereClause += ` AND $${paramIndex} = ANY(tags)`;
          queryParams.push(tag);
          paramIndex++;
        }
        if (dateFrom) {
          whereClause += ` AND created_at >= $${paramIndex}`;
          queryParams.push(dateFrom);
          paramIndex++;
        }
        if (dateTo) {
          whereClause += ` AND created_at <= $${paramIndex}`;
          queryParams.push(dateTo + 'T23:59:59.999Z');
          paramIndex++;
        }
      }

      const result = await query(`SELECT * FROM leads ${whereClause}`, queryParams);
      const csv = leadsToCSV(result.rows);

      return new NextResponse(csv, {
        headers: {
          ...corsHeaders(),
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Get all unique tags
    if (pathStr === 'tags') {
      const result = await query('SELECT DISTINCT unnest(tags) as tag FROM leads ORDER BY tag');
      return NextResponse.json(result.rows.map(r => r.tag), { headers: corsHeaders() });
    }

    // Get single lead
    if (pathStr.startsWith('leads/') && pathStr.split('/').length === 2) {
      const leadId = pathStr.split('/')[1];
      const result = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders() });
      }
      return NextResponse.json(transformLead(result.rows[0]), { headers: corsHeaders() });
    }

    // Get lead activity
    if (pathStr.match(/^leads\/[^/]+\/activity$/)) {
      const leadId = pathStr.split('/')[1];
      const result = await query('SELECT * FROM activities WHERE lead_id = $1 ORDER BY created_at DESC', [leadId]);
      return NextResponse.json(result.rows.map(transformActivity), { headers: corsHeaders() });
    }

    // Get all campaigns
    if (pathStr === 'campaigns') {
      const result = await query(`
        SELECT c.*, 
          (SELECT COUNT(*) FROM leads WHERE $1 = ANY(campaigns)) as leads_count
        FROM campaigns c
        ORDER BY c.created_at DESC
      `, []);
      
      // Get leads count for each campaign
      const campaigns = await Promise.all(result.rows.map(async (row) => {
        const countResult = await query('SELECT COUNT(*) as count FROM leads WHERE $1 = ANY(campaigns)', [row.id]);
        return {
          ...transformCampaign(row),
          leadsCount: parseInt(countResult.rows[0].count)
        };
      }));
      
      return NextResponse.json(campaigns, { headers: corsHeaders() });
    }

    // Get single campaign
    if (pathStr.startsWith('campaigns/') && pathStr.split('/').length === 2) {
      const campaignId = pathStr.split('/')[1];
      const result = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: corsHeaders() });
      }
      const countResult = await query('SELECT COUNT(*) as count FROM leads WHERE $1 = ANY(campaigns)', [campaignId]);
      const campaign = transformCampaign(result.rows[0]);
      campaign.leadsCount = parseInt(countResult.rows[0].count);
      return NextResponse.json(campaign, { headers: corsHeaders() });
    }

    // Export campaign leads to CSV
    if (pathStr.match(/^campaigns\/[^/]+\/export$/)) {
      const campaignId = pathStr.split('/')[1];
      const result = await query('SELECT * FROM leads WHERE $1 = ANY(campaigns)', [campaignId]);
      const csv = leadsToCSV(result.rows);

      const campaignResult = await query('SELECT name FROM campaigns WHERE id = $1', [campaignId]);
      const filename = campaignResult.rows.length > 0 
        ? campaignResult.rows[0].name.replace(/[^a-z0-9]/gi, '-').toLowerCase() 
        : campaignId;

      return new NextResponse(csv, {
        headers: {
          ...corsHeaders(),
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}-leads-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Get all lists
    if (pathStr === 'lists') {
      const result = await query('SELECT * FROM lists ORDER BY created_at DESC');
      
      const lists = await Promise.all(result.rows.map(async (row) => {
        let whereClause = 'WHERE 1=1';
        const queryParams = [];
        let paramIndex = 1;
        
        const filters = row.filters || {};
        if (filters.dateFrom) {
          whereClause += ` AND created_at >= $${paramIndex}`;
          queryParams.push(filters.dateFrom);
          paramIndex++;
        }
        if (filters.dateTo) {
          whereClause += ` AND created_at <= $${paramIndex}`;
          queryParams.push(filters.dateTo + 'T23:59:59.999Z');
          paramIndex++;
        }
        if (filters.tags && filters.tags.length > 0) {
          whereClause += ` AND tags && $${paramIndex}`;
          queryParams.push(filters.tags);
          paramIndex++;
        }
        
        const countResult = await query(`SELECT COUNT(*) as count FROM leads ${whereClause}`, queryParams);
        return {
          ...transformList(row),
          leadsCount: parseInt(countResult.rows[0].count)
        };
      }));
      
      return NextResponse.json(lists, { headers: corsHeaders() });
    }

    // Get single list
    if (pathStr.startsWith('lists/') && pathStr.split('/').length === 2) {
      const listId = pathStr.split('/')[1];
      const result = await query('SELECT * FROM lists WHERE id = $1', [listId]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'List not found' }, { status: 404, headers: corsHeaders() });
      }
      return NextResponse.json(transformList(result.rows[0]), { headers: corsHeaders() });
    }

    // Get custom fields
    if (pathStr === 'custom-fields') {
      return NextResponse.json([], { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request, { params }) {
  await ensureDbInitialized();
  
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  try {
    const body = await request.json();

    // Create lead
    if (pathStr === 'leads') {
      const id = uuidv4();
      const result = await query(
        `INSERT INTO leads (id, email, first_name, last_name, company, domain, tags, campaigns, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [id, body.email, body.firstName || '', body.lastName || '', body.company || '', body.domain || '', 
         body.tags || [], body.campaigns || [], body.customFields || {}]
      );

      // Log activity
      await query(
        `INSERT INTO activities (id, action, lead_id, lead_email, "user")
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), 'Lead Created', id, body.email, 'System']
      );

      return NextResponse.json(transformLead(result.rows[0]), { status: 201, headers: corsHeaders() });
    }

    // Bulk import leads
    if (pathStr === 'leads/bulk') {
      const leads = body.leads || [];
      let imported = 0;
      let skipped = 0;

      for (const lead of leads) {
        // Check for duplicate
        const existing = await query('SELECT id FROM leads WHERE email = $1', [lead.email]);
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        const id = uuidv4();
        await query(
          `INSERT INTO leads (id, email, first_name, last_name, company, domain, tags, campaigns, custom_fields)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [id, lead.email, lead.firstName || '', lead.lastName || '', lead.company || '', lead.domain || '',
           lead.tags || [], lead.campaigns || [], lead.customFields || {}]
        );
        imported++;
      }

      // Log activity
      await query(
        `INSERT INTO activities (id, action, details, "user")
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), 'Bulk Import', `Imported ${imported} leads, skipped ${skipped} duplicates`, 'System']
      );

      return NextResponse.json({ imported, skipped, total: leads.length }, { status: 201, headers: corsHeaders() });
    }

    // Bulk actions on leads
    if (pathStr === 'leads/bulk-action') {
      const { action, leadIds, data } = body;

      if (action === 'delete') {
        await query('DELETE FROM leads WHERE id = ANY($1)', [leadIds]);
        await query(
          `INSERT INTO activities (id, action, details, "user")
           VALUES ($1, $2, $3, $4)`,
          [uuidv4(), 'Bulk Delete', `Deleted ${leadIds.length} leads`, 'System']
        );
        return NextResponse.json({ deleted: leadIds.length }, { headers: corsHeaders() });
      }

      if (action === 'addToCampaign') {
        await query(
          `UPDATE leads SET campaigns = array_append(campaigns, $1), updated_at = NOW()
           WHERE id = ANY($2) AND NOT ($1 = ANY(campaigns))`,
          [data.campaignId, leadIds]
        );
        await query(
          `INSERT INTO activities (id, action, campaign_id, details, "user")
           VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), 'Assigned to Campaign', data.campaignId, `Added ${leadIds.length} leads to campaign`, 'System']
        );
        return NextResponse.json({ updated: leadIds.length }, { headers: corsHeaders() });
      }

      if (action === 'addTag') {
        await query(
          `UPDATE leads SET tags = array_append(tags, $1), updated_at = NOW()
           WHERE id = ANY($2) AND NOT ($1 = ANY(tags))`,
          [data.tag, leadIds]
        );
        return NextResponse.json({ updated: leadIds.length }, { headers: corsHeaders() });
      }

      if (action === 'removeTag') {
        await query(
          `UPDATE leads SET tags = array_remove(tags, $1), updated_at = NOW()
           WHERE id = ANY($2)`,
          [data.tag, leadIds]
        );
        return NextResponse.json({ updated: leadIds.length }, { headers: corsHeaders() });
      }

      if (action === 'removeFromCampaign') {
        await query(
          `UPDATE leads SET campaigns = array_remove(campaigns, $1), updated_at = NOW()
           WHERE id = ANY($2)`,
          [data.campaignId, leadIds]
        );
        return NextResponse.json({ updated: leadIds.length }, { headers: corsHeaders() });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders() });
    }

    // Create campaign
    if (pathStr === 'campaigns') {
      const id = uuidv4();
      const result = await query(
        `INSERT INTO campaigns (id, name, description, status, owner)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, body.name, body.description || '', body.status || 'active', body.owner || 'System']
      );

      await query(
        `INSERT INTO activities (id, action, campaign_id, campaign_name, "user")
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), 'Campaign Created', id, body.name, 'System']
      );

      return NextResponse.json(transformCampaign(result.rows[0]), { status: 201, headers: corsHeaders() });
    }

    // Create list
    if (pathStr === 'lists') {
      const id = uuidv4();
      const result = await query(
        `INSERT INTO lists (id, name, description, filters)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, body.name, body.description || '', body.filters || {}]
      );

      await query(
        `INSERT INTO activities (id, action, list_id, list_name, "user")
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), 'List Created', id, body.name, 'System']
      );

      return NextResponse.json(transformList(result.rows[0]), { status: 201, headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(request, { params }) {
  await ensureDbInitialized();
  
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  try {
    const body = await request.json();

    // Update lead
    if (pathStr.startsWith('leads/') && pathStr.split('/').length === 2) {
      const leadId = pathStr.split('/')[1];
      
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (body.email !== undefined) { updates.push(`email = $${paramIndex++}`); values.push(body.email); }
      if (body.firstName !== undefined) { updates.push(`first_name = $${paramIndex++}`); values.push(body.firstName); }
      if (body.lastName !== undefined) { updates.push(`last_name = $${paramIndex++}`); values.push(body.lastName); }
      if (body.company !== undefined) { updates.push(`company = $${paramIndex++}`); values.push(body.company); }
      if (body.domain !== undefined) { updates.push(`domain = $${paramIndex++}`); values.push(body.domain); }
      if (body.tags !== undefined) { updates.push(`tags = $${paramIndex++}`); values.push(body.tags); }
      if (body.campaigns !== undefined) { updates.push(`campaigns = $${paramIndex++}`); values.push(body.campaigns); }
      if (body.customFields !== undefined) { updates.push(`custom_fields = $${paramIndex++}`); values.push(body.customFields); }

      updates.push(`updated_at = NOW()`);
      values.push(leadId);

      const result = await query(
        `UPDATE leads SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders() });
      }

      await query(
        `INSERT INTO activities (id, action, lead_id, lead_email, "user")
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), 'Lead Updated', leadId, result.rows[0].email, 'System']
      );

      return NextResponse.json(transformLead(result.rows[0]), { headers: corsHeaders() });
    }

    // Update campaign
    if (pathStr.startsWith('campaigns/') && pathStr.split('/').length === 2) {
      const campaignId = pathStr.split('/')[1];
      
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (body.name !== undefined) { updates.push(`name = $${paramIndex++}`); values.push(body.name); }
      if (body.description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(body.description); }
      if (body.status !== undefined) { updates.push(`status = $${paramIndex++}`); values.push(body.status); }
      if (body.owner !== undefined) { updates.push(`owner = $${paramIndex++}`); values.push(body.owner); }

      updates.push(`updated_at = NOW()`);
      values.push(campaignId);

      const result = await query(
        `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: corsHeaders() });
      }

      return NextResponse.json(transformCampaign(result.rows[0]), { headers: corsHeaders() });
    }

    // Update list
    if (pathStr.startsWith('lists/') && pathStr.split('/').length === 2) {
      const listId = pathStr.split('/')[1];
      
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (body.name !== undefined) { updates.push(`name = $${paramIndex++}`); values.push(body.name); }
      if (body.description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(body.description); }
      if (body.filters !== undefined) { updates.push(`filters = $${paramIndex++}`); values.push(body.filters); }

      updates.push(`updated_at = NOW()`);
      values.push(listId);

      const result = await query(
        `UPDATE lists SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'List not found' }, { status: 404, headers: corsHeaders() });
      }

      return NextResponse.json(transformList(result.rows[0]), { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request, { params }) {
  await ensureDbInitialized();
  
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  try {
    // Delete lead
    if (pathStr.startsWith('leads/') && pathStr.split('/').length === 2) {
      const leadId = pathStr.split('/')[1];
      
      const lead = await query('SELECT email FROM leads WHERE id = $1', [leadId]);
      if (lead.rows.length === 0) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders() });
      }

      await query('DELETE FROM leads WHERE id = $1', [leadId]);

      await query(
        `INSERT INTO activities (id, action, lead_id, lead_email, "user")
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), 'Lead Deleted', leadId, lead.rows[0].email, 'System']
      );

      return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
    }

    // Delete campaign
    if (pathStr.startsWith('campaigns/') && pathStr.split('/').length === 2) {
      const campaignId = pathStr.split('/')[1];
      
      const result = await query('DELETE FROM campaigns WHERE id = $1 RETURNING id', [campaignId]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: corsHeaders() });
      }

      // Remove campaign from all leads
      await query(
        `UPDATE leads SET campaigns = array_remove(campaigns, $1) WHERE $1 = ANY(campaigns)`,
        [campaignId]
      );

      return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
    }

    // Delete list
    if (pathStr.startsWith('lists/') && pathStr.split('/').length === 2) {
      const listId = pathStr.split('/')[1];
      
      const result = await query('DELETE FROM lists WHERE id = $1 RETURNING id', [listId]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'List not found' }, { status: 404, headers: corsHeaders() });
      }

      return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}
