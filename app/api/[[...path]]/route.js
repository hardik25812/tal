import { NextResponse } from 'next/server';
import { query, getClient, ensureInitialized } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { signToken, getUserFromRequest, requireAuth, requireAdmin } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// Route segment config for App Router
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ── Helpers ──
function normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

const LEAD_COLUMNS = 'id, email, email_normalized, first_name, last_name, company, domain, phone, linkedin_url, source, status, tags, created_at, updated_at';

function transformLead(row, customFields = {}, campaignIds = []) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    company: row.company,
    domain: row.domain,
    phone: row.phone || '',
    linkedinUrl: row.linkedin_url || '',
    source: row.source || '',
    status: row.status || 'active',
    tags: row.tags || [],
    campaigns: campaignIds,
    customFields,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function enrichLeadWithRelations(row) {
  const [cfRes, clRes] = await Promise.all([
    query('SELECT field_name, field_value FROM lead_custom_fields WHERE lead_id = $1', [row.id]),
    query('SELECT campaign_id FROM campaign_leads WHERE lead_id = $1', [row.id])
  ]);
  const customFields = {};
  cfRes.rows.forEach(r => { customFields[r.field_name] = r.field_value; });
  const campaignIds = clRes.rows.map(r => r.campaign_id);
  return transformLead(row, customFields, campaignIds);
}

async function enrichLeadsBatch(rows) {
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id);

  const [cfRes, clRes] = await Promise.all([
    query('SELECT lead_id, field_name, field_value FROM lead_custom_fields WHERE lead_id = ANY($1)', [ids]),
    query('SELECT lead_id, campaign_id FROM campaign_leads WHERE lead_id = ANY($1)', [ids])
  ]);

  const cfMap = {};
  cfRes.rows.forEach(r => {
    if (!cfMap[r.lead_id]) cfMap[r.lead_id] = {};
    cfMap[r.lead_id][r.field_name] = r.field_value;
  });
  const clMap = {};
  clRes.rows.forEach(r => {
    if (!clMap[r.lead_id]) clMap[r.lead_id] = [];
    clMap[r.lead_id].push(r.campaign_id);
  });

  return rows.map(row => transformLead(row, cfMap[row.id] || {}, clMap[row.id] || []));
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

