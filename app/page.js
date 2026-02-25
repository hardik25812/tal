'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  Users,
  Target,
  Upload,
  Settings,
  UsersRound,
  Search,
  Bell,
  Plus,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Trash2,
  Tag,
  Filter,
  ArrowUpDown,
  Check,
  X,
  Mail,
  Building2,
  Globe,
  Calendar,
  Activity,
  TrendingUp,
  FileSpreadsheet,
  Command,
  Eye,
  EyeOff,
  GripVertical,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import Papa from 'papaparse'

// API Base
const API_BASE = '/api'

// Sidebar Navigation Items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'campaigns', label: 'Campaigns', icon: Target },
  { id: 'import', label: 'Import Center', icon: Upload },
  { id: 'team', label: 'Team', icon: UsersRound },
  { id: 'settings', label: 'Settings', icon: Settings },
]

// Default columns for leads table
const defaultColumns = [
  { id: 'email', label: 'Email', visible: true },
  { id: 'firstName', label: 'First Name', visible: true },
  { id: 'lastName', label: 'Last Name', visible: true },
  { id: 'company', label: 'Company', visible: true },
  { id: 'domain', label: 'Domain', visible: true },
  { id: 'createdAt', label: 'Created At', visible: true },
  { id: 'tags', label: 'Tags', visible: true },
  { id: 'campaigns', label: 'Campaigns', visible: false },
]

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [stats, setStats] = useState({ totalLeads: 0, totalCampaigns: 0, leadsToday: 0, activeCampaigns: 0 })
  const [activities, setActivities] = useState([])
  const [leads, setLeads] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLeads, setSelectedLeads] = useState([])
  const [columns, setColumns] = useState(defaultColumns)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [loading, setLoading] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  
  // Modal states
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [newCampaignOpen, setNewCampaignOpen] = useState(false)
  const [bulkCampaignOpen, setBulkCampaignOpen] = useState(false)
  const [bulkTagOpen, setBulkTagOpen] = useState(false)
  const [addToCampaignOpen, setAddToCampaignOpen] = useState(false)

  // Keyboard shortcut for command palette
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard/stats`),
        fetch(`${API_BASE}/dashboard/activity`)
      ])
      const statsData = await statsRes.json()
      const activityData = await activityRes.json()
      setStats(statsData)
      setActivities(activityData)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    }
  }, [])

  // Fetch leads
  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
        ...(searchQuery && { search: searchQuery })
      })
      const res = await fetch(`${API_BASE}/leads?${params}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setPagination(data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 })
    } catch (error) {
      console.error('Failed to fetch leads:', error)
      toast.error('Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, sortBy, sortOrder, pagination.limit])

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/campaigns`)
      const data = await res.json()
      setCampaigns(data)
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData()
    fetchCampaigns()
  }, [])

  // Fetch leads when page changes
  useEffect(() => {
    if (currentPage === 'leads') {
      fetchLeads(pagination.page)
    }
  }, [currentPage, fetchLeads])

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 'leads') {
        fetchLeads(1)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Handle bulk actions
  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return
    try {
      await fetch(`${API_BASE}/leads/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', leadIds: selectedLeads })
      })
      toast.success(`Deleted ${selectedLeads.length} leads`)
      setSelectedLeads([])
      fetchLeads(pagination.page)
      fetchDashboardData()
    } catch (error) {
      toast.error('Failed to delete leads')
    }
  }

  const handleBulkAddToCampaign = async (campaignId) => {
    if (selectedLeads.length === 0) return
    try {
      await fetch(`${API_BASE}/leads/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addToCampaign', leadIds: selectedLeads, data: { campaignId } })
      })
      toast.success(`Added ${selectedLeads.length} leads to campaign`)
      setSelectedLeads([])
      setBulkCampaignOpen(false)
      fetchLeads(pagination.page)
    } catch (error) {
      toast.error('Failed to add leads to campaign')
    }
  }

  const handleBulkAddTag = async (tag) => {
    if (selectedLeads.length === 0 || !tag) return
    try {
      await fetch(`${API_BASE}/leads/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addTag', leadIds: selectedLeads, data: { tag } })
      })
      toast.success(`Added tag to ${selectedLeads.length} leads`)
      setSelectedLeads([])
      setBulkTagOpen(false)
      fetchLeads(pagination.page)
    } catch (error) {
      toast.error('Failed to add tag')
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        className="flex flex-col border-r border-border bg-sidebar h-full"
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Target className="w-5 h-5 text-primary-foreground" />
            </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-semibold text-lg"
                >
                  LeadOS
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentPage(item.id)
                setSelectedLead(null)
                setSelectedCampaign(null)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${
                currentPage === item.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          ))}
        </nav>

        {/* Collapse button */}
        <div className="p-2 border-t border-border">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden md:flex items-center gap-2 text-muted-foreground"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">Search...</span>
              <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 hidden sm:flex">
                <Command className="h-3 w-3" />K
              </kbd>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setNewLeadOpen(true)}>
                  <Users className="w-4 h-4 mr-2" />
                  New Lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNewCampaignOpen(true)}>
                  <Target className="w-4 h-4 mr-2" />
                  New Campaign
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                    A
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Admin User</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {currentPage === 'dashboard' && (
            <DashboardPage stats={stats} activities={activities} />
          )}
          {currentPage === 'leads' && !selectedLead && (
            <LeadsPage
              leads={leads}
              pagination={pagination}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedLeads={selectedLeads}
              setSelectedLeads={setSelectedLeads}
              columns={columns}
              setColumns={setColumns}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              loading={loading}
              fetchLeads={fetchLeads}
              onLeadClick={setSelectedLead}
              onBulkDelete={handleBulkDelete}
              setBulkCampaignOpen={setBulkCampaignOpen}
              setBulkTagOpen={setBulkTagOpen}
              setNewLeadOpen={setNewLeadOpen}
              setCurrentPage={setCurrentPage}
              campaigns={campaigns}
            />
          )}
          {currentPage === 'leads' && selectedLead && (
            <LeadDetailPage
              lead={selectedLead}
              onBack={() => setSelectedLead(null)}
              onUpdate={(updated) => {
                setSelectedLead(updated)
                fetchLeads(pagination.page)
              }}
              campaigns={campaigns}
            />
          )}
          {currentPage === 'campaigns' && !selectedCampaign && (
            <CampaignsPage
              campaigns={campaigns}
              fetchCampaigns={fetchCampaigns}
              onCampaignClick={setSelectedCampaign}
              setNewCampaignOpen={setNewCampaignOpen}
            />
          )}
          {currentPage === 'campaigns' && selectedCampaign && (
            <CampaignDetailPage
              campaign={selectedCampaign}
              onBack={() => {
                setSelectedCampaign(null)
                fetchCampaigns()
              }}
              onAddLeads={() => setAddToCampaignOpen(true)}
            />
          )}
          {currentPage === 'import' && (
            <ImportCenterPage
              onImportComplete={() => {
                fetchLeads(1)
                fetchDashboardData()
              }}
            />
          )}
          {currentPage === 'team' && <TeamPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search leads, campaigns, or actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { setNewLeadOpen(true); setCommandOpen(false) }}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Lead
            </CommandItem>
            <CommandItem onSelect={() => { setNewCampaignOpen(true); setCommandOpen(false) }}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Campaign
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigation">
            {navItems.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => {
                  setCurrentPage(item.id)
                  setSelectedLead(null)
                  setSelectedCampaign(null)
                  setCommandOpen(false)
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* New Lead Dialog */}
      <NewLeadDialog
        open={newLeadOpen}
        onOpenChange={setNewLeadOpen}
        onSuccess={() => {
          fetchLeads(pagination.page)
          fetchDashboardData()
        }}
      />

      {/* New Campaign Dialog */}
      <NewCampaignDialog
        open={newCampaignOpen}
        onOpenChange={setNewCampaignOpen}
        onSuccess={fetchCampaigns}
      />

      {/* Bulk Add to Campaign Dialog */}
      <Dialog open={bulkCampaignOpen} onOpenChange={setBulkCampaignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Campaign</DialogTitle>
            <DialogDescription>
              Select a campaign to add {selectedLeads.length} leads to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => handleBulkAddToCampaign(campaign.id)}
                className="w-full p-4 rounded-xl border border-border hover:bg-accent transition-colors text-left"
              >
                <div className="font-medium">{campaign.name}</div>
                <div className="text-sm text-muted-foreground">{campaign.leadsCount || 0} leads</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Tag Dialog */}
      <BulkTagDialog
        open={bulkTagOpen}
        onOpenChange={setBulkTagOpen}
        onSubmit={handleBulkAddTag}
        count={selectedLeads.length}
      />

      {/* Add Leads to Campaign Dialog */}
      <AddLeadsToCampaignDialog
        open={addToCampaignOpen}
        onOpenChange={setAddToCampaignOpen}
        campaign={selectedCampaign}
        onSuccess={() => {
          setSelectedCampaign({ ...selectedCampaign })
          fetchLeads(pagination.page)
        }}
      />
    </div>
  )
}

