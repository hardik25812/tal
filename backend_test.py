#!/usr/bin/env python3

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://leadpulse-42.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

async def test_new_leadOS_features():
    """Test all NEW LeadOS backend features"""
    print("=== Starting LeadOS NEW Features Backend Testing ===\n")
    
    async with aiohttp.ClientSession() as session:
        results = {
            'tags_endpoint': False,
            'lists_crud': False,
            'export_endpoints': False,
            'enhanced_filtering': False,
            'new_bulk_actions': False
        }
        
        # Test data setup
        test_data = await setup_test_data(session)
        
        # 1. Test Tags endpoint
        print("1. Testing Tags endpoint...")
        try:
            results['tags_endpoint'] = await test_tags_endpoint(session, test_data)
        except Exception as e:
            print(f"❌ Tags endpoint failed: {e}")
            
        # 2. Test Lists CRUD
        print("\n2. Testing Lists CRUD operations...")
        try:
            results['lists_crud'] = await test_lists_crud(session, test_data)
        except Exception as e:
            print(f"❌ Lists CRUD failed: {e}")
            
        # 3. Test Export endpoints
        print("\n3. Testing Export endpoints...")
        try:
            results['export_endpoints'] = await test_export_endpoints(session, test_data)
        except Exception as e:
            print(f"❌ Export endpoints failed: {e}")
            
        # 4. Test Enhanced filtering
        print("\n4. Testing Enhanced leads filtering...")
        try:
            results['enhanced_filtering'] = await test_enhanced_filtering(session, test_data)
        except Exception as e:
            print(f"❌ Enhanced filtering failed: {e}")
            
        # 5. Test New bulk actions
        print("\n5. Testing New bulk actions...")
        try:
            results['new_bulk_actions'] = await test_new_bulk_actions(session, test_data)
        except Exception as e:
            print(f"❌ New bulk actions failed: {e}")
        
        # Cleanup
        await cleanup_test_data(session, test_data)
        
        # Summary
        print("\n=== NEW FEATURES TEST RESULTS ===")
        passed = sum(results.values())
        total = len(results)
        for feature, status in results.items():
            status_icon = "✅" if status else "❌"
            print(f"{status_icon} {feature.replace('_', ' ').title()}: {'PASSED' if status else 'FAILED'}")
        
        print(f"\nOverall: {passed}/{total} new features working correctly")
        return results

async def setup_test_data(session):
    """Setup test data for testing"""
    print("Setting up test data...")
    
    test_data = {
        'leads': [],
        'campaigns': [],
        'lists': []
    }
    
    try:
        # Create test campaigns
        campaign_data = {
            "name": "Test Campaign Alpha",
            "description": "Test campaign for backend testing",
            "status": "active"
        }
        
        async with session.post(f"{API_BASE}/campaigns", json=campaign_data) as resp:
            if resp.status == 201:
                campaign = await resp.json()
                test_data['campaigns'].append(campaign)
                print(f"✅ Created test campaign: {campaign['id']}")
        
        # Create test leads with various tags and dates
        lead1_data = {
            "email": "alice.smith@techcorp.com",
            "firstName": "Alice",
            "lastName": "Smith", 
            "company": "TechCorp",
            "domain": "techcorp.com",
            "tags": ["premium", "enterprise"],
            "campaigns": [campaign['id']] if test_data['campaigns'] else []
        }
        
        lead2_data = {
            "email": "bob.jones@startup.io",
            "firstName": "Bob",
            "lastName": "Jones",
            "company": "Startup Inc",
            "domain": "startup.io", 
            "tags": ["startup", "tech"],
            "campaigns": []
        }
        
        lead3_data = {
            "email": "carol.white@bigcorp.net",
            "firstName": "Carol",
            "lastName": "White",
            "company": "BigCorp",
            "domain": "bigcorp.net",
            "tags": ["enterprise", "finance"],
            "campaigns": [campaign['id']] if test_data['campaigns'] else []
        }
        
        for lead_data in [lead1_data, lead2_data, lead3_data]:
            async with session.post(f"{API_BASE}/leads", json=lead_data) as resp:
                if resp.status == 201:
                    lead = await resp.json()
                    test_data['leads'].append(lead)
                    print(f"✅ Created test lead: {lead['email']}")
        
        return test_data
        
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        return test_data