function escapeCSV(val) {
  const s = String(val ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function leadsToCSV(leads, customFieldKeys = []) {
  const headers = ['email', 'first_name', 'last_name', 'company', 'domain', 'phone', 'linkedin_url', 'source', 'status', 'tags', 'created_at'];
  const allHeaders = [...headers, ...customFieldKeys];
  const csvRows = [allHeaders.join(',')];
  leads.forEach(lead => {
    const row = allHeaders.map(h => {
      if (h === 'tags') return escapeCSV((lead.tags || []).join(';'));
      if (customFieldKeys.includes(h)) return escapeCSV(lead._cf?.[h] || '');
      return escapeCSV(lead[h]);
    });
    csvRows.push(row.join(','));
  });
  return csvRows.join('\n');
}

// ── Allowed sort columns ──
const SORT_MAP = {
  createdAt: 'created_at', created_at: 'created_at',
  firstName: 'first_name', first_name: 'first_name',
  lastName: 'last_name', last_name: 'last_name',
  email: 'email', company: 'company', domain: 'domain', status: 'status'
};

// ══════════════════════════════════════════════════════════════
// GET
// ══════════════════════════════════════════════════════════════
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request, { params }) {
  await ensureInitialized();
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';
  const { searchParams } = new URL(request.url);

  try {
    // ── Health ──
    if (pathStr === 'health') {
      try {
        await query('SELECT 1');
        return NextResponse.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() }, { headers: corsHeaders() });
      } catch (e) {
        return NextResponse.json({ status: 'error', database: 'disconnected', error: e.message }, { status: 500, headers: corsHeaders() });
      }
    }

    // ── Auth: Get current user ──
    if (pathStr === 'auth/me') {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: corsHeaders() });
      }
      return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status
      }, { headers: corsHeaders() });
    }

    // ── Admin: List all users ──
    if (pathStr === 'users') {
      const auth = await requireAdmin(request);
      if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status, headers: corsHeaders() });
      }
      const result = await query(
        `SELECT id, email, name, role, status, extraction_count, last_login_at, created_at, updated_at
         FROM users ORDER BY created_at DESC`
      );
      return NextResponse.json(result.rows.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        extractionCount: u.extraction_count || 0,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
        updatedAt: u.updated_at
      })), { headers: corsHeaders() });
    }

    // ── Admin: Get user stats (extraction leaderboard) ──
    if (pathStr === 'users/stats') {
      const auth = await requireAdmin(request);
      if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status, headers: corsHeaders() });
      }
      const result = await query(`
        SELECT u.id, u.name, u.email, u.role, u.extraction_count,
          (SELECT COUNT(*) FROM leads WHERE extracted_by = u.id) as leads_extracted,
          (SELECT COUNT(*) FROM activities WHERE user_id = u.id) as total_actions,
          (SELECT COUNT(*) FROM import_logs WHERE created_by = u.id) as imports_done
        FROM users u WHERE u.status = 'active' ORDER BY leads_extracted DESC
      `);
      return NextResponse.json(result.rows, { headers: corsHeaders() });
    }

    // ── Dashboard stats ──
    if (pathStr === 'dashboard/stats') {
      const [totalLeads, totalCampaigns, leadsToday, activeCampaigns] = await Promise.all([
        query('SELECT COUNT(*) as count FROM leads'),
        query('SELECT COUNT(*) as count FROM campaigns'),
        query('SELECT COUNT(*) as count FROM leads WHERE created_at >= $1', [new Date(new Date().setHours(0,0,0,0)).toISOString()]),
        query("SELECT COUNT(*) as count FROM campaigns WHERE status = 'active'")
      ]);
      return NextResponse.json({
        totalLeads: parseInt(totalLeads.rows[0].count),
        totalCampaigns: parseInt(totalCampaigns.rows[0].count),
        leadsToday: parseInt(leadsToday.rows[0].count),
        activeCampaigns: parseInt(activeCampaigns.rows[0].count)
      }, { headers: corsHeaders() });
    }

    // ── Recent activity ──
    if (pathStr === 'dashboard/activity') {
      const result = await query('SELECT id, action, lead_id, lead_email, campaign_id, campaign_name, list_id, list_name, details, "user", created_at FROM activities ORDER BY created_at DESC LIMIT 10');
      return NextResponse.json(result.rows.map(transformActivity), { headers: corsHeaders() });
    }

    // ── Get leads (paginated, searchable, filterable) ──
    if (pathStr === 'leads') {
      const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
      const maxLimit = searchParams.get('grid') === '1' ? 10000 : 100;
      const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get('limit') || '20')));
      const search = (searchParams.get('search') || '').trim();
      const sortByInput = searchParams.get('sortBy') || 'created_at';
      const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';
      const campaignId = searchParams.get('campaignId');
      const listId = searchParams.get('listId');
      const tag = searchParams.get('tag');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');

      const sortColumn = SORT_MAP[sortByInput] || 'created_at';

      let whereClause = 'WHERE 1=1';
      const qp = [];
      let pi = 1;

      // Full-text search via search_vector
      if (search) {
        whereClause += ` AND (search_vector @@ plainto_tsquery('simple', $${pi}) OR email_normalized LIKE $${pi + 1})`;
        qp.push(search, `%${search.toLowerCase()}%`);
        pi += 2;
      }

      // Campaign filter via campaign_leads junction
      if (campaignId) {
        whereClause += ` AND EXISTS (SELECT 1 FROM campaign_leads cl WHERE cl.lead_id = leads.id AND cl.campaign_id = $${pi})`;
        qp.push(campaignId);
        pi++;
      }

      if (tag) {
        whereClause += ` AND $${pi} = ANY(tags)`;
        qp.push(tag);
        pi++;
      }
      if (dateFrom) {
        whereClause += ` AND created_at >= $${pi}`;
        qp.push(dateFrom);
        pi++;
      }
      if (dateTo) {
        whereClause += ` AND created_at <= $${pi}`;
        qp.push(dateTo + 'T23:59:59.999Z');
        pi++;
      }

      // List filters
      if (listId) {
        const listResult = await query('SELECT filters FROM lists WHERE id = $1', [listId]);
        if (listResult.rows.length > 0) {
          const f = listResult.rows[0].filters || {};
          if (f.dateFrom) { whereClause += ` AND created_at >= $${pi}`; qp.push(f.dateFrom); pi++; }
          if (f.dateTo) { whereClause += ` AND created_at <= $${pi}`; qp.push(f.dateTo + 'T23:59:59.999Z'); pi++; }
          if (f.tags && f.tags.length > 0) { whereClause += ` AND tags && $${pi}`; qp.push(f.tags); pi++; }
        }
      }

      const offset = (page - 1) * limit;
      // Single query: fetch leads + total count via window function
      // When filtering by campaign, join to get enrichment_status
      let selectExtra = '';
      let fromClause = 'FROM leads';
      if (campaignId) {
        selectExtra = ', cl_join.enrichment_status as _enrichment_status, cl_join.enriched_at as _enriched_at';
        // Replace the EXISTS subquery with a JOIN approach
        // Remove the EXISTS clause we added earlier and use JOIN instead
        whereClause = whereClause.replace(
          ` AND EXISTS (SELECT 1 FROM campaign_leads cl WHERE cl.lead_id = leads.id AND cl.campaign_id = $${qp.indexOf(campaignId) + 1})`,
          ''
        );
        fromClause = `FROM leads INNER JOIN campaign_leads cl_join ON cl_join.lead_id = leads.id AND cl_join.campaign_id = $${qp.indexOf(campaignId) + 1}`;
      }

      const selectColumns = campaignId
        ? LEAD_COLUMNS.split(', ').map(c => `leads.${c}`).join(', ')
        : LEAD_COLUMNS;
      const orderColumn = campaignId ? `leads.${sortColumn}` : sortColumn;

      const leadsResult = await query(
        `SELECT ${selectColumns}${selectExtra}, COUNT(*) OVER() as _total ${fromClause} ${whereClause} ORDER BY ${orderColumn} ${sortOrder} LIMIT $${pi} OFFSET $${pi + 1}`,
        [...qp, limit, offset]
      );

      const total = leadsResult.rows.length > 0 ? parseInt(leadsResult.rows[0]._total) : 0;
      // Remove _total from rows before enrichment
      leadsResult.rows.forEach(r => delete r._total);

      // Skip enrichment if client says so (list view doesn't need custom fields)
      const skipEnrich = searchParams.get('lean') === '1';
      const enriched = skipEnrich
        ? leadsResult.rows.map(r => {
            const lead = transformLead(r, {}, []);
            if (r._enrichment_status) lead.enrichmentStatus = r._enrichment_status;
            delete r._enrichment_status;
            delete r._enriched_at;
            return lead;
          })
        : await (async () => {
            const enrichmentMap = {};
            leadsResult.rows.forEach(r => {
              if (r._enrichment_status) enrichmentMap[r.id] = r._enrichment_status;
              delete r._enrichment_status;
              delete r._enriched_at;
            });
            const batch = await enrichLeadsBatch(leadsResult.rows);
            batch.forEach(l => { if (enrichmentMap[l.id]) l.enrichmentStatus = enrichmentMap[l.id]; });
            return batch;
          })();

      return NextResponse.json({
        leads: enriched,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }, { headers: corsHeaders() });
    }

    // ── Export leads to CSV (streamed in batches) ──
    if (pathStr === 'leads/export') {
      const search = (searchParams.get('search') || '').trim();
      const campaignId = searchParams.get('campaignId');
      const tag = searchParams.get('tag');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');
      const leadIds = searchParams.get('leadIds');

      let whereClause = 'WHERE 1=1';
      const qp = [];
      let pi = 1;

      if (leadIds) {
        whereClause += ` AND id = ANY($${pi})`;
        qp.push(leadIds.split(','));
        pi++;
      } else {
        if (search) {
          whereClause += ` AND (search_vector @@ plainto_tsquery('simple', $${pi}) OR email_normalized LIKE $${pi + 1})`;
          qp.push(search, `%${search.toLowerCase()}%`);
          pi += 2;
        }
        if (campaignId) {
          whereClause += ` AND EXISTS (SELECT 1 FROM campaign_leads cl WHERE cl.lead_id = leads.id AND cl.campaign_id = $${pi})`;
          qp.push(campaignId);
          pi++;
        }
        if (tag) { whereClause += ` AND $${pi} = ANY(tags)`; qp.push(tag); pi++; }
        if (dateFrom) { whereClause += ` AND created_at >= $${pi}`; qp.push(dateFrom); pi++; }
        if (dateTo) { whereClause += ` AND created_at <= $${pi}`; qp.push(dateTo + 'T23:59:59.999Z'); pi++; }
      }

      // Collect all custom field keys first
      const cfKeysRes = await query(`SELECT DISTINCT field_name FROM lead_custom_fields WHERE lead_id IN (SELECT id FROM leads ${whereClause})`, qp);
      const customFieldKeys = cfKeysRes.rows.map(r => r.field_name);

      // Stream in batches of 5000
      const BATCH = 5000;
      let offset = 0;
      let csvParts = [];
      let isFirst = true;

      while (true) {
        const batch = await query(
          `SELECT ${LEAD_COLUMNS} FROM leads ${whereClause} ORDER BY created_at DESC LIMIT $${pi} OFFSET $${pi + 1}`,
          [...qp, BATCH, offset]
        );
        if (batch.rows.length === 0) break;

        // Get custom fields for this batch
        const batchIds = batch.rows.map(r => r.id);
        const cfBatch = await query('SELECT lead_id, field_name, field_value FROM lead_custom_fields WHERE lead_id = ANY($1)', [batchIds]);
        const cfMap = {};
        cfBatch.rows.forEach(r => {
          if (!cfMap[r.lead_id]) cfMap[r.lead_id] = {};
          cfMap[r.lead_id][r.field_name] = r.field_value;
        });
        batch.rows.forEach(r => { r._cf = cfMap[r.id] || {}; });

        const csv = leadsToCSV(batch.rows, customFieldKeys);
        if (isFirst) {
          csvParts.push(csv);
          isFirst = false;
        } else {
          // Skip header row for subsequent batches
          csvParts.push(csv.split('\n').slice(1).join('\n'));
        }
        offset += BATCH;
        if (batch.rows.length < BATCH) break;
      }

      return new NextResponse(csvParts.join('\n'), {
        headers: {
          ...corsHeaders(),
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // ── Tags ──
    if (pathStr === 'tags') {
      const result = await query('SELECT DISTINCT unnest(tags) as tag FROM leads ORDER BY tag');
      return NextResponse.json(result.rows.map(r => r.tag), { headers: corsHeaders() });
    }

    // ── Import logs ──
    if (pathStr === 'import-logs') {
      const result = await query('SELECT id, file_name, total_rows, inserted_count, updated_count, duplicate_count, error_count, created_at FROM import_logs ORDER BY created_at DESC LIMIT 50');
      return NextResponse.json(result.rows, { headers: corsHeaders() });
    }

    // ── Single lead ──
    if (pathStr.startsWith('leads/') && pathStr.split('/').length === 2) {
      const leadId = pathStr.split('/')[1];
      if (leadId === 'export' || leadId === 'bulk' || leadId === 'bulk-action') {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
      }
      const result = await query(`SELECT ${LEAD_COLUMNS} FROM leads WHERE id = $1`, [leadId]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders() });
      }
      const enriched = await enrichLeadWithRelations(result.rows[0]);
      return NextResponse.json(enriched, { headers: corsHeaders() });
    }

    // ── Lead activity ──
    if (pathStr.match(/^leads\/[^/]+\/activity$/)) {
      const leadId = pathStr.split('/')[1];
      const result = await query('SELECT id, action, lead_id, lead_email, campaign_id, campaign_name, list_id, list_name, details, "user", created_at FROM activities WHERE lead_id = $1 ORDER BY created_at DESC', [leadId]);
      return NextResponse.json(result.rows.map(transformActivity), { headers: corsHeaders() });
    }

    // ── All campaigns ──
    if (pathStr === 'campaigns') {
      const result = await query(`
        SELECT c.id, c.name, c.description, c.status, c.owner, c.created_at, c.updated_at,
          (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = c.id) as leads_count
        FROM campaigns c ORDER BY c.created_at DESC
      `);
      return NextResponse.json(result.rows.map(transformCampaign), { headers: corsHeaders() });
    }

    // ── Get campaign enrichment fields ──
    if (pathStr.match(/^campaigns\/[^/]+\/fields$/)) {
      const campaignId = pathStr.split('/')[1];

      // Get all unique field names for this campaign's enrichment data
      const fieldsRes = await query(
        `SELECT DISTINCT field_name FROM lead_custom_fields WHERE campaign_id = $1 ORDER BY field_name`,
        [campaignId]
      );

      // Get enrichment stats
      const statsRes = await query(
        `SELECT
          COUNT(*) as total_leads,
          COUNT(CASE WHEN enrichment_status = 'enriched' THEN 1 END) as enriched_leads,
          COUNT(CASE WHEN enrichment_status = 'pending' THEN 1 END) as pending_leads,
          COUNT(CASE WHEN enrichment_status = 'partial' THEN 1 END) as partial_leads,
          COUNT(CASE WHEN enrichment_status = 'failed' THEN 1 END) as failed_leads
         FROM campaign_leads WHERE campaign_id = $1`,
        [campaignId]
      );

      // Get field templates if defined
      const templatesRes = await query(
        `SELECT field_name, field_order, is_required FROM campaign_field_templates WHERE campaign_id = $1 ORDER BY field_order`,
        [campaignId]
      );

      const stats = statsRes.rows[0] || {};
      return NextResponse.json({
        fields: fieldsRes.rows.map(r => r.field_name),
        templates: templatesRes.rows,
        stats: {
          totalLeads: parseInt(stats.total_leads) || 0,
          enrichedLeads: parseInt(stats.enriched_leads) || 0,
          pendingLeads: parseInt(stats.pending_leads) || 0,
          partialLeads: parseInt(stats.partial_leads) || 0,
          failedLeads: parseInt(stats.failed_leads) || 0
        }
      }, { headers: corsHeaders() });
    }

    // ── Export campaign leads (with column selection) ──
    if (pathStr.match(/^campaigns\/[^/]+\/export$/)) {
      const campaignId = pathStr.split('/')[1];
      const columnsParam = searchParams.get('columns');  // Comma-separated column names
      const includeBase = searchParams.get('includeBase') !== 'false';  // Default true
      const onlyEnriched = searchParams.get('onlyEnriched') === 'true';  // Default false
      const useCampaignFields = searchParams.get('useCampaignFields') === 'true';  // Use campaign-specific fields only

      // Build query with optional enrichment filter
      let whereClause = 'WHERE cl.campaign_id = $1';
      const qp = [campaignId];
      let pi = 2;

      if (onlyEnriched) {
        whereClause += ` AND cl.enrichment_status = 'enriched'`;
      }

      const result = await query(
        `SELECT l.${LEAD_COLUMNS.split(', ').map(c => 'l.' + c).join(', ')}, cl.enrichment_status
         FROM leads l JOIN campaign_leads cl ON cl.lead_id = l.id
         ${whereClause}`, qp
      );

      const batchIds = result.rows.map(r => r.id);

      // Determine which custom fields to include
      let customFieldKeys = [];
      if (columnsParam) {
        // User specified columns - use those
        customFieldKeys = columnsParam.split(',').map(c => c.trim()).filter(c => c);
      } else if (useCampaignFields) {
        // Use only campaign-specific fields
        const cfKeysRes = await query(
          `SELECT DISTINCT field_name FROM lead_custom_fields WHERE campaign_id = $1 AND lead_id = ANY($2)`,
          [campaignId, batchIds]
        );
        customFieldKeys = cfKeysRes.rows.map(r => r.field_name);
      } else {
        // Check for field templates first
        const templatesRes = await query(
          `SELECT field_name FROM campaign_field_templates WHERE campaign_id = $1 ORDER BY field_order`,
          [campaignId]
        );
        if (templatesRes.rows.length > 0) {
          customFieldKeys = templatesRes.rows.map(r => r.field_name);
        } else {
          // Fall back to all campaign-specific fields
          const cfKeysRes = batchIds.length > 0
            ? await query(`SELECT DISTINCT field_name FROM lead_custom_fields WHERE campaign_id = $1 AND lead_id = ANY($2)`, [campaignId, batchIds])
            : { rows: [] };
          customFieldKeys = cfKeysRes.rows.map(r => r.field_name);
        }
      }

      // Fetch custom fields (campaign-specific only)
      const cfRes = batchIds.length > 0 && customFieldKeys.length > 0
        ? await query(
            `SELECT lead_id, field_name, field_value FROM lead_custom_fields
             WHERE campaign_id = $1 AND lead_id = ANY($2) AND field_name = ANY($3)`,
            [campaignId, batchIds, customFieldKeys]
          )
        : { rows: [] };

      const cfMap = {};
      cfRes.rows.forEach(r => {
        if (!cfMap[r.lead_id]) cfMap[r.lead_id] = {};
        cfMap[r.lead_id][r.field_name] = r.field_value;
      });
      result.rows.forEach(r => { r._cf = cfMap[r.id] || {}; });

      // Generate CSV with selected columns
      const csv = leadsToCSV(result.rows, customFieldKeys);

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

    // ── Single campaign ──
    if (pathStr.startsWith('campaigns/') && pathStr.split('/').length === 2) {
      const campaignId = pathStr.split('/')[1];
      const result = await query('SELECT id, name, description, status, owner, created_at, updated_at FROM campaigns WHERE id = $1', [campaignId]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: corsHeaders() });
      }
      const countResult = await query('SELECT COUNT(*) as count FROM campaign_leads WHERE campaign_id = $1', [campaignId]);
      const campaign = transformCampaign(result.rows[0]);
      campaign.leadsCount = parseInt(countResult.rows[0].count);
      return NextResponse.json(campaign, { headers: corsHeaders() });
    }

    // ── All lists ──
    if (pathStr === 'lists') {
      const result = await query('SELECT id, name, description, filters, created_at, updated_at FROM lists ORDER BY created_at DESC');
      const lists = await Promise.all(result.rows.map(async (row) => {
        let wc = 'WHERE 1=1';
        const qp = [];
        let pi = 1;
        const f = row.filters || {};
        if (f.dateFrom) { wc += ` AND created_at >= $${pi}`; qp.push(f.dateFrom); pi++; }
        if (f.dateTo) { wc += ` AND created_at <= $${pi}`; qp.push(f.dateTo + 'T23:59:59.999Z'); pi++; }
        if (f.tags && f.tags.length > 0) { wc += ` AND tags && $${pi}`; qp.push(f.tags); pi++; }
        const countResult = await query(`SELECT COUNT(*) as count FROM leads ${wc}`, qp);
        return { ...transformList(row), leadsCount: parseInt(countResult.rows[0].count) };
      }));
      return NextResponse.json(lists, { headers: corsHeaders() });
    }

    // ── Single list ──
    if (pathStr.startsWith('lists/') && pathStr.split('/').length === 2) {
      const listId = pathStr.split('/')[1];
      const result = await query('SELECT id, name, description, filters, created_at, updated_at FROM lists WHERE id = $1', [listId]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'List not found' }, { status: 404, headers: corsHeaders() });
      }
      return NextResponse.json(transformList(result.rows[0]), { headers: corsHeaders() });
    }

    // ── Custom fields (distinct field names) ──
    if (pathStr === 'custom-fields') {
      const result = await query('SELECT DISTINCT field_name FROM lead_custom_fields ORDER BY field_name');
      return NextResponse.json(result.rows.map(r => r.field_name), { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// ══════════════════════════════════════════════════════════════
// POST
// ══════════════════════════════════════════════════════════════
export async function POST(request, { params }) {
  await ensureInitialized();
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  try {
    const body = await request.json();

    // ── Auth: Login ──
    if (pathStr === 'auth/login') {
      try {
        const emailNorm = normalizeEmail(body.email);
        if (!emailNorm || !body.password) {
          return NextResponse.json({ error: 'Email and password are required' }, { status: 400, headers: corsHeaders() });
        }
        const result = await query('SELECT * FROM users WHERE email_normalized = $1', [emailNorm]);
        if (result.rows.length === 0) {
          return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: corsHeaders() });
        }
        const user = result.rows[0];
        if (user.status === 'suspended') {
          return NextResponse.json({ error: 'Your account has been suspended. Contact admin.' }, { status: 403, headers: corsHeaders() });
        }
        const valid = await bcrypt.compare(body.password, user.password_hash);
        if (!valid) {
          return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: corsHeaders() });
        }
        // Update last login
        await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
        const token = signToken(user);
        return NextResponse.json({
          token,
          user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status }
        }, { headers: corsHeaders() });
      } catch (loginErr) {
        console.error('Login error:', loginErr);
        return NextResponse.json({ error: 'Login failed: ' + loginErr.message }, { status: 500, headers: corsHeaders() });
      }
    }

    // ── Auth: Register (admin creates users, or first-time self-register) ──
    if (pathStr === 'auth/register') {
      const emailNorm = normalizeEmail(body.email);
      if (!emailNorm || !body.password || !body.name) {
        return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400, headers: corsHeaders() });
      }
      if (body.password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400, headers: corsHeaders() });
      }
      // Check if email already exists
      const existing = await query('SELECT id FROM users WHERE email_normalized = $1', [emailNorm]);
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409, headers: corsHeaders() });
      }
      const hash = await bcrypt.hash(body.password, 10);
      const role = body.role || 'user';
      // Only admins can create admin users
      if (role === 'admin') {
        const auth = await requireAdmin(request);
        if (auth.error) {
          return NextResponse.json({ error: 'Only admins can create admin users' }, { status: 403, headers: corsHeaders() });
        }
      }
      const result = await query(
        `INSERT INTO users (email, email_normalized, password_hash, name, role, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role, status, created_at`,
        [body.email, emailNorm, hash, body.name, role, 'active']
      );
      const user = result.rows[0];
      const token = signToken(user);
      return NextResponse.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status }
      }, { status: 201, headers: corsHeaders() });
    }

    // ── Admin: Create user ──
    if (pathStr === 'users') {
      const auth = await requireAdmin(request);
      if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status, headers: corsHeaders() });
      }
      const emailNorm = normalizeEmail(body.email);
      if (!emailNorm || !body.password || !body.name) {
        return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400, headers: corsHeaders() });
      }
      const existing = await query('SELECT id FROM users WHERE email_normalized = $1', [emailNorm]);
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409, headers: corsHeaders() });
      }
      const hash = await bcrypt.hash(body.password, 10);
      const result = await query(
        `INSERT INTO users (email, email_normalized, password_hash, name, role, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role, status, created_at`,
        [body.email, emailNorm, hash, body.name, body.role || 'user', 'active']
      );
      return NextResponse.json(result.rows[0], { status: 201, headers: corsHeaders() });
    }

    // ── Create lead (UPSERT on email_normalized) ──
    if (pathStr === 'leads') {
      const currentUser = await getUserFromRequest(request);
      const emailNorm = normalizeEmail(body.email);
      if (!emailNorm) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400, headers: corsHeaders() });
      }

      const result = await query(
        `INSERT INTO leads (email, email_normalized, first_name, last_name, company, domain, phone, linkedin_url, source, status, tags, extracted_by, extracted_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (email_normalized) DO UPDATE SET
           first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), leads.first_name),
           last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), leads.last_name),
           company = COALESCE(NULLIF(EXCLUDED.company, ''), leads.company),
           domain = COALESCE(NULLIF(EXCLUDED.domain, ''), leads.domain),
           phone = COALESCE(NULLIF(EXCLUDED.phone, ''), leads.phone),
           linkedin_url = COALESCE(NULLIF(EXCLUDED.linkedin_url, ''), leads.linkedin_url),
           source = COALESCE(NULLIF(EXCLUDED.source, ''), leads.source),
           updated_at = NOW()
         RETURNING ${LEAD_COLUMNS}`,
        [body.email, emailNorm, body.firstName || '', body.lastName || '', body.company || '', body.domain || '',
         body.phone || '', body.linkedinUrl || '', body.source || '', body.status || 'active', body.tags || [],
         currentUser?.id || null, currentUser?.name || null]
      );

      const lead = result.rows[0];

      // Handle custom fields
      if (body.customFields && typeof body.customFields === 'object') {
        for (const [key, value] of Object.entries(body.customFields)) {
          if (key && value !== undefined) {
            await query(
              `INSERT INTO lead_custom_fields (lead_id, field_name, field_value)
               VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [lead.id, key, String(value)]
            );
          }
        }
      }

      // Handle campaign assignment
      if (body.campaigns && Array.isArray(body.campaigns)) {
        for (const cid of body.campaigns) {
          await query(
            `INSERT INTO campaign_leads (campaign_id, lead_id) VALUES ($1, $2) ON CONFLICT (campaign_id, lead_id) DO NOTHING`,
            [cid, lead.id]
          );
        }
      }

      await query(
        `INSERT INTO activities (action, lead_id, lead_email, "user", user_id, user_name) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Lead Created', lead.id, body.email, currentUser?.name || 'System', currentUser?.id || null, currentUser?.name || null]
      );

      // Increment extraction count for the user
      if (currentUser?.id) {
        await query('UPDATE users SET extraction_count = extraction_count + 1 WHERE id = $1', [currentUser.id]);
      }

      const enriched = await enrichLeadWithRelations(lead);
      return NextResponse.json(enriched, { status: 201, headers: corsHeaders() });
    }

    // ── Bulk import (fast batch UPSERT, with import_logs) ──
    if (pathStr === 'leads/bulk') {
      const leads = body.leads || [];
      const fileName = body.fileName || 'bulk-import';
      const campaignId = body.campaignId || null;  // NEW: Optional campaign for enrichment
      const enrichmentSource = body.enrichmentSource || 'csv_import';  // NEW: Track source
      const BATCH_SIZE = 50; // rows per multi-row INSERT
      let insertedCount = 0;
      let updatedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      console.log(`Bulk import started: ${leads.length} leads from ${fileName}${campaignId ? ` (campaign: ${campaignId})` : ''}`);

      // Deduplicate entire batch by email
      const seenEmails = new Map();
      const uniqueLeads = [];
      for (const lead of leads) {
        const norm = normalizeEmail(lead.email);
        if (!norm) { errorCount++; continue; }
        if (seenEmails.has(norm)) { duplicateCount++; continue; }
        seenEmails.set(norm, true);
        uniqueLeads.push({ ...lead, emailNorm: norm });
      }

      // Collect all custom fields to insert after main upsert
      const customFieldsQueue = [];
      // Collect lead IDs for campaign assignment
      const leadIdsForCampaign = [];

      // Process in batches using multi-row INSERT for speed
      const client = await getClient();
      try {
        await client.query('BEGIN');

        for (let i = 0; i < uniqueLeads.length; i += BATCH_SIZE) {
          const batch = uniqueLeads.slice(i, i + BATCH_SIZE);

          // Build multi-row VALUES clause
          const values = [];
          const placeholders = [];
          let pi = 1;

          for (const lead of batch) {
            placeholders.push(`($${pi}, $${pi+1}, $${pi+2}, $${pi+3}, $${pi+4}, $${pi+5}, $${pi+6}, $${pi+7}, $${pi+8}, $${pi+9}, $${pi+10})`);
            values.push(
              lead.email, lead.emailNorm, lead.firstName || '', lead.lastName || '',
              lead.company || '', lead.domain || '', lead.phone || '',
              lead.linkedinUrl || '', lead.source || '', lead.status || 'active',
              lead.tags || []
            );
            pi += 11;
          }

          try {
            const res = await client.query(
              `INSERT INTO leads (email, email_normalized, first_name, last_name, company, domain, phone, linkedin_url, source, status, tags)
               VALUES ${placeholders.join(', ')}
               ON CONFLICT (email_normalized) DO UPDATE SET
                 first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), leads.first_name),
                 last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), leads.last_name),
                 company = COALESCE(NULLIF(EXCLUDED.company, ''), leads.company),
                 domain = COALESCE(NULLIF(EXCLUDED.domain, ''), leads.domain),
                 phone = COALESCE(NULLIF(EXCLUDED.phone, ''), leads.phone),
                 linkedin_url = COALESCE(NULLIF(EXCLUDED.linkedin_url, ''), leads.linkedin_url),
                 source = COALESCE(NULLIF(EXCLUDED.source, ''), leads.source),
                 updated_at = NOW()
               RETURNING id, (xmax = 0) as is_insert`,
              values
            );

            res.rows.forEach((row, idx) => {
              if (row.is_insert) insertedCount++;
              else updatedCount++;

              // Track lead IDs for campaign assignment
              if (campaignId) {
                leadIdsForCampaign.push(row.id);
              }

              // Queue custom fields (with campaign_id if provided)
              const lead = batch[idx];
              if (lead.customFields && typeof lead.customFields === 'object') {
                for (const [key, value] of Object.entries(lead.customFields)) {
                  if (key && value !== undefined && value !== '') {
                    customFieldsQueue.push({ leadId: row.id, key, value: String(value), campaignId });
                  }
                }
              }
            });
          } catch (batchErr) {
            errorCount += batch.length;
            console.warn('Batch insert error:', batchErr.message);
          }
        }

        // Bulk insert custom fields (50 at a time) - now with campaign_id support
        for (let i = 0; i < customFieldsQueue.length; i += 50) {
          const cfBatch = customFieldsQueue.slice(i, i + 50);
          const cfValues = [];
          const cfPlaceholders = [];
          let cpi = 1;
          for (const cf of cfBatch) {
            cfPlaceholders.push(`($${cpi}, $${cpi+1}, $${cpi+2}, $${cpi+3})`);
            cfValues.push(cf.leadId, cf.key, cf.value, cf.campaignId);
            cpi += 4;
          }
          try {
            await client.query(
              `INSERT INTO lead_custom_fields (lead_id, field_name, field_value, campaign_id)
               VALUES ${cfPlaceholders.join(', ')}
               ON CONFLICT (lead_id, field_name, COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'))
               DO UPDATE SET field_value = EXCLUDED.field_value`,
              cfValues
            );
          } catch (cfErr) {
            console.warn('Custom fields batch error:', cfErr.message);
          }
        }

        // If campaignId provided, assign leads to campaign with enrichment status
        if (campaignId && leadIdsForCampaign.length > 0) {
          // Determine enrichment status based on whether custom fields exist
          const hasEnrichment = customFieldsQueue.length > 0;
          const enrichmentStatus = hasEnrichment ? 'enriched' : 'pending';

          // Batch insert campaign_leads with enrichment tracking
          for (let i = 0; i < leadIdsForCampaign.length; i += 50) {
            const clBatch = leadIdsForCampaign.slice(i, i + 50);
            const clValues = [];
            const clPlaceholders = [];
            let cli = 1;
            for (const leadId of clBatch) {
              clPlaceholders.push(`($${cli}, $${cli+1}, $${cli+2}, $${cli+3}, $${cli+4})`);
              clValues.push(campaignId, leadId, enrichmentStatus, hasEnrichment ? new Date().toISOString() : null, enrichmentSource);
              cli += 5;
            }
            try {
              await client.query(
                `INSERT INTO campaign_leads (campaign_id, lead_id, enrichment_status, enriched_at, enrichment_source)
                 VALUES ${clPlaceholders.join(', ')}
                 ON CONFLICT (campaign_id, lead_id) DO UPDATE SET
                   enrichment_status = EXCLUDED.enrichment_status,
                   enriched_at = EXCLUDED.enriched_at,
                   enrichment_source = EXCLUDED.enrichment_source`,
                clValues
              );
            } catch (clErr) {
              console.warn('Campaign leads batch error:', clErr.message);
            }
          }
        }

        await client.query('COMMIT');
        console.log(`Bulk import committed: ${insertedCount} inserted, ${updatedCount} updated${campaignId ? `, assigned to campaign ${campaignId}` : ''}`);
      } catch (txErr) {
        await client.query('ROLLBACK');
        errorCount += uniqueLeads.length - insertedCount - updatedCount;
        console.error('Bulk import transaction error:', txErr.message);
      } finally {
        client.release();
      }

      // Write import log
      await query(
        `INSERT INTO import_logs (file_name, total_rows, inserted_count, updated_count, duplicate_count, error_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [fileName, leads.length, insertedCount, updatedCount, duplicateCount, errorCount]
      );

      await query(
        `INSERT INTO activities (action, details, campaign_id, "user") VALUES ($1, $2, $3, $4)`,
        ['Bulk Import', `Imported ${insertedCount} new, updated ${updatedCount}, duplicates ${duplicateCount}, errors ${errorCount} from ${leads.length} rows${campaignId ? ' (with enrichment)' : ''}`, campaignId, 'System']
      );

      return NextResponse.json({
        imported: insertedCount,
        updated: updatedCount,
        skipped: duplicateCount,
        errors: errorCount,
        total: leads.length,
        campaignId: campaignId || null
      }, { status: 201, headers: corsHeaders() });
    }

    // ── Bulk actions ──
    if (pathStr === 'leads/bulk-action') {
      const { action, leadIds, data } = body;

      if (action === 'delete') {
        // campaign_leads and lead_custom_fields cascade on delete
        await query('DELETE FROM leads WHERE id = ANY($1)', [leadIds]);
        await query(`INSERT INTO activities (action, details, "user") VALUES ($1, $2, $3)`,
          ['Bulk Delete', `Deleted ${leadIds.length} leads`, 'System']);
        return NextResponse.json({ deleted: leadIds.length }, { headers: corsHeaders() });
      }

      if (action === 'addToCampaign') {
        for (const lid of leadIds) {
          await query(
            `INSERT INTO campaign_leads (campaign_id, lead_id) VALUES ($1, $2) ON CONFLICT (campaign_id, lead_id) DO NOTHING`,
            [data.campaignId, lid]
          );
        }
        await query(`INSERT INTO activities (action, campaign_id, details, "user") VALUES ($1, $2, $3, $4)`,
          ['Assigned to Campaign', data.campaignId, `Added ${leadIds.length} leads to campaign`, 'System']);
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
          `UPDATE leads SET tags = array_remove(tags, $1), updated_at = NOW() WHERE id = ANY($2)`,
          [data.tag, leadIds]
        );
        return NextResponse.json({ updated: leadIds.length }, { headers: corsHeaders() });
      }

      if (action === 'removeFromCampaign') {
        await query('DELETE FROM campaign_leads WHERE campaign_id = $1 AND lead_id = ANY($2)', [data.campaignId, leadIds]);
        return NextResponse.json({ updated: leadIds.length }, { headers: corsHeaders() });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders() });
    }

    // ── Create campaign ──
    if (pathStr === 'campaigns') {
      const result = await query(
        `INSERT INTO campaigns (name, description, status, owner) VALUES ($1, $2, $3, $4) RETURNING id, name, description, status, owner, created_at, updated_at`,
        [body.name, body.description || '', body.status || 'active', body.owner || 'System']
      );
      await query(`INSERT INTO activities (action, campaign_id, campaign_name, "user") VALUES ($1, $2, $3, $4)`,
        ['Campaign Created', result.rows[0].id, body.name, 'System']);
      return NextResponse.json(transformCampaign(result.rows[0]), { status: 201, headers: corsHeaders() });
    }

    // ── Bulk enrich existing leads in a campaign ──
    if (pathStr.match(/^campaigns\/[^/]+\/enrich$/)) {
      const campaignId = pathStr.split('/')[1];
      const leads = body.leads || [];
      const source = body.source || 'csv_import';

      if (!leads.length) {
        return NextResponse.json({ error: 'No leads provided' }, { status: 400, headers: corsHeaders() });
      }

      let enrichedCount = 0;
      let notFoundCount = 0;
      let errorCount = 0;

      const client = await getClient();
      try {
        await client.query('BEGIN');

        for (const lead of leads) {
          const emailNorm = normalizeEmail(lead.email);
          if (!emailNorm) { errorCount++; continue; }

          // Find lead by email and verify it's in this campaign
          const leadRes = await client.query(
            `SELECT l.id FROM leads l
             JOIN campaign_leads cl ON cl.lead_id = l.id
             WHERE l.email_normalized = $1 AND cl.campaign_id = $2`,
            [emailNorm, campaignId]
          );

          if (leadRes.rows.length === 0) {
            notFoundCount++;
            continue;
          }

          const leadId = leadRes.rows[0].id;

          // Insert/update custom fields with campaign_id
          if (lead.customFields && typeof lead.customFields === 'object') {
            for (const [key, value] of Object.entries(lead.customFields)) {
              if (key && value !== undefined && value !== '') {
                await client.query(
                  `INSERT INTO lead_custom_fields (lead_id, field_name, field_value, campaign_id)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (lead_id, field_name, COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'))
                   DO UPDATE SET field_value = EXCLUDED.field_value`,
                  [leadId, key, String(value), campaignId]
                );
              }
            }
          }

          // Update enrichment status
          await client.query(
            `UPDATE campaign_leads SET enrichment_status = 'enriched', enriched_at = NOW(), enrichment_source = $1
             WHERE campaign_id = $2 AND lead_id = $3`,
            [source, campaignId, leadId]
          );

          enrichedCount++;
        }

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        console.error('Enrich transaction error:', txErr.message);
        return NextResponse.json({ error: txErr.message }, { status: 500, headers: corsHeaders() });
      } finally {
        client.release();
      }

      await query(
        `INSERT INTO activities (action, campaign_id, details, "user") VALUES ($1, $2, $3, $4)`,
        ['Campaign Enrichment', campaignId, `Enriched ${enrichedCount} leads, ${notFoundCount} not found, ${errorCount} errors`, 'System']
      );

      return NextResponse.json({
        enriched: enrichedCount,
        notFound: notFoundCount,
        errors: errorCount,
        total: leads.length
      }, { status: 200, headers: corsHeaders() });
    }

    // ── Single lead enrichment (for external API integration) ──
    if (pathStr.match(/^leads\/[^/]+\/enrich$/)) {
      const leadId = pathStr.split('/')[1];
      const campaignId = body.campaignId;
      const source = body.source || 'api';
      const data = body.data || {};

      if (!campaignId) {
        return NextResponse.json({ error: 'campaignId is required' }, { status: 400, headers: corsHeaders() });
      }

      // Verify lead exists
      const leadRes = await query('SELECT id FROM leads WHERE id = $1', [leadId]);
      if (leadRes.rows.length === 0) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders() });
      }

      // Ensure lead is in campaign (create junction if not)
      await query(
        `INSERT INTO campaign_leads (campaign_id, lead_id, enrichment_status, enriched_at, enrichment_source)
         VALUES ($1, $2, 'enriched', NOW(), $3)
         ON CONFLICT (campaign_id, lead_id) DO UPDATE SET
           enrichment_status = 'enriched',
           enriched_at = NOW(),
           enrichment_source = EXCLUDED.enrichment_source`,
        [campaignId, leadId, source]
      );

      // Insert/update custom fields
      for (const [key, value] of Object.entries(data)) {
        if (key && value !== undefined && value !== '') {
          await query(
            `INSERT INTO lead_custom_fields (lead_id, field_name, field_value, campaign_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (lead_id, field_name, COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'))
             DO UPDATE SET field_value = EXCLUDED.field_value`,
            [leadId, key, String(value), campaignId]
          );
        }
      }

      await query(
        `INSERT INTO activities (action, lead_id, campaign_id, details, "user") VALUES ($1, $2, $3, $4, $5)`,
        ['Lead Enriched', leadId, campaignId, `Enriched via ${source} with ${Object.keys(data).length} fields`, 'System']
      );

      return NextResponse.json({ success: true, fieldsAdded: Object.keys(data).length }, { headers: corsHeaders() });
    }

    // ── Define campaign field templates for export ──
    if (pathStr.match(/^campaigns\/[^/]+\/fields$/)) {
      const campaignId = pathStr.split('/')[1];
      const fields = body.fields || [];

      if (!Array.isArray(fields)) {
        return NextResponse.json({ error: 'fields must be an array' }, { status: 400, headers: corsHeaders() });
      }

      // Verify campaign exists
      const campaignRes = await query('SELECT id FROM campaigns WHERE id = $1', [campaignId]);
      if (campaignRes.rows.length === 0) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: corsHeaders() });
      }

      // Clear existing templates and insert new ones
      await query('DELETE FROM campaign_field_templates WHERE campaign_id = $1', [campaignId]);

      for (let i = 0; i < fields.length; i++) {
        const field = typeof fields[i] === 'string' ? { name: fields[i] } : fields[i];
        await query(
          `INSERT INTO campaign_field_templates (campaign_id, field_name, field_order, is_required)
           VALUES ($1, $2, $3, $4)`,
          [campaignId, field.name, i, field.required || false]
        );
      }

      return NextResponse.json({
        success: true,
        fields: fields.map((f, i) => ({
          name: typeof f === 'string' ? f : f.name,
          order: i,
          required: typeof f === 'object' ? (f.required || false) : false
        }))
      }, { status: 201, headers: corsHeaders() });
    }

    // ── Create list ──
    if (pathStr === 'lists') {
      const result = await query(
        `INSERT INTO lists (name, description, filters) VALUES ($1, $2, $3) RETURNING id, name, description, filters, created_at, updated_at`,
        [body.name, body.description || '', body.filters || {}]
      );
      await query(`INSERT INTO activities (action, list_id, list_name, "user") VALUES ($1, $2, $3, $4)`,
        ['List Created', result.rows[0].id, body.name, 'System']);
      return NextResponse.json(transformList(result.rows[0]), { status: 201, headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// ══════════════════════════════════════════════════════════════
// PUT
// ══════════════════════════════════════════════════════════════
export async function PUT(request, { params }) {
  await ensureInitialized();
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  try {
    const body = await request.json();

    // ── Admin: Update user (suspend, change role, etc.) ──
    if (pathStr.startsWith('users/') && pathStr.split('/').length === 2) {
      const auth = await requireAdmin(request);
      if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status, headers: corsHeaders() });
      }
      const userId = pathStr.split('/')[1];
      const updates = [];
      const values = [];
      let pi = 1;

      if (body.name !== undefined) { updates.push(`name = $${pi++}`); values.push(body.name); }
      if (body.role !== undefined) { updates.push(`role = $${pi++}`); values.push(body.role); }
      if (body.status !== undefined) { updates.push(`status = $${pi++}`); values.push(body.status); }
      if (body.password) {
        const hash = await bcrypt.hash(body.password, 10);
        updates.push(`password_hash = $${pi++}`);
        values.push(hash);
      }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400, headers: corsHeaders() });
      }

      updates.push('updated_at = NOW()');
      values.push(userId);

      const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${pi} RETURNING id, email, name, role, status, extraction_count, last_login_at, created_at, updated_at`,
        values
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });
      }
      const u = result.rows[0];
      return NextResponse.json({
        id: u.id, email: u.email, name: u.name, role: u.role, status: u.status,
        extractionCount: u.extraction_count || 0, lastLoginAt: u.last_login_at,
        createdAt: u.created_at, updatedAt: u.updated_at
      }, { headers: corsHeaders() });
    }

    // ── Update lead ──
    if (pathStr.startsWith('leads/') && pathStr.split('/').length === 2) {
      const leadId = pathStr.split('/')[1];

      const updates = [];
      const values = [];
      let pi = 1;

      if (body.email !== undefined) {
        updates.push(`email = $${pi++}`); values.push(body.email);
        updates.push(`email_normalized = $${pi++}`); values.push(normalizeEmail(body.email));
      }
      if (body.firstName !== undefined) { updates.push(`first_name = $${pi++}`); values.push(body.firstName); }
      if (body.lastName !== undefined) { updates.push(`last_name = $${pi++}`); values.push(body.lastName); }
      if (body.company !== undefined) { updates.push(`company = $${pi++}`); values.push(body.company); }
      if (body.domain !== undefined) { updates.push(`domain = $${pi++}`); values.push(body.domain); }
      if (body.phone !== undefined) { updates.push(`phone = $${pi++}`); values.push(body.phone); }
      if (body.linkedinUrl !== undefined) { updates.push(`linkedin_url = $${pi++}`); values.push(body.linkedinUrl); }
      if (body.source !== undefined) { updates.push(`source = $${pi++}`); values.push(body.source); }
      if (body.status !== undefined) { updates.push(`status = $${pi++}`); values.push(body.status); }
      if (body.tags !== undefined) { updates.push(`tags = $${pi++}`); values.push(body.tags); }

      updates.push('updated_at = NOW()');
      values.push(leadId);

      const result = await query(
        `UPDATE leads SET ${updates.join(', ')} WHERE id = $${pi} RETURNING ${LEAD_COLUMNS}`,
        values
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders() });
      }

      // Handle campaigns via junction table
      if (body.campaigns !== undefined && Array.isArray(body.campaigns)) {
        await query('DELETE FROM campaign_leads WHERE lead_id = $1', [leadId]);
        for (const cid of body.campaigns) {
          await query(
            `INSERT INTO campaign_leads (campaign_id, lead_id) VALUES ($1, $2) ON CONFLICT (campaign_id, lead_id) DO NOTHING`,
            [cid, leadId]
          );
        }
      }

      // Handle custom fields
      if (body.customFields !== undefined && typeof body.customFields === 'object') {
        await query('DELETE FROM lead_custom_fields WHERE lead_id = $1', [leadId]);
        for (const [key, value] of Object.entries(body.customFields)) {
          if (key && value !== undefined && value !== '') {
            await query(
              `INSERT INTO lead_custom_fields (lead_id, field_name, field_value) VALUES ($1, $2, $3)`,
              [leadId, key, String(value)]
            );
          }
        }
      }

      await query(`INSERT INTO activities (action, lead_id, lead_email, "user") VALUES ($1, $2, $3, $4)`,
        ['Lead Updated', leadId, result.rows[0].email, 'System']);

      const enriched = await enrichLeadWithRelations(result.rows[0]);
      return NextResponse.json(enriched, { headers: corsHeaders() });
    }

    // ── Update campaign ──
    if (pathStr.startsWith('campaigns/') && pathStr.split('/').length === 2) {
      const campaignId = pathStr.split('/')[1];
      const updates = [];
      const values = [];
      let pi = 1;

      if (body.name !== undefined) { updates.push(`name = $${pi++}`); values.push(body.name); }
      if (body.description !== undefined) { updates.push(`description = $${pi++}`); values.push(body.description); }
      if (body.status !== undefined) { updates.push(`status = $${pi++}`); values.push(body.status); }
      if (body.owner !== undefined) { updates.push(`owner = $${pi++}`); values.push(body.owner); }

      updates.push('updated_at = NOW()');
      values.push(campaignId);

      const result = await query(
        `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${pi} RETURNING id, name, description, status, owner, created_at, updated_at`,
        values
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: corsHeaders() });
      }
      return NextResponse.json(transformCampaign(result.rows[0]), { headers: corsHeaders() });
    }

    // ── Update list ──
    if (pathStr.startsWith('lists/') && pathStr.split('/').length === 2) {
      const listId = pathStr.split('/')[1];
      const updates = [];
      const values = [];
      let pi = 1;

      if (body.name !== undefined) { updates.push(`name = $${pi++}`); values.push(body.name); }
      if (body.description !== undefined) { updates.push(`description = $${pi++}`); values.push(body.description); }
      if (body.filters !== undefined) { updates.push(`filters = $${pi++}`); values.push(body.filters); }

      updates.push('updated_at = NOW()');
      values.push(listId);

      const result = await query(
        `UPDATE lists SET ${updates.join(', ')} WHERE id = $${pi} RETURNING id, name, description, filters, created_at, updated_at`,
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

// ══════════════════════════════════════════════════════════════
// DELETE
// ══════════════════════════════════════════════════════════════
export async function DELETE(request, { params }) {
  await ensureInitialized();
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  try {
    // ── Delete lead (cascade removes campaign_leads + lead_custom_fields) ──
    if (pathStr.startsWith('leads/') && pathStr.split('/').length === 2) {
      const leadId = pathStr.split('/')[1];
      const lead = await query('SELECT email FROM leads WHERE id = $1', [leadId]);
      if (lead.rows.length === 0) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders() });
      }
      await query('DELETE FROM leads WHERE id = $1', [leadId]);
      await query(`INSERT INTO activities (action, lead_id, lead_email, "user") VALUES ($1, $2, $3, $4)`,
        ['Lead Deleted', leadId, lead.rows[0].email, 'System']);
      return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
    }

    // ── Delete campaign (cascade removes campaign_leads) ──
    if (pathStr.startsWith('campaigns/') && pathStr.split('/').length === 2) {
      const campaignId = pathStr.split('/')[1];
      const result = await query('DELETE FROM campaigns WHERE id = $1 RETURNING id', [campaignId]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: corsHeaders() });
      }
      return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
    }

    // ── Delete list ──
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
