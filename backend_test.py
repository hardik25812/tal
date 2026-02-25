#!/usr/bin/env python3
"""
LeadOS Backend API Testing Suite
Tests all high priority endpoints as specified in test_result.md
"""

import requests
import json
import uuid
from datetime import datetime

# Base URL from environment
BASE_URL = "https://leadpulse-42.preview.emergentagent.com/api"

class LeadOSAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.created_leads = []
        self.created_campaigns = []
        
    def log(self, message, status="INFO"):
        print(f"[{status}] {message}")
        
    def test_health_check(self):
        """Test GET /api/health endpoint"""
        self.log("Testing Health Check endpoint...")
        try:
            response = self.session.get(f"{self.base_url}/health")
            self.log(f"Health check response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Health check response: {data}")
                if 'status' in data and data['status'] == 'ok':
                    self.log("✅ Health check endpoint working correctly", "SUCCESS")
                    return True
                else:
                    self.log("❌ Health check response missing status field", "ERROR")
                    return False
            else:
                self.log(f"❌ Health check failed with status {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Health check failed with exception: {e}", "ERROR")
            return False
    
    def test_dashboard_stats(self):
        """Test GET /api/dashboard/stats endpoint"""
        self.log("Testing Dashboard Stats endpoint...")
        try:
            response = self.session.get(f"{self.base_url}/dashboard/stats")
            self.log(f"Dashboard stats response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Dashboard stats response: {data}")
                
                required_fields = ['totalLeads', 'totalCampaigns', 'leadsToday', 'activeCampaigns']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log("✅ Dashboard stats endpoint working correctly", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Dashboard stats missing fields: {missing_fields}", "ERROR")
                    return False
            else:
                self.log(f"❌ Dashboard stats failed with status {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Dashboard stats failed with exception: {e}", "ERROR")
            return False
    
    def test_dashboard_activity(self):
        """Test GET /api/dashboard/activity endpoint"""
        self.log("Testing Dashboard Activity endpoint...")
        try:
            response = self.session.get(f"{self.base_url}/dashboard/activity")
            self.log(f"Dashboard activity response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Dashboard activity response (first 2 items): {data[:2] if isinstance(data, list) else data}")
                
                if isinstance(data, list):
                    self.log("✅ Dashboard activity endpoint working correctly", "SUCCESS")
                    return True
                else:
                    self.log("❌ Dashboard activity should return an array", "ERROR")
                    return False
            else:
                self.log(f"❌ Dashboard activity failed with status {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Dashboard activity failed with exception: {e}", "ERROR")
            return False
    
    def test_leads_crud(self):
        """Test Leads CRUD operations"""
        self.log("Testing Leads CRUD operations...")
        
        # Test CREATE lead
        self.log("Testing POST /api/leads...")
        try:
            lead_data = {
                "email": "john.doe@acmecorp.com",
                "firstName": "John",
                "lastName": "Doe",
                "company": "Acme Corp",
                "domain": "acmecorp.com"
            }
            
            response = self.session.post(f"{self.base_url}/leads", json=lead_data)
            self.log(f"Create lead response status: {response.status_code}")
            
            if response.status_code == 201:
                created_lead = response.json()
                self.log(f"Created lead: {created_lead}")
                self.created_leads.append(created_lead['id'])
                self.log("✅ Create lead working correctly", "SUCCESS")
                
                # Test GET single lead
                self.log(f"Testing GET /api/leads/{created_lead['id']}...")
                get_response = self.session.get(f"{self.base_url}/leads/{created_lead['id']}")
                
                if get_response.status_code == 200:
                    retrieved_lead = get_response.json()
                    self.log("✅ Get single lead working correctly", "SUCCESS")
                    
                    # Test UPDATE lead
                    self.log(f"Testing PUT /api/leads/{created_lead['id']}...")
                    update_data = {"firstName": "Johnny", "company": "Updated Corp"}
                    
                    put_response = self.session.put(f"{self.base_url}/leads/{created_lead['id']}", json=update_data)
                    if put_response.status_code == 200:
                        updated_lead = put_response.json()
                        if updated_lead['firstName'] == 'Johnny':
                            self.log("✅ Update lead working correctly", "SUCCESS")
                        else:
                            self.log("❌ Lead update not reflected in response", "ERROR")
                            return False
                    else:
                        self.log(f"❌ Update lead failed with status {put_response.status_code}", "ERROR")
                        return False
                        
                else:
                    self.log(f"❌ Get single lead failed with status {get_response.status_code}", "ERROR")
                    return False
                    
            else:
                self.log(f"❌ Create lead failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Leads CRUD failed with exception: {e}", "ERROR")
            return False
        
        # Test GET all leads with pagination
        self.log("Testing GET /api/leads with pagination...")
        try:
            response = self.session.get(f"{self.base_url}/leads?page=1&limit=20")
            if response.status_code == 200:
                data = response.json()
                if 'leads' in data and 'pagination' in data:
                    self.log("✅ Get leads with pagination working correctly", "SUCCESS")
                    return True
                else:
                    self.log("❌ Get leads response missing leads or pagination field", "ERROR")
                    return False
            else:
                self.log(f"❌ Get leads failed with status {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Get leads failed with exception: {e}", "ERROR")
            return False
    
    def test_leads_bulk_import(self):
        """Test POST /api/leads/bulk endpoint"""
        self.log("Testing Leads Bulk Import endpoint...")
        try:
            bulk_leads = [
                {
                    "email": "alice.smith@techcorp.com",
                    "firstName": "Alice",
                    "lastName": "Smith",
                    "company": "Tech Corp",
                    "domain": "techcorp.com"
                },
                {
                    "email": "bob.wilson@innovate.com", 
                    "firstName": "Bob",
                    "lastName": "Wilson",
                    "company": "Innovate Inc",
                    "domain": "innovate.com"
                },
                {
                    "email": "john.doe@acmecorp.com",  # Duplicate from previous test
                    "firstName": "John",
                    "lastName": "Doe",
                    "company": "Acme Corp"
                }
            ]
            
            response = self.session.post(f"{self.base_url}/leads/bulk", json={"leads": bulk_leads})
            self.log(f"Bulk import response status: {response.status_code}")
            
            if response.status_code == 201:
                data = response.json()
                self.log(f"Bulk import response: {data}")
                
                required_fields = ['imported', 'skipped', 'total']
                if all(field in data for field in required_fields):
                    if data['total'] == 3 and data['skipped'] >= 1:  # Should skip duplicate
                        self.log("✅ Bulk import with duplicate detection working correctly", "SUCCESS")
                        return True
                    else:
                        self.log(f"❌ Bulk import counts don't match expected (total: {data['total']}, skipped: {data['skipped']})", "ERROR")
                        return False
                else:
                    self.log(f"❌ Bulk import response missing required fields", "ERROR")
                    return False
            else:
                self.log(f"❌ Bulk import failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Bulk import failed with exception: {e}", "ERROR")
            return False
    
    def test_leads_bulk_actions(self):
        """Test POST /api/leads/bulk-action endpoint"""
        self.log("Testing Leads Bulk Actions endpoint...")
        
        # First create some test leads
        test_leads = []
        try:
            for i in range(2):
                lead_data = {
                    "email": f"bulktest{i}@example.com",
                    "firstName": f"BulkTest{i}",
                    "lastName": "User",
                    "company": "Test Corp"
                }
                response = self.session.post(f"{self.base_url}/leads", json=lead_data)
                if response.status_code == 201:
                    lead = response.json()
                    test_leads.append(lead['id'])
                    
            if len(test_leads) != 2:
                self.log("❌ Failed to create test leads for bulk actions", "ERROR")
                return False
                
            # Test bulk add tag action
            self.log("Testing bulk addTag action...")
            bulk_action_data = {
                "action": "addTag",
                "leadIds": test_leads,
                "data": {"tag": "bulk-test"}
            }
            
            response = self.session.post(f"{self.base_url}/leads/bulk-action", json=bulk_action_data)
            self.log(f"Bulk addTag response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if 'updated' in data and data['updated'] == 2:
                    self.log("✅ Bulk addTag action working correctly", "SUCCESS")
                else:
                    self.log(f"❌ Bulk addTag unexpected response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Bulk addTag failed with status {response.status_code}", "ERROR")
                return False
                
            # Test bulk delete action  
            self.log("Testing bulk delete action...")
            bulk_delete_data = {
                "action": "delete",
                "leadIds": test_leads
            }
            
            response = self.session.post(f"{self.base_url}/leads/bulk-action", json=bulk_delete_data)
            if response.status_code == 200:
                data = response.json()
                if 'deleted' in data and data['deleted'] == 2:
                    self.log("✅ Bulk delete action working correctly", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Bulk delete unexpected response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Bulk delete failed with status {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Bulk actions failed with exception: {e}", "ERROR")
            return False
    
    def test_campaigns_crud(self):
        """Test Campaigns CRUD operations"""
        self.log("Testing Campaigns CRUD operations...")
        
        # Test CREATE campaign
        self.log("Testing POST /api/campaigns...")
        try:
            campaign_data = {
                "name": "Test Campaign",
                "description": "This is a test campaign",
                "status": "active"
            }
            
            response = self.session.post(f"{self.base_url}/campaigns", json=campaign_data)
            self.log(f"Create campaign response status: {response.status_code}")
            
            if response.status_code == 201:
                created_campaign = response.json()
                self.log(f"Created campaign: {created_campaign}")
                self.created_campaigns.append(created_campaign['id'])
                
                # Test GET single campaign
                self.log(f"Testing GET /api/campaigns/{created_campaign['id']}...")
                get_response = self.session.get(f"{self.base_url}/campaigns/{created_campaign['id']}")
                
                if get_response.status_code == 200:
                    retrieved_campaign = get_response.json()
                    if 'leadsCount' in retrieved_campaign:
                        self.log("✅ Get single campaign with leadsCount working correctly", "SUCCESS")
                    else:
                        self.log("❌ Campaign response missing leadsCount field", "ERROR")
                        return False
                        
                    # Test UPDATE campaign
                    self.log(f"Testing PUT /api/campaigns/{created_campaign['id']}...")
                    update_data = {"name": "Updated Test Campaign", "status": "inactive"}
                    
                    put_response = self.session.put(f"{self.base_url}/campaigns/{created_campaign['id']}", json=update_data)
                    if put_response.status_code == 200:
                        updated_campaign = put_response.json()
                        if updated_campaign['name'] == 'Updated Test Campaign':
                            self.log("✅ Update campaign working correctly", "SUCCESS")
                        else:
                            self.log("❌ Campaign update not reflected in response", "ERROR")
                            return False
                    else:
                        self.log(f"❌ Update campaign failed with status {put_response.status_code}", "ERROR")
                        return False
                        
                else:
                    self.log(f"❌ Get single campaign failed with status {get_response.status_code}", "ERROR")
                    return False
                    
            else:
                self.log(f"❌ Create campaign failed with status {response.status_code}: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Campaigns CRUD failed with exception: {e}", "ERROR")
            return False
        
        # Test GET all campaigns
        self.log("Testing GET /api/campaigns...")
        try:
            response = self.session.get(f"{self.base_url}/campaigns")
            if response.status_code == 200:
                campaigns = response.json()
                if isinstance(campaigns, list):
                    # Check if campaigns have leadsCount
                    if campaigns and 'leadsCount' in campaigns[0]:
                        self.log("✅ Get campaigns with leadsCount working correctly", "SUCCESS")
                        return True
                    else:
                        self.log("✅ Get campaigns working correctly (empty list or no leadsCount field)", "SUCCESS")
                        return True
                else:
                    self.log("❌ Get campaigns should return an array", "ERROR")
                    return False
            else:
                self.log(f"❌ Get campaigns failed with status {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Get campaigns failed with exception: {e}", "ERROR")
            return False
    
    def test_campaigns_with_leads(self):
        """Test assigning leads to campaigns and verify leadsCount"""
        self.log("Testing Campaign-Lead assignment...")
        
        # Create a test campaign and lead
        try:
            # Create campaign
            campaign_data = {"name": "Lead Assignment Test", "status": "active"}
            camp_response = self.session.post(f"{self.base_url}/campaigns", json=campaign_data)
            
            if camp_response.status_code != 201:
                self.log("❌ Failed to create test campaign", "ERROR")
                return False
                
            campaign = camp_response.json()
            campaign_id = campaign['id']
            self.created_campaigns.append(campaign_id)
            
            # Create lead
            lead_data = {
                "email": "campaign.test@example.com",
                "firstName": "Campaign",
                "lastName": "Test",
                "company": "Test Corp"
            }
            lead_response = self.session.post(f"{self.base_url}/leads", json=lead_data)
            
            if lead_response.status_code != 201:
                self.log("❌ Failed to create test lead", "ERROR")
                return False
                
            lead = lead_response.json()
            lead_id = lead['id']
            self.created_leads.append(lead_id)
            
            # Use bulk action to add lead to campaign
            bulk_action_data = {
                "action": "addToCampaign",
                "leadIds": [lead_id],
                "data": {"campaignId": campaign_id}
            }
            
            bulk_response = self.session.post(f"{self.base_url}/leads/bulk-action", json=bulk_action_data)
            
            if bulk_response.status_code != 200:
                self.log(f"❌ Failed to assign lead to campaign: {bulk_response.status_code}", "ERROR")
                return False
                
            # Verify campaign now has leadsCount = 1
            get_campaign_response = self.session.get(f"{self.base_url}/campaigns/{campaign_id}")
            
            if get_campaign_response.status_code == 200:
                updated_campaign = get_campaign_response.json()
                if updated_campaign.get('leadsCount', 0) >= 1:
                    self.log("✅ Campaign lead assignment and count working correctly", "SUCCESS")
                    return True
                else:
                    self.log(f"❌ Campaign leadsCount not updated correctly: {updated_campaign.get('leadsCount', 0)}", "ERROR")
                    return False
            else:
                self.log("❌ Failed to retrieve campaign after lead assignment", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Campaign-lead assignment failed with exception: {e}", "ERROR")
            return False
    
    def cleanup(self):
        """Clean up created test data"""
        self.log("Cleaning up test data...")
        
        # Delete created leads
        for lead_id in self.created_leads:
            try:
                self.session.delete(f"{self.base_url}/leads/{lead_id}")
            except:
                pass
                
        # Delete created campaigns  
        for campaign_id in self.created_campaigns:
            try:
                self.session.delete(f"{self.base_url}/campaigns/{campaign_id}")
            except:
                pass
        
        self.log("✅ Cleanup completed")
    
    def run_all_tests(self):
        """Run all backend API tests"""
        self.log("=" * 60)
        self.log("Starting LeadOS Backend API Tests")
        self.log("=" * 60)
        
        test_results = {}
        
        # Run tests in order
        test_results['health_check'] = self.test_health_check()
        test_results['dashboard_stats'] = self.test_dashboard_stats()
        test_results['dashboard_activity'] = self.test_dashboard_activity()
        test_results['leads_crud'] = self.test_leads_crud()
        test_results['leads_bulk_import'] = self.test_leads_bulk_import()
        test_results['leads_bulk_actions'] = self.test_leads_bulk_actions()
        test_results['campaigns_crud'] = self.test_campaigns_crud()
        test_results['campaigns_with_leads'] = self.test_campaigns_with_leads()
        
        # Cleanup
        self.cleanup()
        
        # Summary
        self.log("=" * 60)
        self.log("TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
            if result:
                passed += 1
        
        self.log("=" * 60)
        self.log(f"OVERALL: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 All backend tests PASSED!", "SUCCESS")
        else:
            self.log(f"⚠️  {total - passed} test(s) FAILED", "ERROR")
        
        return test_results

if __name__ == "__main__":
    tester = LeadOSAPITester()
    results = tester.run_all_tests()