async def test_tags_endpoint(session, test_data):
    """Test GET /api/tags endpoint"""
    print("Testing tags endpoint...")
    
    try:
        async with session.get(f"{API_BASE}/tags") as resp:
            if resp.status != 200:
                print(f"❌ Tags endpoint returned status {resp.status}")
                return False
                
            tags = await resp.json()
            
            if not isinstance(tags, list):
                print(f"❌ Tags endpoint should return array, got {type(tags)}")
                return False
            
            # Check if our test tags are present
            expected_tags = ["premium", "enterprise", "startup", "tech", "finance"]
            found_tags = [tag for tag in expected_tags if tag in tags]
            
            if len(found_tags) >= 3:  # Should have at least some of our test tags
                print(f"✅ Tags endpoint working - found {len(tags)} unique tags including {found_tags}")
                return True
            else:
                print(f"❌ Expected test tags not found. Got tags: {tags}")
                return False
                
    except Exception as e:
        print(f"❌ Tags endpoint error: {e}")
        return False

async def test_lists_crud(session, test_data):
    """Test Lists CRUD operations"""
    print("Testing Lists CRUD operations...")
    
    try:
        # Test POST /api/lists (Create)
        print("  Testing list creation...")
        list_data = {
            "name": "Enterprise Leads List",
            "description": "List of enterprise leads for testing",
            "filters": {
                "tags": ["enterprise"],
                "campaigns": [test_data['campaigns'][0]['id']] if test_data['campaigns'] else [],
                "dateFrom": (datetime.now() - timedelta(days=7)).isoformat(),
                "dateTo": datetime.now().isoformat()
            }
        }
        
        async with session.post(f"{API_BASE}/lists", json=list_data) as resp:
            if resp.status != 201:
                print(f"❌ List creation failed with status {resp.status}")
                return False
            
            created_list = await resp.json()
            test_data['lists'].append(created_list)
            print(f"✅ List created successfully: {created_list['id']}")
        
        # Test GET /api/lists (Read all)
        print("  Testing list retrieval...")
        async with session.get(f"{API_BASE}/lists") as resp:
            if resp.status != 200:
                print(f"❌ List retrieval failed with status {resp.status}")
                return False
            
            lists = await resp.json()
            
            if not isinstance(lists, list):
                print(f"❌ Lists endpoint should return array, got {type(lists)}")
                return False
            
            # Check if our created list is present and has leadsCount
            our_list = next((l for l in lists if l['id'] == created_list['id']), None)
            if not our_list:
                print(f"❌ Created list not found in lists response")
                return False
            
            if 'leadsCount' not in our_list:
                print(f"❌ List should have leadsCount field")
                return False
            
            print(f"✅ Lists retrieval working - found {len(lists)} lists, our list has {our_list['leadsCount']} leads")
        
        # Test GET /api/lists/:id (Read single)  
        print("  Testing single list retrieval...")
        async with session.get(f"{API_BASE}/lists/{created_list['id']}") as resp:
            if resp.status != 200:
                print(f"❌ Single list retrieval failed with status {resp.status}")
                return False
            
            single_list = await resp.json()
            if single_list['id'] != created_list['id']:
                print(f"❌ Retrieved wrong list")
                return False
            
            print(f"✅ Single list retrieval working")
        
        # Test PUT /api/lists/:id (Update)
        print("  Testing list update...")
        update_data = {
            "name": "Updated Enterprise List", 
            "description": "Updated description",
            "filters": {
                "tags": ["enterprise", "premium"],
                "campaigns": [],
                "dateFrom": (datetime.now() - timedelta(days=14)).isoformat()
            }
        }
        
        async with session.put(f"{API_BASE}/lists/{created_list['id']}", json=update_data) as resp:
            if resp.status != 200:
                print(f"❌ List update failed with status {resp.status}")
                return False
            
            updated_list = await resp.json()
            if updated_list['name'] != update_data['name']:
                print(f"❌ List update didn't persist changes")
                return False
            
            print(f"✅ List update working")
        
        print("✅ All Lists CRUD operations working correctly")
        return True
        
    except Exception as e:
        print(f"❌ Lists CRUD error: {e}")
        return False

