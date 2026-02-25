import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'leados';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request, { params }) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';
  const { searchParams } = new URL(request.url);

  try {
    const { db } = await connectToDatabase();

    // Health check
    if (pathStr === 'health') {
      return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers: corsHeaders() });
    }

    // Dashboard stats
    if (pathStr === 'dashboard/stats') {
      const totalLeads = await db.collection('leads').countDocuments();
      const totalCampaigns = await db.collection('campaigns').countDocuments();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const leadsToday = await db.collection('leads').countDocuments({ createdAt: { $gte: today.toISOString() } });
      const activeCampaigns = await db.collection('campaigns').countDocuments({ status: 'active' });
      
      return NextResponse.json({
        totalLeads,
        totalCampaigns,
        leadsToday,
        activeCampaigns
      }, { headers: corsHeaders() });
    }

    // Recent activity
    if (pathStr === 'dashboard/activity') {
      const activities = await db.collection('activities')
        .find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      return NextResponse.json(activities, { headers: corsHeaders() });
    }

    // Get all leads with pagination, search, and filters
    if (pathStr === 'leads') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const search = searchParams.get('search') || '';
      const sortBy = searchParams.get('sortBy') || 'createdAt';
      const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
      const campaignId = searchParams.get('campaignId');

      let query = {};
      if (search) {
        query = {
          $or: [
            { email: { $regex: search, $options: 'i' } },
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { company: { $regex: search, $options: 'i' } }
          ]
        };
      }
      if (campaignId) {
        query.campaigns = campaignId;
      }

      const total = await db.collection('leads').countDocuments(query);
      const leads = await db.collection('leads')
        .find(query)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      return NextResponse.json({
        leads,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }, { headers: corsHeaders() });
    }

    // Get single lead
    if (pathStr.startsWith('leads/') && pathStr.split('/').length === 2) {
      const leadId = pathStr.split('/')[1];
      const lead = await db.collection('leads').findOne({ id: leadId });
      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders() });
      }
      return NextResponse.json(lead, { headers: corsHeaders() });
    }

    // Get lead activity
    if (pathStr.match(/^leads\/[^/]+\/activity$/)) {
      const leadId = pathStr.split('/')[1];
      const activities = await db.collection('activities')
        .find({ leadId })
        .sort({ createdAt: -1 })
        .toArray();
      return NextResponse.json(activities, { headers: corsHeaders() });
    }

    // Get all campaigns
    if (pathStr === 'campaigns') {
      const campaigns = await db.collection('campaigns')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      
      // Add lead counts
      for (let campaign of campaigns) {
        campaign.leadsCount = await db.collection('leads').countDocuments({ campaigns: campaign.id });
      }
      
      return NextResponse.json(campaigns, { headers: corsHeaders() });
    }

    // Get single campaign
    if (pathStr.startsWith('campaigns/') && pathStr.split('/').length === 2) {
      const campaignId = pathStr.split('/')[1];
      const campaign = await db.collection('campaigns').findOne({ id: campaignId });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: corsHeaders() });
      }
      campaign.leadsCount = await db.collection('leads').countDocuments({ campaigns: campaignId });
      return NextResponse.json(campaign, { headers: corsHeaders() });
    }

    // Get custom fields schema
    if (pathStr === 'custom-fields') {
      const fields = await db.collection('customFields').find({}).toArray();
      return NextResponse.json(fields, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request, { params }) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  try {
    const { db } = await connectToDatabase();
    const body = await request.json();

    // Create lead
    if (pathStr === 'leads') {
      const lead = {
        id: uuidv4(),
        email: body.email,
        firstName: body.firstName || '',
        lastName: body.lastName || '',
        company: body.company || '',
        domain: body.domain || '',
        tags: body.tags || [],
        campaigns: body.campaigns || [],
        customFields: body.customFields || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.collection('leads').insertOne(lead);

      // Log activity
      await db.collection('activities').insertOne({
        id: uuidv4(),
        action: 'Lead Created',
        leadId: lead.id,
        leadEmail: lead.email,
        user: 'System',
        createdAt: new Date().toISOString()
      });

      return NextResponse.json(lead, { status: 201, headers: corsHeaders() });
    }

    // Bulk import leads
    if (pathStr === 'leads/bulk') {
      const leads = body.leads.map(l => ({
        id: uuidv4(),
        email: l.email,
        firstName: l.firstName || '',
        lastName: l.lastName || '',
        company: l.company || '',
        domain: l.domain || '',
        tags: l.tags || [],
        campaigns: l.campaigns || [],
        customFields: l.customFields || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      // Check for duplicates by email
      const existingEmails = await db.collection('leads')
        .find({ email: { $in: leads.map(l => l.email) } })
        .project({ email: 1 })
        .toArray();
      const existingSet = new Set(existingEmails.map(e => e.email));

      const newLeads = leads.filter(l => !existingSet.has(l.email));
      const skipped = leads.length - newLeads.length;

      if (newLeads.length > 0) {
        await db.collection('leads').insertMany(newLeads);
      }

      // Log activity
      await db.collection('activities').insertOne({
        id: uuidv4(),
        action: 'Bulk Import',
        details: `Imported ${newLeads.length} leads, skipped ${skipped} duplicates`,
        user: 'System',
        createdAt: new Date().toISOString()
      });

      return NextResponse.json({
        imported: newLeads.length,
        skipped,
        total: leads.length
      }, { status: 201, headers: corsHeaders() });
    }

    // Bulk actions on leads
    if (pathStr === 'leads/bulk-action') {
      const { action, leadIds, data } = body;

      if (action === 'delete') {
        await db.collection('leads').deleteMany({ id: { $in: leadIds } });
        await db.collection('activities').insertOne({
          id: uuidv4(),
          action: 'Bulk Delete',
          details: `Deleted ${leadIds.length} leads`,
          user: 'System',
          createdAt: new Date().toISOString()
        });
        return NextResponse.json({ deleted: leadIds.length }, { headers: corsHeaders() });
      }

      if (action === 'addToCampaign') {
        await db.collection('leads').updateMany(
          { id: { $in: leadIds } },
          { $addToSet: { campaigns: data.campaignId } }
        );
        await db.collection('activities').insertOne({
          id: uuidv4(),
          action: 'Assigned to Campaign',
          campaignId: data.campaignId,
          details: `Added ${leadIds.length} leads to campaign`,
          user: 'System',
          createdAt: new Date().toISOString()
        });
        return NextResponse.json({ updated: leadIds.length }, { headers: corsHeaders() });
      }

      if (action === 'addTag') {
        await db.collection('leads').updateMany(
          { id: { $in: leadIds } },
          { $addToSet: { tags: data.tag } }
        );
        return NextResponse.json({ updated: leadIds.length }, { headers: corsHeaders() });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders() });
    }

    // Create campaign
    if (pathStr === 'campaigns') {
      const campaign = {
        id: uuidv4(),
        name: body.name,
        description: body.description || '',
        status: body.status || 'active',
        owner: body.owner || 'System',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.collection('campaigns').insertOne(campaign);

      await db.collection('activities').insertOne({
        id: uuidv4(),
        action: 'Campaign Created',
        campaignId: campaign.id,
        campaignName: campaign.name,
        user: 'System',
        createdAt: new Date().toISOString()
      });

      return NextResponse.json(campaign, { status: 201, headers: corsHeaders() });
    }

    // Add custom field
    if (pathStr === 'custom-fields') {
      const field = {
        id: uuidv4(),
        name: body.name,
        type: body.type || 'text',
        createdAt: new Date().toISOString()
      };

      await db.collection('customFields').insertOne(field);
      return NextResponse.json(field, { status: 201, headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(request, { params }) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  try {
    const { db } = await connectToDatabase();
    const body = await request.json();

    // Update lead
    if (pathStr.startsWith('leads/') && pathStr.split('/').length === 2) {
      const leadId = pathStr.split('/')[1];
      const updateData = { ...body, updatedAt: new Date().toISOString() };
      delete updateData.id;
      delete updateData._id;

      const result = await db.collection('leads').findOneAndUpdate(
        { id: leadId },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders() });
      }

      await db.collection('activities').insertOne({
        id: uuidv4(),
        action: 'Lead Updated',
        leadId: leadId,
        leadEmail: result.email,
        user: 'System',
        createdAt: new Date().toISOString()
      });

      return NextResponse.json(result, { headers: corsHeaders() });
    }

    // Update campaign
    if (pathStr.startsWith('campaigns/') && pathStr.split('/').length === 2) {
      const campaignId = pathStr.split('/')[1];
      const updateData = { ...body, updatedAt: new Date().toISOString() };
      delete updateData.id;
      delete updateData._id;

      const result = await db.collection('campaigns').findOneAndUpdate(
        { id: campaignId },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: corsHeaders() });
      }

      return NextResponse.json(result, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request, { params }) {
  const { path } = await params;
  const pathStr = path ? path.join('/') : '';

  try {
    const { db } = await connectToDatabase();

    // Delete lead
    if (pathStr.startsWith('leads/') && pathStr.split('/').length === 2) {
      const leadId = pathStr.split('/')[1];
      const lead = await db.collection('leads').findOne({ id: leadId });
      
      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders() });
      }

      await db.collection('leads').deleteOne({ id: leadId });

      await db.collection('activities').insertOne({
        id: uuidv4(),
        action: 'Lead Deleted',
        leadId: leadId,
        leadEmail: lead.email,
        user: 'System',
        createdAt: new Date().toISOString()
      });

      return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
    }

    // Delete campaign
    if (pathStr.startsWith('campaigns/') && pathStr.split('/').length === 2) {
      const campaignId = pathStr.split('/')[1];
      const result = await db.collection('campaigns').deleteOne({ id: campaignId });
      
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: corsHeaders() });
      }

      // Remove campaign from all leads
      await db.collection('leads').updateMany(
        { campaigns: campaignId },
        { $pull: { campaigns: campaignId } }
      );

      return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}