// Dashboard Page Component
function DashboardPage({ stats, activities }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your lead intelligence overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Leads" value={stats.totalLeads} icon={Users} />
        <StatsCard title="Total Campaigns" value={stats.totalCampaigns} icon={Target} />
        <StatsCard title="Leads Today" value={stats.leadsToday} icon={TrendingUp} trend="up" />
        <StatsCard title="Active Campaigns" value={stats.activeCampaigns} icon={Activity} />
      </div>

      {/* Recent Activity */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest actions across your leads and campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recent activity. Start by importing leads or creating a campaign.
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{activity.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {activity.leadEmail || activity.campaignName || activity.details}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Stats Card Component
function StatsCard({ title, value, icon: Icon, trend }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold mt-1">{value?.toLocaleString() || 0}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center">
            <Icon className="w-6 h-6 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Leads Page Component
function LeadsPage({
  leads,
  pagination,
  searchQuery,
  setSearchQuery,
  selectedLeads,
  setSelectedLeads,
  columns,
  setColumns,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  loading,
  fetchLeads,
  onLeadClick,
  onBulkDelete,
  setBulkCampaignOpen,
  setBulkTagOpen,
  setNewLeadOpen,
  setCurrentPage,
  campaigns
}) {
  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(leads.map(l => l.id))
    }
  }

  const toggleSelect = (id) => {
    setSelectedLeads(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleColumn = (columnId) => {
    setColumns(prev =>
      prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    )
  }

  const visibleColumns = columns.filter(col => col.visible)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-muted-foreground">{pagination.total.toLocaleString()} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setNewLeadOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
          <Button variant="outline" onClick={() => setCurrentPage('import')}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Sort By</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map(col => (
              <DropdownMenuItem
                key={col.id}
                onClick={() => {
                  if (sortBy === col.id) {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortBy(col.id)
                    setSortOrder('desc')
                  }
                }}
              >
                {col.label}
                {sortBy === col.id && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({sortOrder})
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map(col => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.visible}
                onCheckedChange={() => toggleColumn(col.id)}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedLeads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-accent"
          >
            <span className="text-sm font-medium">{selectedLeads.length} selected</span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setBulkCampaignOpen(true)}>
              <Target className="w-4 h-4 mr-2" />
              Add to Campaign
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkTagOpen(true)}>
              <Tag className="w-4 h-4 mr-2" />
              Add Tag
            </Button>
            <Button variant="destructive" size="sm" onClick={onBulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedLeads([])}>
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-4 text-left">
                  <Checkbox
                    checked={leads.length > 0 && selectedLeads.length === leads.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                {visibleColumns.map(col => (
                  <th key={col.id} className="p-4 text-left text-sm font-medium text-muted-foreground">
                    {col.label}
                  </th>
                ))}
                <th className="p-4 text-right" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="p-8 text-center text-muted-foreground">
                    No leads found. Import some leads to get started.
                  </td>
                </tr>
              ) : (
                leads.map(lead => (
                  <tr
                    key={lead.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => onLeadClick(lead)}
                  >
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                      />
                    </td>
                    {visibleColumns.map(col => (
                      <td key={col.id} className="p-4">
                        {col.id === 'tags' ? (
                          <div className="flex gap-1 flex-wrap">
                            {(lead.tags || []).slice(0, 3).map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {(lead.tags || []).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{lead.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : col.id === 'campaigns' ? (
                          <Badge variant="outline">
                            {(lead.campaigns || []).length} campaigns
                          </Badge>
                        ) : col.id === 'createdAt' ? (
                          <span className="text-sm text-muted-foreground">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm">{lead[col.id] || '-'}</span>
                        )}
                      </td>
                    ))}
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onLeadClick(lead)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={async () => {
                              await fetch(`${API_BASE}/leads/${lead.id}`, { method: 'DELETE' })
                              toast.success('Lead deleted')
                              fetchLeads(pagination.page)
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => fetchLeads(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => fetchLeads(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// Lead Detail Page Component
function LeadDetailPage({ lead, onBack, onUpdate, campaigns }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState(lead)
  const [activities, setActivities] = useState([])
  const [newCustomField, setNewCustomField] = useState({ name: '', value: '' })
  const [customFieldOpen, setCustomFieldOpen] = useState(false)

  useEffect(() => {
    fetchActivities()
  }, [lead.id])

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API_BASE}/leads/${lead.id}/activity`)
      const data = await res.json()
      setActivities(data)
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    }
  }

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_BASE}/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const updated = await res.json()
      onUpdate(updated)
      setEditing(false)
      toast.success('Lead updated')
    } catch (error) {
      toast.error('Failed to update lead')
    }
  }

  const handleAddCustomField = async () => {
    if (!newCustomField.name || !newCustomField.value) return
    const updatedFields = { ...formData.customFields, [newCustomField.name]: newCustomField.value }
    setFormData({ ...formData, customFields: updatedFields })
    
    try {
      const res = await fetch(`${API_BASE}/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customFields: updatedFields })
      })
      const updated = await res.json()
      onUpdate(updated)
      setNewCustomField({ name: '', value: '' })
      setCustomFieldOpen(false)
      toast.success('Custom field added')
    } catch (error) {
      toast.error('Failed to add custom field')
    }
  }

  const leadCampaigns = campaigns.filter(c => (lead.campaigns || []).includes(c.id))

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="-ml-2">
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back to Leads
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Mail className="w-6 h-6" />
            {lead.email}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            {lead.firstName && <span>{lead.firstName} {lead.lastName}</span>}
            {lead.company && (
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {lead.company}
              </span>
            )}
            {lead.domain && (
              <span className="flex items-center gap-1">
                <Globe className="w-4 h-4" />
                {lead.domain}
              </span>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            {(lead.tags || []).map((tag, i) => (
              <Badge key={i} variant="secondary">{tag}</Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => { setEditing(false); setFormData(lead) }}>Cancel</Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>Edit Lead</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="custom">Custom Fields</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    {editing ? (
                      <Input
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{lead.email}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">First Name</Label>
                    {editing ? (
                      <Input
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{lead.firstName || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Name</Label>
                    {editing ? (
                      <Input
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{lead.lastName || '-'}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Company</Label>
                    {editing ? (
                      <Input
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{lead.company || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Domain</Label>
                    {editing ? (
                      <Input
                        value={formData.domain}
                        onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{lead.domain || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Created At</Label>
                    <p className="font-medium">{new Date(lead.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Associated Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {leadCampaigns.length === 0 ? (
                <p className="text-muted-foreground">This lead is not assigned to any campaigns.</p>
              ) : (
                <div className="space-y-3">
                  {leadCampaigns.map(campaign => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 rounded-xl border border-border">
                      <div>
                        <div className="font-medium">{campaign.name}</div>
                        <div className="text-sm text-muted-foreground">{campaign.description}</div>
                      </div>
                      <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                        {campaign.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-6">
                    {activities.map((activity, i) => (
                      <div key={activity.id} className="relative flex gap-4 pl-10">
                        <div className="absolute left-2 w-4 h-4 rounded-full bg-accent border-2 border-background" />
                        <div>
                          <div className="font-medium text-sm">{activity.action}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="mt-6">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Custom Fields</CardTitle>
              <Dialog open={customFieldOpen} onOpenChange={setCustomFieldOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Field
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Custom Field</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Field Name</Label>
                      <Input
                        value={newCustomField.name}
                        onChange={(e) => setNewCustomField({ ...newCustomField, name: e.target.value })}
                        placeholder="e.g., LinkedIn URL"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Field Value</Label>
                      <Input
                        value={newCustomField.value}
                        onChange={(e) => setNewCustomField({ ...newCustomField, value: e.target.value })}
                        placeholder="e.g., https://linkedin.com/in/..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCustomFieldOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddCustomField}>Add Field</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {Object.keys(lead.customFields || {}).length === 0 ? (
                <p className="text-muted-foreground">No custom fields added yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(lead.customFields || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-border">
                      <div>
                        <div className="text-sm text-muted-foreground">{key}</div>
                        <div className="font-medium">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Campaigns Page Component
function CampaignsPage({ campaigns, fetchCampaigns, onCampaignClick, setNewCampaignOpen }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-muted-foreground">{campaigns.length} total campaigns</p>
        </div>
        <Button onClick={() => setNewCampaignOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Campaign Name</th>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Leads</th>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Created</th>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Owner</th>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Status</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No campaigns yet. Create your first campaign.
                </td>
              </tr>
            ) : (
              campaigns.map(campaign => (
                <tr
                  key={campaign.id}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onCampaignClick(campaign)}
                >
                  <td className="p-4">
                    <div className="font-medium">{campaign.name}</div>
                    {campaign.description && (
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {campaign.description}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant="outline">{campaign.leadsCount || 0}</Badge>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-sm">{campaign.owner}</td>
                  <td className="p-4">
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onCampaignClick(campaign)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={async () => {
                            await fetch(`${API_BASE}/campaigns/${campaign.id}`, { method: 'DELETE' })
                            toast.success('Campaign deleted')
                            fetchCampaigns()
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// Campaign Detail Page Component
function CampaignDetailPage({ campaign, onBack, onAddLeads }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('leads')

  useEffect(() => {
    fetchCampaignLeads()
  }, [campaign.id])

  const fetchCampaignLeads = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/leads?campaignId=${campaign.id}&limit=100`)
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (error) {
      console.error('Failed to fetch campaign leads:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="-ml-2">
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back to Campaigns
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Target className="w-6 h-6" />
            {campaign.name}
          </h1>
          {campaign.description && (
            <p className="text-muted-foreground mt-1">{campaign.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3">
            <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
              {campaign.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created {new Date(campaign.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <Button onClick={onAddLeads}>
          <Plus className="w-4 h-4 mr-2" />
          Add Leads
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-6">
          <Card className="rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Email</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Name</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Company</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Added</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No leads in this campaign yet.
                    </td>
                  </tr>
                ) : (
                  leads.map(lead => (
                    <tr key={lead.id} className="border-t border-border">
                      <td className="p-4 text-sm">{lead.email}</td>
                      <td className="p-4 text-sm">{lead.firstName} {lead.lastName}</td>
                      <td className="p-4 text-sm">{lead.company || '-'}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card className="rounded-2xl p-6">
            <p className="text-muted-foreground">Campaign activity coming soon...</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Import Center Page Component
function ImportCenterPage({ onImportComplete }) {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [csvData, setCsvData] = useState([])
  const [csvHeaders, setCsvHeaders] = useState([])
  const [columnMapping, setColumnMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  const fieldOptions = [
    { value: 'email', label: 'Email' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'company', label: 'Company' },
    { value: 'domain', label: 'Domain' },
    { value: 'custom', label: 'Custom Field' },
    { value: 'skip', label: 'Skip' }
  ]

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    Papa.parse(selectedFile, {
      header: true,
      preview: 50,
      complete: (results) => {
        setCsvHeaders(results.meta.fields || [])
        setCsvData(results.data.filter(row => Object.values(row).some(v => v)))
        
        // Auto-map common column names
        const autoMapping = {}
        results.meta.fields?.forEach(header => {
          const lower = header.toLowerCase()
          if (lower.includes('email')) autoMapping[header] = 'email'
          else if (lower.includes('first') && lower.includes('name')) autoMapping[header] = 'firstName'
          else if (lower.includes('last') && lower.includes('name')) autoMapping[header] = 'lastName'
          else if (lower === 'company' || lower.includes('company')) autoMapping[header] = 'company'
          else if (lower === 'domain' || lower.includes('domain')) autoMapping[header] = 'domain'
          else autoMapping[header] = 'skip'
        })
        setColumnMapping(autoMapping)
        setStep(2)
      },
      error: (error) => {
        toast.error('Failed to parse CSV file')
        console.error(error)
      }
    })
  }

  const handleImport = async () => {
    setImporting(true)
    setStep(3)

    try {
      // Transform data based on mapping
      const leads = csvData.map(row => {
        const lead = { customFields: {} }
        Object.entries(columnMapping).forEach(([csvColumn, field]) => {
          if (field === 'skip') return
          if (field === 'custom') {
            lead.customFields[csvColumn] = row[csvColumn]
          } else {
            lead[field] = row[csvColumn]
          }
        })
        return lead
      }).filter(lead => lead.email) // Only import rows with email

      const res = await fetch(`${API_BASE}/leads/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads })
      })

      const result = await res.json()
      setImportResult(result)
      setStep(4)
      onImportComplete()
      toast.success(`Imported ${result.imported} leads`)
    } catch (error) {
      toast.error('Import failed')
      console.error(error)
      setStep(2)
    } finally {
      setImporting(false)
    }
  }

  const resetImport = () => {
    setStep(1)
    setFile(null)
    setCsvData([])
    setCsvHeaders([])
    setColumnMapping({})
    setImportResult(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import Center</h1>
        <p className="text-muted-foreground">Import leads from CSV files</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {['Upload', 'Map Columns', 'Import', 'Complete'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step > i + 1 ? 'bg-primary text-primary-foreground' :
              step === i + 1 ? 'bg-accent text-foreground' :
              'bg-muted text-muted-foreground'
            }`}>
              {step > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm hidden sm:inline ${
              step >= i + 1 ? 'text-foreground' : 'text-muted-foreground'
            }`}>{label}</span>
            {i < 3 && <div className={`w-8 h-px ${
              step > i + 1 ? 'bg-primary' : 'bg-border'
            }`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card className="rounded-2xl">
          <CardContent className="p-8">
            <div
              className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-muted-foreground transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={(e) => {
                e.preventDefault()
                const droppedFile = e.dataTransfer.files?.[0]
                if (droppedFile && droppedFile.name.endsWith('.csv')) {
                  const input = fileInputRef.current
                  if (input) {
                    const dataTransfer = new DataTransfer()
                    dataTransfer.items.add(droppedFile)
                    input.files = dataTransfer.files
                    handleFileSelect({ target: input })
                  }
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Drop your CSV file here</h3>
              <p className="text-muted-foreground mb-4">or click to browse</p>
              <Button variant="outline">Select CSV File</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Map Columns</CardTitle>
              <CardDescription>
                Match your CSV columns to lead fields
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {csvHeaders.map(header => (
                  <div key={header} className="flex items-center gap-4">
                    <div className="w-48 text-sm font-medium truncate">{header}</div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={columnMapping[header] || 'skip'}
                      onValueChange={(value) => setColumnMapping({ ...columnMapping, [header]: value })}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Preview (First 20 rows)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {csvHeaders.map(h => (
                        <th key={h} className="p-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        {csvHeaders.map(h => (
                          <td key={h} className="p-2 truncate max-w-xs">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button variant="outline" onClick={resetImport}>Back</Button>
            <Button onClick={handleImport} disabled={!columnMapping.email || !Object.values(columnMapping).includes('email')}>
              Import {csvData.filter(r => r[Object.entries(columnMapping).find(([k, v]) => v === 'email')?.[0]]).length} Leads
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === 3 && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
            <h3 className="text-lg font-medium">Importing leads...</h3>
            <p className="text-muted-foreground">This may take a moment</p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === 4 && importResult && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Import Complete!</h3>
            <div className="space-y-2 text-muted-foreground mb-6">
              <p className="text-lg"><span className="text-foreground font-semibold">{importResult.imported}</span> leads imported</p>
              <p><span className="text-foreground font-semibold">{importResult.skipped}</span> duplicates skipped</p>
              <p>Total processed: {importResult.total}</p>
            </div>
            <Button onClick={resetImport}>Import More</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Team Page Component (UI only)
function TeamPage() {
  const teamMembers = [
    { id: 1, name: 'Admin User', email: 'admin@leadOS.com', role: 'Admin', status: 'Active' },
    { id: 2, name: 'John Doe', email: 'john@leadOS.com', role: 'Editor', status: 'Active' },
    { id: 3, name: 'Jane Smith', email: 'jane@leadOS.com', role: 'Viewer', status: 'Invited' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-muted-foreground">Manage team access and permissions</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Member</th>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Role</th>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Status</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {teamMembers.map(member => (
              <tr key={member.id} className="border-t border-border">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <Badge variant="outline">{member.role}</Badge>
                </td>
                <td className="p-4">
                  <Badge variant={member.status === 'Active' ? 'default' : 'secondary'}>
                    {member.status}
                  </Badge>
                </td>
                <td className="p-4 text-right">
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// Settings Page Component
function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your LeadOS preferences</p>
      </div>

      <div className="grid gap-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic application settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Dark Mode</div>
                <div className="text-sm text-muted-foreground">Enable dark theme</div>
              </div>
              <Badge>Enabled</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Notifications</div>
                <div className="text-sm text-muted-foreground">Email notifications for imports</div>
              </div>
              <Badge variant="secondary">Disabled</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Export and manage your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export All Leads
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// New Lead Dialog Component
function NewLeadDialog({ open, onOpenChange, onSuccess }) {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    company: '',
    domain: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!formData.email) {
      toast.error('Email is required')
      return
    }
    setLoading(true)
    try {
      await fetch(`${API_BASE}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      toast.success('Lead created')
      onOpenChange(false)
      setFormData({ email: '', firstName: '', lastName: '', company: '', domain: '' })
      onSuccess()
    } catch (error) {
      toast.error('Failed to create lead')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
          <DialogDescription>Add a new lead to your database</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
              type="email"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Company</Label>
            <Input
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Acme Inc"
            />
          </div>
          <div className="space-y-2">
            <Label>Domain</Label>
            <Input
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="acme.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// New Campaign Dialog Component
function NewCampaignDialog({ open, onOpenChange, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active'
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Campaign name is required')
      return
    }
    setLoading(true)
    try {
      await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      toast.success('Campaign created')
      onOpenChange(false)
      setFormData({ name: '', description: '', status: 'active' })
      onSuccess()
    } catch (error) {
      toast.error('Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
          <DialogDescription>Create a new email campaign</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Campaign Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Q1 Outreach"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Campaign description..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Bulk Tag Dialog Component
function BulkTagDialog({ open, onOpenChange, onSubmit, count }) {
  const [tag, setTag] = useState('')

  const handleSubmit = () => {
    if (tag) {
      onSubmit(tag)
      setTag('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tag</DialogTitle>
          <DialogDescription>
            Add a tag to {count} selected leads
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label>Tag Name</Label>
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="e.g., Hot Lead"
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!tag}>Add Tag</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Add Leads to Campaign Dialog Component
function AddLeadsToCampaignDialog({ open, onOpenChange, campaign, onSuccess }) {
  const [leads, setLeads] = useState([])
  const [selectedLeads, setSelectedLeads] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchLeads()
    }
  }, [open, search])

  const fetchLeads = async () => {
    try {
      const params = new URLSearchParams({ limit: '50', ...(search && { search }) })
      const res = await fetch(`${API_BASE}/leads?${params}`)
      const data = await res.json()
      // Filter out leads already in campaign
      setLeads((data.leads || []).filter(l => !(l.campaigns || []).includes(campaign?.id)))
    } catch (error) {
      console.error('Failed to fetch leads:', error)
    }
  }

  const handleAdd = async () => {
    if (selectedLeads.length === 0 || !campaign) return
    setLoading(true)
    try {
      await fetch(`${API_BASE}/leads/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addToCampaign',
          leadIds: selectedLeads,
          data: { campaignId: campaign.id }
        })
      })
      toast.success(`Added ${selectedLeads.length} leads to campaign`)
      setSelectedLeads([])
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      toast.error('Failed to add leads')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Leads to {campaign?.name}</DialogTitle>
          <DialogDescription>
            Select leads to add to this campaign
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ScrollArea className="h-[300px] border rounded-xl">
            {leads.map(lead => (
              <div
                key={lead.id}
                className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer"
                onClick={() => {
                  setSelectedLeads(prev =>
                    prev.includes(lead.id)
                      ? prev.filter(id => id !== lead.id)
                      : [...prev, lead.id]
                  )
                }}
              >
                <Checkbox checked={selectedLeads.includes(lead.id)} />
                <div>
                  <div className="font-medium text-sm">{lead.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {lead.firstName} {lead.lastName} {lead.company && `• ${lead.company}`}
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={loading || selectedLeads.length === 0}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Add {selectedLeads.length} Leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