async def test_export_endpoints(session, test_data):
    """Test Export endpoints"""
    print("Testing Export endpoints...")
    
    try:
        # Test GET /api/leads/export (basic export)
        print("  Testing basic leads export...")
        async with session.get(f"{API_BASE}/leads/export") as resp:
            if resp.status != 200:
                print(f"❌ Leads export failed with status {resp.status}")
                return False
            
            content_type = resp.headers.get('content-type', '')
            if 'text/csv' not in content_type:
                print(f"❌ Leads export should return CSV, got {content_type}")
                return False
            
            csv_content = await resp.text()
            if not csv_content or 'email' not in csv_content:
                print(f"❌ CSV content invalid or empty")
                return False
            
            lines = csv_content.strip().split('\n')
            if len(lines) < 2:  # At least header + 1 data row
                print(f"❌ CSV should have header and data rows")
                return False
            
            print(f"✅ Basic leads export working - exported {len(lines)-1} leads")
        
        # Test export with tag filter
        print("  Testing leads export with tag filter...")
        async with session.get(f"{API_BASE}/leads/export?tag=enterprise") as resp:
            if resp.status != 200:
                print(f"❌ Tagged leads export failed with status {resp.status}")
                return False
            
            csv_content = await resp.text()
            lines = csv_content.strip().split('\n') if csv_content else []
            print(f"✅ Tagged leads export working - filtered {len(lines)-1 if lines else 0} leads")
        
        # Test export with date range
        print("  Testing leads export with date range...")
        date_from = (datetime.now() - timedelta(days=1)).isoformat()
        date_to = datetime.now().isoformat()
        
        async with session.get(f"{API_BASE}/leads/export?dateFrom={date_from}&dateTo={date_to}") as resp:
            if resp.status != 200:
                print(f"❌ Date range leads export failed with status {resp.status}")
                return False
            
            csv_content = await resp.text()
            print(f"✅ Date range leads export working")
        
        # Test export with specific lead IDs
        if test_data['leads']:
            print("  Testing leads export with specific IDs...")
            lead_ids = ",".join([lead['id'] for lead in test_data['leads'][:2]])
            
            async with session.get(f"{API_BASE}/leads/export?leadIds={lead_ids}") as resp:
                if resp.status != 200:
                    print(f"❌ Specific leads export failed with status {resp.status}")
                    return False
                
                csv_content = await resp.text()
                lines = csv_content.strip().split('\n') if csv_content else []
                print(f"✅ Specific leads export working - exported {len(lines)-1 if lines else 0} specific leads")
        
        # Test campaign leads export
        if test_data['campaigns']:
            print("  Testing campaign leads export...")
            campaign_id = test_data['campaigns'][0]['id']
            
            async with session.get(f"{API_BASE}/campaigns/{campaign_id}/export") as resp:
                if resp.status != 200:
                    print(f"❌ Campaign leads export failed with status {resp.status}")
                    return False
                
                content_type = resp.headers.get('content-type', '')
                if 'text/csv' not in content_type:
                    print(f"❌ Campaign export should return CSV, got {content_type}")
                    return False
                
                csv_content = await resp.text()
                print(f"✅ Campaign leads export working")
        
        print("✅ All Export endpoints working correctly")
        return True
        
    except Exception as e:
        print(f"❌ Export endpoints error: {e}")
        return False

async def test_enhanced_filtering(session, test_data):
    """Test Enhanced leads filtering"""
    print("Testing Enhanced leads filtering...")
    
    try:
        # Test filter by tag
        print("  Testing filter by tag...")
        async with session.get(f"{API_BASE}/leads?tag=enterprise") as resp:
            if resp.status != 200:
                print(f"❌ Tag filtering failed with status {resp.status}")
                return False
            
            data = await resp.json()
            if 'leads' not in data:
                print(f"❌ Filtered response should have 'leads' field")
                return False
            
            # Verify all returned leads have the tag
            for lead in data['leads']:
                if 'enterprise' not in (lead.get('tags', [])):
                    print(f"❌ Lead {lead.get('email')} doesn't have 'enterprise' tag")
                    return False
            
            print(f"✅ Tag filtering working - found {len(data['leads'])} leads with 'enterprise' tag")
        
        # Test filter by date range
        print("  Testing filter by date range...")
        date_from = (datetime.now() - timedelta(days=1)).isoformat()
        date_to = datetime.now().isoformat()
        
        async with session.get(f"{API_BASE}/leads?dateFrom={date_from}&dateTo={date_to}") as resp:
            if resp.status != 200:
                print(f"❌ Date range filtering failed with status {resp.status}")
                return False
            
            data = await resp.json()
            print(f"✅ Date range filtering working - found {len(data['leads'])} leads in range")
        
        # Test filter by list (if we have a list created)
        if test_data['lists']:
            print("  Testing filter by listId...")
            list_id = test_data['lists'][0]['id']
            
            async with session.get(f"{API_BASE}/leads?listId={list_id}") as resp:
                if resp.status != 200:
                    print(f"❌ List filtering failed with status {resp.status}")
                    return False
                
                data = await resp.json()
                print(f"✅ List filtering working - found {len(data['leads'])} leads matching list filters")
        
        # Test combined filters
        print("  Testing combined filters...")
        async with session.get(f"{API_BASE}/leads?tag=enterprise&search=Alice") as resp:
            if resp.status != 200:
                print(f"❌ Combined filtering failed with status {resp.status}")
                return False
            
            data = await resp.json()
            print(f"✅ Combined filtering working - found {len(data['leads'])} leads")
        
        print("✅ All Enhanced filtering working correctly")
        return True
        
    except Exception as e:
        print(f"❌ Enhanced filtering error: {e}")
        return False

async def test_new_bulk_actions(session, test_data):
    """Test New bulk actions (removeTag, removeFromCampaign)"""
    print("Testing New bulk actions...")
    
    try:
        if len(test_data['leads']) < 2:
            print("❌ Need at least 2 test leads for bulk actions")
            return False
        
        lead_ids = [lead['id'] for lead in test_data['leads'][:2]]
        
        # Test removeTag action
        print("  Testing removeTag bulk action...")
        
        # First add a tag to test removal
        add_tag_data = {
            "action": "addTag",
            "leadIds": lead_ids,
            "data": {"tag": "test-remove-tag"}
        }
        
        async with session.post(f"{API_BASE}/leads/bulk-action", json=add_tag_data) as resp:
            if resp.status != 200:
                print(f"❌ Add tag for removal test failed with status {resp.status}")
                return False
        
        # Now test removeTag
        remove_tag_data = {
            "action": "removeTag",
            "leadIds": lead_ids,
            "data": {"tag": "test-remove-tag"}
        }
        
        async with session.post(f"{API_BASE}/leads/bulk-action", json=remove_tag_data) as resp:
            if resp.status != 200:
                print(f"❌ Remove tag bulk action failed with status {resp.status}")
                return False
            
            result = await resp.json()
            if 'updated' not in result or result['updated'] != len(lead_ids):
                print(f"❌ Remove tag should update {len(lead_ids)} leads, got {result}")
                return False
            
            print(f"✅ Remove tag bulk action working - updated {result['updated']} leads")
        
        # Test removeFromCampaign action
        if test_data['campaigns']:
            print("  Testing removeFromCampaign bulk action...")
            
            campaign_id = test_data['campaigns'][0]['id']
            
            # First ensure leads are in the campaign
            add_campaign_data = {
                "action": "addToCampaign",
                "leadIds": lead_ids,
                "data": {"campaignId": campaign_id}
            }
            
            async with session.post(f"{API_BASE}/leads/bulk-action", json=add_campaign_data) as resp:
                if resp.status != 200:
                    print(f"❌ Add to campaign for removal test failed")
                    return False
            
            # Now test removeFromCampaign
            remove_campaign_data = {
                "action": "removeFromCampaign", 
                "leadIds": lead_ids,
                "data": {"campaignId": campaign_id}
            }
            
            async with session.post(f"{API_BASE}/leads/bulk-action", json=remove_campaign_data) as resp:
                if resp.status != 200:
                    print(f"❌ Remove from campaign bulk action failed with status {resp.status}")
                    return False
                
                result = await resp.json()
                if 'updated' not in result or result['updated'] != len(lead_ids):
                    print(f"❌ Remove from campaign should update {len(lead_ids)} leads, got {result}")
                    return False
                
                print(f"✅ Remove from campaign bulk action working - updated {result['updated']} leads")
        
        print("✅ All New bulk actions working correctly") 
        return True
        
    except Exception as e:
        print(f"❌ New bulk actions error: {e}")
        return False

async def cleanup_test_data(session, test_data):
    """Clean up test data"""
    print("\nCleaning up test data...")
    
    try:
        # Delete test lists
        for list_item in test_data['lists']:
            async with session.delete(f"{API_BASE}/lists/{list_item['id']}") as resp:
                if resp.status == 200:
                    print(f"✅ Deleted test list: {list_item['id']}")
        
        # Delete test leads
        for lead in test_data['leads']:
            async with session.delete(f"{API_BASE}/leads/{lead['id']}") as resp:
                if resp.status == 200:
                    print(f"✅ Deleted test lead: {lead['email']}")
        
        # Delete test campaigns
        for campaign in test_data['campaigns']:
            async with session.delete(f"{API_BASE}/campaigns/{campaign['id']}") as resp:
                if resp.status == 200:
                    print(f"✅ Deleted test campaign: {campaign['id']}")
                    
    except Exception as e:
        print(f"❌ Cleanup error: {e}")

if __name__ == "__main__":
    asyncio.run(test_new_leadOS_features())