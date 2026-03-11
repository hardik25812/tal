'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  Download,
  Loader2,
  CheckCircle2,
  List,
  CalendarRange,
  Tags,
  Phone,
  LinkIcon,
  AlertCircle,
  LayoutGrid,
  FolderOpen,
  LogOut,
  Shield,
  ShieldCheck,
  UserPlus,
  Ban,
  UserCheck
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import Papa from 'papaparse'

const API_BASE = '/api'

// ── Auth helpers ──
function getStoredToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('leadosToken')
}
function setStoredToken(token) {
  localStorage.setItem('leadosToken', token)
  document.cookie = `leadosToken=${token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`
}
function clearStoredToken() {
  localStorage.removeItem('leadosToken')
  localStorage.removeItem('leadosUser')
  document.cookie = 'leadosToken=; path=/; max-age=0'
}
function getStoredUser() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem('leadosUser')) } catch { return null }
}
function setStoredUser(user) {
  localStorage.setItem('leadosUser', JSON.stringify(user))
}
function authHeaders() {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
function authFetch(url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: { ...opts.headers, ...authHeaders() }
  })
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'lists', label: 'Lists', icon: List },
  { id: 'campaigns', label: 'Campaigns', icon: Target },
  { id: 'import', label: 'Import Center', icon: Upload },
  { id: 'team', label: 'Team', icon: UsersRound, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const defaultColumns = [
  { id: 'email', label: 'Email', visible: true },
  { id: 'firstName', label: 'First Name', visible: true },
  { id: 'lastName', label: 'Last Name', visible: true },
  { id: 'company', label: 'Company', visible: true },
  { id: 'domain', label: 'Domain', visible: true },
  { id: 'phone', label: 'Phone', visible: false },
  { id: 'status', label: 'Status', visible: true },
  { id: 'createdAt', label: 'Created At', visible: true },
  { id: 'tags', label: 'Tags', visible: true },
  { id: 'campaigns', label: 'Campaigns', visible: false },
]

// ── Cache staleness threshold (ms) ──
const CACHE_TTL = 30000 // 30 seconds

export default function App() {
  // ── Auth state ──
  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authScreen, setAuthScreen] = useState('login') // 'login' | 'register'

  // Check for existing session on mount
  useEffect(() => {
    const stored = getStoredUser()
    const token = getStoredToken()
    if (stored && token) {
      // Validate token with server
      authFetch(`${API_BASE}/auth/me`).then(res => {
        if (res.ok) return res.json()
        throw new Error('Invalid session')
      }).then(user => {
        setAuthUser(user)
        setStoredUser(user)
        setAuthLoading(false)
      }).catch(() => {
        clearStoredToken()
        setAuthLoading(false)
      })
    } else {
      setAuthLoading(false)
    }
  }, [])

  const handleLogin = async (email, password) => {
    console.log('Login attempt:', email)
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    console.log('Login response:', res.status, data)
    if (!res.ok) throw new Error(data.error || 'Login failed')
    console.log('Login success, setting user:', data.user)
    setStoredToken(data.token)
    setStoredUser(data.user)
    setAuthUser(data.user)
    console.log('Auth user set')
    return data.user
  }

  const handleRegister = async (name, email, password) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Registration failed')
    setStoredToken(data.token)
    setStoredUser(data.user)
    setAuthUser(data.user)
    return data.user
  }

  const handleLogout = () => {
    clearStoredToken()
    setAuthUser(null)
  }

  // Show loading screen
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Target className="w-7 h-7 text-primary-foreground" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Show login/register screen
  if (!authUser) {
    return <LoginScreen
      screen={authScreen}
      setScreen={setAuthScreen}
      onLogin={handleLogin}
      onRegister={handleRegister}
    />
  }

  const isAdmin = authUser.role === 'admin'

  return <AuthenticatedApp
    authUser={authUser}
    isAdmin={isAdmin}
    onLogout={handleLogout}
  />
}

// ── Login / Register Screen ──
function LoginScreen({ screen, setScreen, onLogin, onRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (screen === 'login') {
        await onLogin(email, password)
      } else {
        await onRegister(name, email, password)
      }
      // Success - component will unmount, no need to setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-background to-primary/5 items-center justify-center p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Target className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold">LeadOS</span>
          </div>
          <h2 className="text-2xl font-semibold mb-4">Lead Intelligence Dashboard</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Centralized lead database for high-volume cold email operators. Import, enrich, and manage leads at scale.
          </p>
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>Import 500K+ leads via CSV</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>Campaign-based enrichment tracking</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>Team management with role-based access</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Target className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">LeadOS</span>
          </div>

          <h1 className="text-2xl font-semibold mb-2">
            {screen === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {screen === 'login' ? 'Sign in to your account to continue' : 'Register a new account to get started'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {screen === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={screen === 'register' ? 'Min 6 characters' : '••••••••'}
                required
                minLength={screen === 'register' ? 6 : undefined}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {screen === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {screen === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button onClick={() => { setScreen('register'); setError('') }} className="text-primary hover:underline font-medium">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => { setScreen('login'); setError('') }} className="text-primary hover:underline font-medium">
                  Sign in
                </button>
              </>
            )}
          </div>

          {screen === 'login' && (
            <div className="mt-4 p-3 rounded-xl bg-muted text-xs text-muted-foreground">
              <p className="font-medium mb-1">Default admin credentials:</p>
              <p>Email: admin@leados.com</p>
              <p>Password: admin123</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AuthenticatedApp({ authUser, isAdmin, onLogout }) {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [stats, setStats] = useState({ totalLeads: 0, totalCampaigns: 0, leadsToday: 0, activeCampaigns: 0 })
  const [activities, setActivities] = useState([])
  const [leads, setLeads] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [lists, setLists] = useState([])
  const [allTags, setAllTags] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLeads, setSelectedLeads] = useState([])
  const [columns, setColumns] = useState(defaultColumns)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [loading, setLoading] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [selectedList, setSelectedList] = useState(null)
  const [activeFilters, setActiveFilters] = useState({ tag: '', dateFrom: '', dateTo: '', listId: '' })
  
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [newCampaignOpen, setNewCampaignOpen] = useState(false)
  const [newListOpen, setNewListOpen] = useState(false)
  const [bulkCampaignOpen, setBulkCampaignOpen] = useState(false)
  const [bulkTagOpen, setBulkTagOpen] = useState(false)
  const [addToCampaignOpen, setAddToCampaignOpen] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)

  // Cache timestamps — skip fetches if data is fresh
  const cacheRef = useRef({ dashboard: 0, leads: 0, campaigns: 0, lists: 0, tags: 0 })
  const isFresh = useCallback((key) => Date.now() - cacheRef.current[key] < CACHE_TTL, [])

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

  const fetchDashboardData = useCallback(async (force = false) => {
    if (!force && isFresh('dashboard')) return
    try {
      const [statsRes, activityRes] = await Promise.all([
        authFetch(`${API_BASE}/dashboard/stats`),
        authFetch(`${API_BASE}/dashboard/activity`)
      ])
      const statsData = await statsRes.json()
      const activityData = await activityRes.json()
      // Only update stats if we got valid data (not an error object)
      if (statsData && typeof statsData.totalLeads === 'number') {
        setStats(statsData)
      }
      setActivities(Array.isArray(activityData) ? activityData : [])
      cacheRef.current.dashboard = Date.now()
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    }
  }, [isFresh])

  const fetchLeads = useCallback(async (page = 1, force = false) => {
    // Non-blocking: only show spinner if we have no data yet
    const showSpinner = leads.length === 0
    if (showSpinner) setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
        lean: '1',
        ...(searchQuery && { search: searchQuery }),
        ...(activeFilters.tag && { tag: activeFilters.tag }),
        ...(activeFilters.dateFrom && { dateFrom: activeFilters.dateFrom }),
        ...(activeFilters.dateTo && { dateTo: activeFilters.dateTo }),
        ...(activeFilters.listId && { listId: activeFilters.listId })
      })
      const res = await authFetch(`${API_BASE}/leads?${params}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setPagination(data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 })
      cacheRef.current.leads = Date.now()
    } catch (error) {
      console.error('Failed to fetch leads:', error)
      toast.error('Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, sortBy, sortOrder, pagination.limit, activeFilters, leads.length])

  const fetchCampaigns = useCallback(async (force = false) => {
    if (!force && isFresh('campaigns')) return
    try {
      const res = await authFetch(`${API_BASE}/campaigns`)
      const data = await res.json()
      setCampaigns(Array.isArray(data) ? data : [])
      cacheRef.current.campaigns = Date.now()
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    }
  }, [isFresh])

  const fetchLists = useCallback(async (force = false) => {
    if (!force && isFresh('lists')) return
    try {
      const res = await authFetch(`${API_BASE}/lists`)
      const data = await res.json()
      setLists(Array.isArray(data) ? data : [])
      cacheRef.current.lists = Date.now()
    } catch (error) {
      console.error('Failed to fetch lists:', error)
    }
  }, [isFresh])

  const fetchTags = useCallback(async (force = false) => {
    if (!force && isFresh('tags')) return
    try {
      const res = await authFetch(`${API_BASE}/tags`)
      const data = await res.json()
      setAllTags(Array.isArray(data) ? data : [])
      cacheRef.current.tags = Date.now()
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }, [isFresh])

  // Initial load — fetch everything once
  useEffect(() => {
    fetchDashboardData(true)
    fetchCampaigns(true)
    fetchLists(true)
    fetchTags(true)
  }, [])

  // On page navigation — only fetch what's needed and stale
  useEffect(() => {
    if (currentPage === 'leads' && !isFresh('leads')) {
      fetchLeads(pagination.page)
    } else if (currentPage === 'dashboard') {
      fetchDashboardData()
    } else if (currentPage === 'campaigns') {
      fetchCampaigns()
    } else if (currentPage === 'lists') {
      fetchLists()
    }
  }, [currentPage])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 'leads') {
        fetchLeads(1)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, activeFilters])

  const handleExportLeads = async (leadIds = null) => {
    try {
      const params = new URLSearchParams({
        ...(leadIds && { leadIds: leadIds.join(',') }),
        ...(searchQuery && { search: searchQuery }),
        ...(activeFilters.tag && { tag: activeFilters.tag }),
        ...(activeFilters.dateFrom && { dateFrom: activeFilters.dateFrom }),
        ...(activeFilters.dateTo && { dateTo: activeFilters.dateTo })
      })
      
      const url = `${API_BASE}/leads/export?${params}`
      window.open(url, '_blank')
      toast.success('Export started')
    } catch (error) {
      toast.error('Export failed')
    }
  }

  const handleExportCampaign = async (campaignId) => {
    window.open(`${API_BASE}/campaigns/${campaignId}/export`, '_blank')
    toast.success('Export started')
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return
    try {
      await authFetch(`${API_BASE}/leads/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', leadIds: selectedLeads })
      })
      toast.success(`Deleted ${selectedLeads.length} leads`)
      setSelectedLeads([])
      cacheRef.current.leads = 0
      cacheRef.current.dashboard = 0
      fetchLeads(pagination.page, true)
      fetchDashboardData(true)
    } catch (error) {
      toast.error('Failed to delete leads')
    }
  }

  const handleBulkAddToCampaign = async (campaignId) => {
    if (selectedLeads.length === 0) return
    try {
      await authFetch(`${API_BASE}/leads/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addToCampaign', leadIds: selectedLeads, data: { campaignId } })
      })
      toast.success(`Added ${selectedLeads.length} leads to campaign`)
      setSelectedLeads([])
      setBulkCampaignOpen(false)
      cacheRef.current.leads = 0
      fetchLeads(pagination.page, true)
    } catch (error) {
      toast.error('Failed to add leads to campaign')
    }
  }

  const handleBulkAddTag = async (tag) => {
    if (selectedLeads.length === 0 || !tag) return
    try {
      await authFetch(`${API_BASE}/leads/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addTag', leadIds: selectedLeads, data: { tag } })
      })
      toast.success(`Added tag to ${selectedLeads.length} leads`)
      setSelectedLeads([])
      setBulkTagOpen(false)
      cacheRef.current.leads = 0
      cacheRef.current.tags = 0
      fetchLeads(pagination.page, true)
      fetchTags(true)
    } catch (error) {
      toast.error('Failed to add tag')
    }
  }

  const clearFilters = () => {
    setActiveFilters({ tag: '', dateFrom: '', dateTo: '', listId: '' })
    setSearchQuery('')
  }

  const hasActiveFilters = activeFilters.tag || activeFilters.dateFrom || activeFilters.dateTo || activeFilters.listId

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        className="flex flex-col border-r border-border bg-sidebar h-full"
      >
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

        <nav className="flex-1 py-4 px-2">
          {navItems.filter(item => !item.adminOnly || isAdmin).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentPage(item.id)
                setSelectedLead(null)
                setSelectedCampaign(null)
                setSelectedList(null)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${
                currentPage === item.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium transition-opacity duration-150">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>

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
                <DropdownMenuItem onClick={() => setNewListOpen(true)}>
                  <List className="w-4 h-4 mr-2" />
                  New List
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
                    {(authUser.name || authUser.email || '?').charAt(0).toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div>{authUser.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{authUser.email}</div>
                  <Badge variant={isAdmin ? 'default' : 'secondary'} className="mt-1 text-[10px]">
                    {isAdmin ? 'Admin' : 'User'}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCurrentPage('settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
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
              lists={lists}
              allTags={allTags}
              activeFilters={activeFilters}
              setActiveFilters={setActiveFilters}
              hasActiveFilters={hasActiveFilters}
              clearFilters={clearFilters}
              onExport={handleExportLeads}
            />
          )}
          {currentPage === 'leads' && selectedLead && (
            <LeadDetailPage
              lead={selectedLead}
              onBack={() => setSelectedLead(null)}
              onUpdate={(updated) => {
                setSelectedLead(updated)
                cacheRef.current.leads = 0
                cacheRef.current.tags = 0
                fetchLeads(pagination.page, true)
                fetchTags(true)
              }}
              campaigns={campaigns}
              allTags={allTags}
            />
          )}
          {currentPage === 'lists' && !selectedList && (
            <ListsPage
              lists={lists}
              fetchLists={fetchLists}
              onListClick={setSelectedList}
              setNewListOpen={setNewListOpen}
              campaigns={campaigns}
              allTags={allTags}
            />
          )}
          {currentPage === 'lists' && selectedList && (
            <ListDetailPage
              list={selectedList}
              onBack={() => {
                setSelectedList(null)
                cacheRef.current.lists = 0
                fetchLists(true)
              }}
              campaigns={campaigns}
              allTags={allTags}
              onExport={handleExportLeads}
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
                cacheRef.current.campaigns = 0
                fetchCampaigns(true)
              }}
              onAddLeads={() => setAddToCampaignOpen(true)}
              onExport={() => handleExportCampaign(selectedCampaign.id)}
            />
          )}
          {currentPage === 'import' && (
            <ImportCenterPage
              campaigns={campaigns}
              onImportComplete={() => {
                cacheRef.current.leads = 0
                cacheRef.current.dashboard = 0
                cacheRef.current.tags = 0
                cacheRef.current.campaigns = 0
                fetchLeads(1, true)
                fetchDashboardData(true)
                fetchTags(true)
                fetchCampaigns(true)
              }}
            />
          )}
          {currentPage === 'team' && isAdmin && <TeamPage authUser={authUser} />}
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
            <CommandItem onSelect={() => { setNewListOpen(true); setCommandOpen(false) }}>
              <Plus className="mr-2 h-4 w-4" />
              Create New List
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
                  setSelectedList(null)
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

      {/* Dialogs */}
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} onSuccess={() => { cacheRef.current.leads = 0; cacheRef.current.dashboard = 0; fetchLeads(pagination.page, true); fetchDashboardData(true) }} />
      <NewCampaignDialog open={newCampaignOpen} onOpenChange={setNewCampaignOpen} onSuccess={() => { cacheRef.current.campaigns = 0; fetchCampaigns(true) }} />
      <NewListDialog open={newListOpen} onOpenChange={setNewListOpen} onSuccess={() => { cacheRef.current.lists = 0; fetchLists(true) }} campaigns={campaigns} allTags={allTags} />

      <Dialog open={bulkCampaignOpen} onOpenChange={setBulkCampaignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Campaign</DialogTitle>
            <DialogDescription>Select a campaign to add {selectedLeads.length} leads to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(campaigns || []).map((campaign) => (
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

      <BulkTagDialog open={bulkTagOpen} onOpenChange={setBulkTagOpen} onSubmit={handleBulkAddTag} count={selectedLeads.length} allTags={allTags} />

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

// Dashboard Page
function DashboardPage({ stats, activities }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your lead intelligence overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Leads" value={stats.totalLeads} icon={Users} />
        <StatsCard title="Total Campaigns" value={stats.totalCampaigns} icon={Target} />
        <StatsCard title="Leads Today" value={stats.leadsToday} icon={TrendingUp} />
        <StatsCard title="Active Campaigns" value={stats.activeCampaigns} icon={Activity} />
      </div>

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
              {(activities || []).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{activity.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {activity.leadEmail || activity.campaignName || activity.listName || activity.details}
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

function StatsCard({ title, value, icon: Icon }) {
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

// Leads Page
function LeadsPage({
  leads, pagination, searchQuery, setSearchQuery, selectedLeads, setSelectedLeads,
  columns, setColumns, sortBy, setSortBy, sortOrder, setSortOrder, loading,
  fetchLeads, onLeadClick, onBulkDelete, setBulkCampaignOpen, setBulkTagOpen,
  setNewLeadOpen, setCurrentPage, campaigns, lists, allTags, activeFilters,
  setActiveFilters, hasActiveFilters, clearFilters, onExport
}) {
  const [viewMode, setViewMode] = useState('table')
  const [allGridLeads, setAllGridLeads] = useState([])
  const [gridLoading, setGridLoading] = useState(false)
  const [expandedDate, setExpandedDate] = useState(null)
  const gridFetchedRef = useRef(false)

  // Fetch ALL leads for grid view in a single fast request
  const fetchAllLeadsForGrid = useCallback(async () => {
    if (gridFetchedRef.current && allGridLeads.length > 0) return
    setGridLoading(true)
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '10000',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        lean: '1',
        grid: '1',
        ...(searchQuery && { search: searchQuery }),
        ...(activeFilters.tag && { tag: activeFilters.tag }),
        ...(activeFilters.dateFrom && { dateFrom: activeFilters.dateFrom }),
        ...(activeFilters.dateTo && { dateTo: activeFilters.dateTo }),
        ...(activeFilters.listId && { listId: activeFilters.listId })
      })
      const res = await authFetch(`${API_BASE}/leads?${params}`)
      const data = await res.json()
      setAllGridLeads(data.leads || [])
      gridFetchedRef.current = true
    } catch (error) {
      console.error('Failed to fetch all leads for grid:', error)
      toast.error('Failed to load grid view')
    } finally {
      setGridLoading(false)
    }
  }, [searchQuery, activeFilters])

  // Re-fetch grid leads when switching to grid view or when filters change
  useEffect(() => {
    if (viewMode === 'grid') {
      gridFetchedRef.current = false
      fetchAllLeadsForGrid()
    }
  }, [viewMode, searchQuery, activeFilters, fetchAllLeadsForGrid])

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(leads.map(l => l.id))
    }
  }

  const toggleSelect = (id) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleColumn = (columnId) => {
    setColumns(prev => prev.map(col => col.id === columnId ? { ...col, visible: !col.visible } : col))
  }

  const visibleColumns = columns.filter(col => col.visible)

  // Group ALL leads by creation date for grid view
  const groupedLeads = (allGridLeads || []).reduce((acc, lead) => {
    const date = new Date(lead.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!acc[date]) acc[date] = []
    acc[date].push(lead)
    return acc
  }, {})

  const handleExportGroup = (groupLeads) => {
    const ids = groupLeads.map(l => l.id)
    onExport(ids)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-muted-foreground">{pagination.total.toLocaleString()} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onExport(selectedLeads.length > 0 ? selectedLeads : null)}>
            <Download className="w-4 h-4 mr-2" />
            Export {selectedLeads.length > 0 ? `(${selectedLeads.length})` : 'All'}
          </Button>
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

      {/* Filters & Controls */}
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

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={hasActiveFilters ? 'border-primary' : ''}>
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {hasActiveFilters && <Badge className="ml-2" variant="secondary">Active</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Filter by Tag</Label>
                <Select value={activeFilters.tag || '__all__'} onValueChange={(v) => setActiveFilters({ ...activeFilters, tag: v === '__all__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select tag..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Tags</SelectItem>
                    {(allTags || []).map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Filter by List</Label>
                <Select value={activeFilters.listId || '__all__'} onValueChange={(v) => setActiveFilters({ ...activeFilters, listId: v === '__all__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select list..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Leads</SelectItem>
                    {(lists || []).map(list => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input type="date" value={activeFilters.dateFrom} onChange={(e) => setActiveFilters({ ...activeFilters, dateFrom: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input type="date" value={activeFilters.dateTo} onChange={(e) => setActiveFilters({ ...activeFilters, dateTo: e.target.value })} />
                </div>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

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
                {sortBy === col.id && <span className="ml-2 text-xs text-muted-foreground">({sortOrder})</span>}
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
              <DropdownMenuCheckboxItem key={col.id} checked={col.visible} onCheckedChange={() => toggleColumn(col.id)}>
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-none h-8 px-2"
            onClick={() => setViewMode('table')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-none h-8 px-2"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
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
            <Button variant="outline" size="sm" onClick={() => onExport(selectedLeads)}>
              <Download className="w-4 h-4 mr-2" />
              Export
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

      {/* Table View */}
      {viewMode === 'table' && (
        <Card className="rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4 text-left">
                    <Checkbox checked={leads.length > 0 && selectedLeads.length === leads.length} onCheckedChange={toggleSelectAll} />
                  </th>
                  {visibleColumns.map(col => (
                    <th key={col.id} className="p-4 text-left text-sm font-medium text-muted-foreground">{col.label}</th>
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
                    <tr key={lead.id} className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => onLeadClick(lead)}>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedLeads.includes(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                      </td>
                      {visibleColumns.map(col => (
                        <td key={col.id} className="p-4">
                          {col.id === 'tags' ? (
                            <div className="flex gap-1 flex-wrap">
                              {(lead.tags || []).slice(0, 3).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                              {(lead.tags || []).length > 3 && <Badge variant="outline" className="text-xs">+{lead.tags.length - 3}</Badge>}
                            </div>
                          ) : col.id === 'status' ? (
                            <Badge variant={lead.status === 'active' ? 'default' : 'secondary'}>{lead.status || 'active'}</Badge>
                          ) : col.id === 'campaigns' ? (
                            <Badge variant="outline">{(lead.campaigns || []).length} campaigns</Badge>
                          ) : col.id === 'createdAt' ? (
                            <span className="text-sm text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-sm">{lead[col.id] || '-'}</span>
                          )}
                        </td>
                      ))}
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onLeadClick(lead)}>View Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={async () => {
                              await authFetch(`${API_BASE}/leads/${lead.id}`, { method: 'DELETE' })
                              toast.success('Lead deleted')
                              fetchLeads(pagination.page)
                            }}>
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

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page === 1} onClick={() => fetchLeads(pagination.page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={pagination.page === pagination.totalPages} onClick={() => fetchLeads(pagination.page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Grid View — leads grouped by date as folder cards */}
      {viewMode === 'grid' && (
        <div className="space-y-6">
          {gridLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading all {pagination.total.toLocaleString()} leads...</p>
            </div>
          ) : allGridLeads.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="p-8 text-center text-muted-foreground">
                No leads found. Import some leads to get started.
              </CardContent>
            </Card>
          ) : expandedDate ? (
            /* ── Expanded date group: full list with individual operations ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setExpandedDate(null)}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FolderOpen className="w-5 h-5" />
                      {expandedDate}
                    </h2>
                    <p className="text-sm text-muted-foreground">{(groupedLeads[expandedDate] || []).length} leads</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExportGroup(groupedLeads[expandedDate] || [])}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Group
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    setSelectedLeads((groupedLeads[expandedDate] || []).map(l => l.id))
                    setBulkCampaignOpen(true)
                  }}>
                    <Target className="w-4 h-4 mr-2" />
                    Add All to Campaign
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    setSelectedLeads((groupedLeads[expandedDate] || []).map(l => l.id))
                    setBulkTagOpen(true)
                  }}>
                    <Tag className="w-4 h-4 mr-2" />
                    Tag All
                  </Button>
                </div>
              </div>

              <Card className="rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left w-10">
                          <Checkbox
                            checked={(groupedLeads[expandedDate] || []).length > 0 && (groupedLeads[expandedDate] || []).every(l => selectedLeads.includes(l.id))}
                            onCheckedChange={() => {
                              const ids = (groupedLeads[expandedDate] || []).map(l => l.id)
                              const allSelected = ids.every(id => selectedLeads.includes(id))
                              if (allSelected) {
                                setSelectedLeads(prev => prev.filter(id => !ids.includes(id)))
                              } else {
                                setSelectedLeads(prev => [...new Set([...prev, ...ids])])
                              }
                            }}
                          />
                        </th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Email</th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Company</th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Phone</th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Tags</th>
                        <th className="p-3 text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {(groupedLeads[expandedDate] || []).map(lead => (
                        <tr key={lead.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <Checkbox checked={selectedLeads.includes(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} />
                          </td>
                          <td className="p-3 text-sm cursor-pointer hover:underline" onClick={() => onLeadClick(lead)}>{lead.email}</td>
                          <td className="p-3 text-sm">{lead.firstName || lead.lastName ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : '-'}</td>
                          <td className="p-3 text-sm">{lead.company || '-'}</td>
                          <td className="p-3 text-sm">{lead.phone || '-'}</td>
                          <td className="p-3">
                            <Badge variant={lead.status === 'active' ? 'default' : 'secondary'}>{lead.status || 'active'}</Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1 flex-wrap">
                              {(lead.tags || []).slice(0, 2).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                              {(lead.tags || []).length > 2 && <Badge variant="outline" className="text-xs">+{lead.tags.length - 2}</Badge>}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onLeadClick(lead)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport([lead.id])}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Export Lead
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={async () => {
                                  await authFetch(`${API_BASE}/leads/${lead.id}`, { method: 'DELETE' })
                                  toast.success('Lead deleted')
                                  setAllGridLeads(prev => prev.filter(l => l.id !== lead.id))
                                }}>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : (
            /* ── Folder grid: date-grouped cards ── */
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {allGridLeads.length.toLocaleString()} leads across {Object.keys(groupedLeads).length} date group{Object.keys(groupedLeads).length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Object.entries(groupedLeads)
                  .sort(([a], [b]) => new Date(b) - new Date(a))
                  .map(([date, groupLeads]) => {
                    const activeCount = groupLeads.filter(l => l.status === 'active').length
                    const companies = [...new Set(groupLeads.map(l => l.company).filter(Boolean))]

                    return (
                      <Card
                        key={date}
                        className="rounded-2xl hover:border-primary/40 transition-all group cursor-pointer"
                        onClick={() => setExpandedDate(date)}
                      >
                        <CardContent className="p-0">
                          {/* Folder header */}
                          <div className="p-4 pb-3 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                <FolderOpen className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm leading-tight">{date}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{groupLeads.length} lead{groupLeads.length !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleExportGroup(groupLeads)}
                                title="Export this group"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setExpandedDate(date)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Open Group
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleExportGroup(groupLeads)}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Export Group
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedLeads(prev => [...new Set([...prev, ...groupLeads.map(l => l.id)])])
                                    setBulkCampaignOpen(true)
                                  }}>
                                    <Target className="w-4 h-4 mr-2" />
                                    Add to Campaign
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedLeads(prev => [...new Set([...prev, ...groupLeads.map(l => l.id)])])
                                    setBulkTagOpen(true)
                                  }}>
                                    <Tag className="w-4 h-4 mr-2" />
                                    Add Tag
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                            <Badge variant="default" className="text-xs">{activeCount} active</Badge>
                            {groupLeads.length - activeCount > 0 && (
                              <Badge variant="secondary" className="text-xs">{groupLeads.length - activeCount} other</Badge>
                            )}
                          </div>

                          {/* Lead preview list */}
                          <div className="border-t border-border">
                            {groupLeads.slice(0, 3).map((lead, idx) => (
                              <div
                                key={lead.id}
                                className={`px-4 py-2 flex items-center gap-3 text-sm ${idx < Math.min(groupLeads.length, 3) - 1 ? 'border-b border-border/50' : ''}`}
                              >
                                <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-medium flex-shrink-0">
                                  {(lead.firstName || lead.email || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate font-medium text-xs">
                                    {lead.firstName || lead.lastName ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : lead.email}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">{lead.company || lead.email}</p>
                                </div>
                              </div>
                            ))}
                            {groupLeads.length > 3 && (
                              <div className="px-4 py-2 text-center border-t border-border/50">
                                <span className="text-xs text-primary font-medium">View all {groupLeads.length} leads →</span>
                              </div>
                            )}
                          </div>

                          {/* Companies footer */}
                          {companies.length > 0 && (
                            <div className="px-4 py-2 border-t border-border bg-muted/20">
                              <div className="flex items-center gap-1 flex-wrap">
                                <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {companies.slice(0, 3).join(', ')}{companies.length > 3 ? ` +${companies.length - 3}` : ''}
                                </span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Lead Detail Page
function LeadDetailPage({ lead, onBack, onUpdate, campaigns, allTags }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState(lead)
  const [activities, setActivities] = useState([])
  const [newTag, setNewTag] = useState('')
  const [newCustomField, setNewCustomField] = useState({ name: '', value: '' })
  const [customFieldOpen, setCustomFieldOpen] = useState(false)
  const [addCampaignOpen, setAddCampaignOpen] = useState(false)

  useEffect(() => {
    fetchActivities()
  }, [lead.id])

  const fetchActivities = async () => {
    try {
      const res = await authFetch(`${API_BASE}/leads/${lead.id}/activity`)
      const data = await res.json()
      setActivities(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    }
  }

  const handleSave = async () => {
    try {
      const res = await authFetch(`${API_BASE}/leads/${lead.id}`, {
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

  const handleAddTag = async () => {
    if (!newTag) return
    const updatedTags = [...(formData.tags || []), newTag]
    try {
      const res = await authFetch(`${API_BASE}/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags })
      })
      const updated = await res.json()
      onUpdate(updated)
      setFormData(updated)
      setNewTag('')
      toast.success('Tag added')
    } catch (error) {
      toast.error('Failed to add tag')
    }
  }

  const handleRemoveTag = async (tagToRemove) => {
    const updatedTags = (formData.tags || []).filter(t => t !== tagToRemove)
    try {
      const res = await authFetch(`${API_BASE}/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags })
      })
      const updated = await res.json()
      onUpdate(updated)
      setFormData(updated)
      toast.success('Tag removed')
    } catch (error) {
      toast.error('Failed to remove tag')
    }
  }

  const handleAddToCampaign = async (campaignId) => {
    const updatedCampaigns = [...(formData.campaigns || []), campaignId]
    try {
      const res = await authFetch(`${API_BASE}/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaigns: updatedCampaigns })
      })
      const updated = await res.json()
      onUpdate(updated)
      setFormData(updated)
      setAddCampaignOpen(false)
      toast.success('Added to campaign')
    } catch (error) {
      toast.error('Failed to add to campaign')
    }
  }

  const handleRemoveFromCampaign = async (campaignId) => {
    const updatedCampaigns = (formData.campaigns || []).filter(c => c !== campaignId)
    try {
      const res = await authFetch(`${API_BASE}/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaigns: updatedCampaigns })
      })
      const updated = await res.json()
      onUpdate(updated)
      setFormData(updated)
      toast.success('Removed from campaign')
    } catch (error) {
      toast.error('Failed to remove from campaign')
    }
  }

  const handleAddCustomField = async () => {
    if (!newCustomField.name || !newCustomField.value) return
    const updatedFields = { ...formData.customFields, [newCustomField.name]: newCustomField.value }
    try {
      const res = await authFetch(`${API_BASE}/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customFields: updatedFields })
      })
      const updated = await res.json()
      onUpdate(updated)
      setFormData(updated)
      setNewCustomField({ name: '', value: '' })
      setCustomFieldOpen(false)
      toast.success('Custom field added')
    } catch (error) {
      toast.error('Failed to add custom field')
    }
  }

  const leadCampaigns = campaigns.filter(c => (formData.campaigns || []).includes(c.id))
  const availableCampaigns = campaigns.filter(c => !(formData.campaigns || []).includes(c.id))

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="-ml-2">
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back to Leads
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Mail className="w-6 h-6" />
            {lead.email}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            {lead.firstName && <span>{lead.firstName} {lead.lastName}</span>}
            {lead.company && <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{lead.company}</span>}
            {lead.domain && <span className="flex items-center gap-1"><Globe className="w-4 h-4" />{lead.domain}</span>}
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {(formData.tags || []).map((tag, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-6">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Tag
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2">
                  <Label>New Tag</Label>
                  <div className="flex gap-2">
                    <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Tag name" />
                    <Button size="sm" onClick={handleAddTag}>Add</Button>
                  </div>
                  {allTags.length > 0 && (
                    <div className="pt-2">
                      <Label className="text-xs text-muted-foreground">Existing Tags</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {allTags.filter(t => !(formData.tags || []).includes(t)).slice(0, 10).map(tag => (
                          <Badge key={tag} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => { setNewTag(tag); }}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns ({leadCampaigns.length})</TabsTrigger>
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
                    {editing ? <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="mt-1" /> : <p className="font-medium">{lead.email}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">First Name</Label>
                    {editing ? <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="mt-1" /> : <p className="font-medium">{lead.firstName || '-'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Name</Label>
                    {editing ? <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="mt-1" /> : <p className="font-medium">{lead.lastName || '-'}</p>}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Company</Label>
                    {editing ? <Input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="mt-1" /> : <p className="font-medium">{lead.company || '-'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Domain</Label>
                    {editing ? <Input value={formData.domain} onChange={(e) => setFormData({ ...formData, domain: e.target.value })} className="mt-1" /> : <p className="font-medium">{lead.domain || '-'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    {editing ? <Input value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="mt-1" placeholder="+1 555-0100" /> : <p className="font-medium">{lead.phone || '-'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">LinkedIn URL</Label>
                    {editing ? <Input value={formData.linkedinUrl || ''} onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })} className="mt-1" placeholder="https://linkedin.com/in/..." /> : <p className="font-medium">{lead.linkedinUrl ? <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{lead.linkedinUrl}</a> : '-'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Source</Label>
                    {editing ? <Input value={formData.source || ''} onChange={(e) => setFormData({ ...formData, source: e.target.value })} className="mt-1" placeholder="e.g., Website, LinkedIn, CSV Import" /> : <p className="font-medium">{lead.source || '-'}</p>}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    {editing ? (
                      <Select value={formData.status || 'active'} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="bounced">Bounced</SelectItem>
                          <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : <Badge variant={lead.status === 'active' ? 'default' : 'secondary'} className="mt-1">{lead.status || 'active'}</Badge>}
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Associated Campaigns</CardTitle>
              <Dialog open={addCampaignOpen} onOpenChange={setAddCampaignOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" />Add to Campaign</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add to Campaign</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 py-4">
                    {availableCampaigns.length === 0 ? (
                      <p className="text-muted-foreground">No available campaigns</p>
                    ) : (
                      availableCampaigns.map(campaign => (
                        <button key={campaign.id} onClick={() => handleAddToCampaign(campaign.id)} className="w-full p-4 rounded-xl border border-border hover:bg-accent transition-colors text-left">
                          <div className="font-medium">{campaign.name}</div>
                          <div className="text-sm text-muted-foreground">{campaign.description}</div>
                        </button>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
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
                      <div className="flex items-center gap-2">
                        <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>{campaign.status}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveFromCampaign(campaign.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-6">
                    {activities.map((activity) => (
                      <div key={activity.id} className="relative flex gap-4 pl-10">
                        <div className="absolute left-2 w-4 h-4 rounded-full bg-accent border-2 border-background" />
                        <div>
                          <div className="font-medium text-sm">{activity.action}</div>
                          <div className="text-xs text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</div>
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
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Field</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Custom Field</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Field Name</Label>
                      <Input value={newCustomField.name} onChange={(e) => setNewCustomField({ ...newCustomField, name: e.target.value })} placeholder="e.g., LinkedIn URL" />
                    </div>
                    <div className="space-y-2">
                      <Label>Field Value</Label>
                      <Input value={newCustomField.value} onChange={(e) => setNewCustomField({ ...newCustomField, value: e.target.value })} placeholder="e.g., https://linkedin.com/in/..." />
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
              {Object.keys(formData.customFields || {}).length === 0 ? (
                <p className="text-muted-foreground">No custom fields added yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(formData.customFields || {}).map(([key, value]) => (
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

// Lists Page
function ListsPage({ lists, fetchLists, onListClick, setNewListOpen, campaigns, allTags }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lists</h1>
          <p className="text-muted-foreground">Create and manage lead lists based on filters</p>
        </div>
        <Button onClick={() => setNewListOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create List
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists.length === 0 ? (
          <Card className="rounded-2xl col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              No lists created yet. Create a list to organize your leads.
            </CardContent>
          </Card>
        ) : (
          (lists || []).map(list => (
            <Card key={list.id} className="rounded-2xl cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => onListClick(list)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="w-5 h-5" />
                  {list.name}
                </CardTitle>
                {list.description && <CardDescription>{list.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{list.leadsCount || 0} leads</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(list.createdAt).toLocaleDateString()}</span>
                </div>
                {list.filters && (
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {list.filters.dateFrom && <Badge variant="secondary" className="text-xs">From: {list.filters.dateFrom}</Badge>}
                    {list.filters.dateTo && <Badge variant="secondary" className="text-xs">To: {list.filters.dateTo}</Badge>}
                    {list.filters.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

// List Detail Page
function ListDetailPage({ list, onBack, campaigns, allTags, onExport }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLeads, setSelectedLeads] = useState([])

  useEffect(() => {
    fetchListLeads()
  }, [list.id])

  const fetchListLeads = async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_BASE}/leads?listId=${list.id}&limit=100`)
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (error) {
      console.error('Failed to fetch list leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this list?')) return
    try {
      await authFetch(`${API_BASE}/lists/${list.id}`, { method: 'DELETE' })
      toast.success('List deleted')
      onBack()
    } catch (error) {
      toast.error('Failed to delete list')
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="-ml-2">
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back to Lists
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <List className="w-6 h-6" />
            {list.name}
          </h1>
          {list.description && <p className="text-muted-foreground mt-1">{list.description}</p>}
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline">{leads.length} leads</Badge>
            {list.filters?.dateFrom && <Badge variant="secondary">From: {list.filters.dateFrom}</Badge>}
            {list.filters?.dateTo && <Badge variant="secondary">To: {list.filters.dateTo}</Badge>}
            {list.filters?.tags?.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            const params = new URLSearchParams()
            if (list.filters?.dateFrom) params.set('dateFrom', list.filters.dateFrom)
            if (list.filters?.dateTo) params.set('dateTo', list.filters.dateTo)
            if (list.filters?.tags?.length) params.set('tag', list.filters.tags[0])
            window.open(`${API_BASE}/leads/export?${params}`, '_blank')
          }}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete List
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Email</th>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Name</th>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Company</th>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Tags</th>
              <th className="p-4 text-left text-sm font-medium text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No leads match this list's filters.</td></tr>
            ) : (
              leads.map(lead => (
                <tr key={lead.id} className="border-t border-border">
                  <td className="p-4 text-sm">{lead.email}</td>
                  <td className="p-4 text-sm">{lead.firstName} {lead.lastName}</td>
                  <td className="p-4 text-sm">{lead.company || '-'}</td>
                  <td className="p-4">
                    <div className="flex gap-1 flex-wrap">
                      {(lead.tags || []).slice(0, 2).map((tag, i) => <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>)}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// Campaigns Page
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
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No campaigns yet. Create your first campaign.</td></tr>
            ) : (
              campaigns.map(campaign => (
                <tr key={campaign.id} className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => onCampaignClick(campaign)}>
                  <td className="p-4">
                    <div className="font-medium">{campaign.name}</div>
                    {campaign.description && <div className="text-sm text-muted-foreground truncate max-w-xs">{campaign.description}</div>}
                  </td>
                  <td className="p-4"><Badge variant="outline">{campaign.leadsCount || 0}</Badge></td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(campaign.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-sm">{campaign.owner}</td>
                  <td className="p-4"><Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>{campaign.status}</Badge></td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onCampaignClick(campaign)}>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`${API_BASE}/campaigns/${campaign.id}/export`, '_blank')}>
                          <Download className="w-4 h-4 mr-2" />
                          Export Leads
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={async () => {
                          await authFetch(`${API_BASE}/campaigns/${campaign.id}`, { method: 'DELETE' })
                          toast.success('Campaign deleted')
                          fetchCampaigns()
                        }}>Delete</DropdownMenuItem>
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

// Campaign Detail Page
function CampaignDetailPage({ campaign, onBack, onAddLeads, onExport }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('leads')
  const [enrichmentInfo, setEnrichmentInfo] = useState({ fields: [], stats: { totalLeads: 0, enrichedLeads: 0, pendingLeads: 0, partialLeads: 0, failedLeads: 0 }, templates: [] })
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportColumns, setExportColumns] = useState([])
  const [exportOnlyEnriched, setExportOnlyEnriched] = useState(false)
  const [enrichModalOpen, setEnrichModalOpen] = useState(false)
  const [enrichFile, setEnrichFile] = useState(null)
  const [enriching, setEnriching] = useState(false)
  const enrichFileRef = useRef(null)

  useEffect(() => {
    fetchCampaignLeads()
    fetchEnrichmentInfo()
  }, [campaign.id])

  const fetchCampaignLeads = async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_BASE}/leads?campaignId=${campaign.id}&limit=100`)
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (error) {
      console.error('Failed to fetch campaign leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEnrichmentInfo = async () => {
    try {
      const res = await authFetch(`${API_BASE}/campaigns/${campaign.id}/fields`)
      const data = await res.json()
      if (data && !data.error && data.fields) {
        setEnrichmentInfo(data)
        setExportColumns(data.fields || [])
      }
    } catch (error) {
      console.error('Failed to fetch enrichment info:', error)
    }
  }

  const handleExportWithColumns = () => {
    const params = new URLSearchParams()
    if (exportColumns.length > 0) params.set('columns', exportColumns.join(','))
    if (exportOnlyEnriched) params.set('onlyEnriched', 'true')
    params.set('useCampaignFields', 'true')
    window.open(`${API_BASE}/campaigns/${campaign.id}/export?${params}`, '_blank')
    setExportModalOpen(false)
    toast.success('Export started')
  }

  const toggleExportColumn = (field) => {
    setExportColumns(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field])
  }

  const handleEnrichUpload = async () => {
    if (!enrichFile) return
    setEnriching(true)
    try {
      const enrichLeads = await new Promise((resolve, reject) => {
        Papa.parse(enrichFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const mapped = results.data
              .filter(row => Object.values(row).some(v => v))
              .map(row => {
                const email = row.email || row.Email || row['email address'] || row['Email Address'] || ''
                const customFields = {}
                Object.entries(row).forEach(([key, value]) => {
                  const lower = key.toLowerCase().trim()
                  if (lower !== 'email' && lower !== 'email address' && value) {
                    customFields[key] = value
                  }
                })
                return { email, customFields }
              })
              .filter(l => l.email)
            resolve(mapped)
          },
          error: reject
        })
      })

      const res = await authFetch(`${API_BASE}/campaigns/${campaign.id}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: enrichLeads, source: 'csv_import' })
      })
      const result = await res.json()
      toast.success(`Enriched ${result.enriched} leads (${result.notFound} not found)`)
      setEnrichModalOpen(false)
      setEnrichFile(null)
      fetchCampaignLeads()
      fetchEnrichmentInfo()
    } catch (error) {
      toast.error('Enrichment failed: ' + error.message)
    } finally {
      setEnriching(false)
    }
  }

  const { stats } = enrichmentInfo
  const enrichmentPercent = stats.totalLeads > 0 ? Math.round((stats.enrichedLeads / stats.totalLeads) * 100) : 0

  const enrichmentStatusColor = (status) => {
    switch (status) {
      case 'enriched': return 'default'
      case 'pending': return 'secondary'
      case 'partial': return 'outline'
      case 'failed': return 'destructive'
      default: return 'secondary'
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="-ml-2">
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back to Campaigns
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Target className="w-6 h-6" />
            {campaign.name}
          </h1>
          {campaign.description && <p className="text-muted-foreground mt-1">{campaign.description}</p>}
          <div className="flex items-center gap-4 mt-3">
            <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>{campaign.status}</Badge>
            <span className="text-sm text-muted-foreground">Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEnrichModalOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Enrich Campaign
          </Button>
          <Button variant="outline" onClick={() => setExportModalOpen(true)}>
            <Download className="w-4 h-4 mr-2" />
            Export Leads
          </Button>
          <Button onClick={onAddLeads}>
            <Plus className="w-4 h-4 mr-2" />
            Add Leads
          </Button>
        </div>
      </div>

      {/* Enrichment Stats */}
      {stats.totalLeads > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="rounded-2xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.totalLeads}</p>
              <p className="text-xs text-muted-foreground">Total Leads</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-green-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.enrichedLeads}</p>
              <p className="text-xs text-muted-foreground">Enriched</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-yellow-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingLeads}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-blue-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.partialLeads}</p>
              <p className="text-xs text-muted-foreground">Partial</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-red-500/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.failedLeads}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Enrichment fields summary */}
      {enrichmentInfo.fields.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Enrichment Fields:</span>
              <span className="text-sm text-muted-foreground">({enrichmentInfo.fields.length} fields)</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {enrichmentInfo.fields.map(f => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Enrichment</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Added</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No leads in this campaign yet.</td></tr>
                ) : (
                  leads.map(lead => (
                    <tr key={lead.id} className="border-t border-border">
                      <td className="p-4 text-sm">{lead.email}</td>
                      <td className="p-4 text-sm">{lead.firstName} {lead.lastName}</td>
                      <td className="p-4 text-sm">{lead.company || '-'}</td>
                      <td className="p-4">
                        <Badge variant={enrichmentStatusColor(lead.enrichmentStatus || 'pending')}>
                          {lead.enrichmentStatus || 'pending'}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</td>
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

      {/* Export Modal with Column Selection */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Export Campaign Leads</DialogTitle>
            <DialogDescription>Select which columns to include in the CSV export.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="onlyEnriched"
                checked={exportOnlyEnriched}
                onCheckedChange={setExportOnlyEnriched}
              />
              <Label htmlFor="onlyEnriched">Only export enriched leads</Label>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium mb-2 block">Base Fields (always included)</Label>
              <div className="flex flex-wrap gap-1">
                {['email', 'first_name', 'last_name', 'company', 'domain', 'phone', 'status'].map(f => (
                  <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                ))}
              </div>
            </div>

            {enrichmentInfo.fields.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Enrichment Fields (click to toggle)</Label>
                <div className="flex flex-wrap gap-1">
                  {enrichmentInfo.fields.map(f => (
                    <Badge
                      key={f}
                      variant={exportColumns.includes(f) ? 'default' : 'outline'}
                      className="text-xs cursor-pointer"
                      onClick={() => toggleExportColumn(f)}
                    >
                      {f}
                      {exportColumns.includes(f) && <Check className="w-3 h-3 ml-1" />}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setExportColumns(enrichmentInfo.fields)}>Select All</Button>
              <Button variant="outline" size="sm" onClick={() => setExportColumns([])}>Deselect All</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancel</Button>
            <Button onClick={handleExportWithColumns}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrich Campaign Modal */}
      <Dialog open={enrichModalOpen} onOpenChange={setEnrichModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enrich Campaign Leads</DialogTitle>
            <DialogDescription>
              Upload a CSV with an email column and additional data columns. Only leads already in this campaign will be enriched.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-muted-foreground transition-colors"
              onClick={() => enrichFileRef.current?.click()}
            >
              <input ref={enrichFileRef} type="file" accept=".csv" onChange={(e) => setEnrichFile(e.target.files?.[0] || null)} className="hidden" />
              <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              {enrichFile ? (
                <p className="font-medium">{enrichFile.name} <span className="text-muted-foreground text-sm">({(enrichFile.size / 1024).toFixed(1)} KB)</span></p>
              ) : (
                <p className="text-muted-foreground">Drop CSV file or click to select</p>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">CSV format:</p>
              <p>Must include an <code className="bg-muted px-1 rounded">email</code> column. All other columns become enrichment fields.</p>
              <p className="mt-1">Example: email, Title, Industry, Revenue</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEnrichModalOpen(false); setEnrichFile(null) }}>Cancel</Button>
            <Button onClick={handleEnrichUpload} disabled={!enrichFile || enriching}>
              {enriching && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enrich Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Import Center Page — supports 500K+ leads via chunked client uploads
function ImportCenterPage({ onImportComplete, campaigns = [] }) {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [csvData, setCsvData] = useState([])        // preview rows only
  const [totalRowCount, setTotalRowCount] = useState(0)
  const [csvHeaders, setCsvHeaders] = useState([])
  const [columnMapping, setColumnMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [progress, setProgress] = useState({ percent: 0, sent: 0, total: 0, inserted: 0, updated: 0, skipped: 0, errors: 0, currentChunk: 0, totalChunks: 0, speed: 0, eta: '' })
  const [selectedCampaignId, setSelectedCampaignId] = useState('none')
  const fileInputRef = useRef(null)
  const abortRef = useRef(false)

  const CLIENT_CHUNK_SIZE = 500  // rows per API request (kept small for Next.js body limit)

  const fieldOptions = [
    { value: 'email', label: 'Email' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'company', label: 'Company' },
    { value: 'domain', label: 'Domain' },
    { value: 'phone', label: 'Phone' },
    { value: 'linkedinUrl', label: 'LinkedIn URL' },
    { value: 'source', label: 'Source' },
    { value: 'status', label: 'Status' },
    { value: 'custom', label: 'Custom Field' },
    { value: 'skip', label: 'Skip' }
  ]

  // Step 1 → parse preview (20 rows) + count total rows fast
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)

    // First pass: quick preview (20 rows for display)
    Papa.parse(selectedFile, {
      header: true,
      preview: 20,
      complete: (results) => {
        setCsvHeaders(results.meta.fields || [])
        setCsvData(results.data.filter(row => Object.values(row).some(v => v)))

        const autoMapping = {}
        results.meta.fields?.forEach(header => {
          const lower = header.toLowerCase().trim()
          if (lower === 'email' || lower === 'old email' || lower.includes('email')) autoMapping[header] = 'email'
          else if (lower === 'first name' || lower === 'firstname' || (lower.includes('first') && lower.includes('name'))) autoMapping[header] = 'firstName'
          else if (lower === 'last name' || lower === 'lastname' || (lower.includes('last') && lower.includes('name'))) autoMapping[header] = 'lastName'
          else if (lower === 'company' || lower === 'company name') autoMapping[header] = 'company'
          else if (lower === 'domain' || lower === 'website') autoMapping[header] = 'domain'
          else if (lower === 'phone' || lower === 'company phone' || lower.includes('telephone')) autoMapping[header] = 'phone'
          else if (lower === 'person linkedin url' || lower === 'linkedin url' || lower === 'linkedin') autoMapping[header] = 'linkedinUrl'
          else if (lower === 'source' || lower.includes('lead source')) autoMapping[header] = 'source'
          else if (lower === 'status') autoMapping[header] = 'status'
          else autoMapping[header] = 'custom'
        })
        setColumnMapping(autoMapping)

        // Second pass: count total rows (fast, no data storage)
        let count = 0
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          step: () => { count++ },
          complete: () => { setTotalRowCount(count); setStep(2) }
        })
      },
      error: (error) => {
        toast.error('Failed to parse CSV file')
        console.error(error)
      }
    })
  }

  const mapRowToLead = (row) => {
    const lead = { customFields: {} }
    Object.entries(columnMapping).forEach(([csvColumn, field]) => {
      if (field === 'skip') return
      if (field === 'custom') {
        if (row[csvColumn]) lead.customFields[csvColumn] = row[csvColumn]
      } else {
        lead[field] = row[csvColumn]
      }
    })
    return lead
  }

  // Chunked upload: parse full file → send 5000 rows at a time → update progress
  const handleImport = async () => {
    setImporting(true)
    abortRef.current = false
    setStep(3)

    const totals = { imported: 0, updated: 0, skipped: 0, errors: 0, total: 0 }
    const startTime = Date.now()

    try {
      // Parse FULL file into memory-efficient chunks
      const allLeads = await new Promise((resolve, reject) => {
        const mapped = []
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            results.data.forEach(row => {
              if (!Object.values(row).some(v => v)) return
              const lead = mapRowToLead(row)
              if (lead.email) mapped.push(lead)
            })
            resolve(mapped)
          },
          error: reject
        })
      })

      const totalLeads = allLeads.length
      const totalChunks = Math.ceil(totalLeads / CLIENT_CHUNK_SIZE)

      setProgress(p => ({ ...p, total: totalLeads, totalChunks }))

      for (let i = 0; i < totalLeads; i += CLIENT_CHUNK_SIZE) {
        if (abortRef.current) break

        const chunkIndex = Math.floor(i / CLIENT_CHUNK_SIZE) + 1
        const chunk = allLeads.slice(i, i + CLIENT_CHUNK_SIZE)

        const res = await authFetch(`${API_BASE}/leads/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: chunk, fileName: file?.name || 'csv-import', ...(selectedCampaignId && selectedCampaignId !== 'none' && { campaignId: selectedCampaignId, enrichmentSource: 'csv_import' }) })
        })

        const result = await res.json()

        totals.imported += result.imported || 0
        totals.updated += result.updated || 0
        totals.skipped += result.skipped || 0
        totals.errors += result.errors || 0
        totals.total += result.total || chunk.length

        const sent = Math.min(i + CLIENT_CHUNK_SIZE, totalLeads)
        const percent = Math.round((sent / totalLeads) * 100)
        const elapsed = (Date.now() - startTime) / 1000
        const speed = Math.round(sent / elapsed)
        const remaining = totalLeads - sent
        const etaSec = speed > 0 ? Math.round(remaining / speed) : 0
        const eta = etaSec > 60 ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s` : `${etaSec}s`

        setProgress({
          percent,
          sent,
          total: totalLeads,
          inserted: totals.imported,
          updated: totals.updated,
          skipped: totals.skipped,
          errors: totals.errors,
          currentChunk: chunkIndex,
          totalChunks,
          speed,
          eta: percent >= 100 ? 'Done' : `~${eta} remaining`
        })
      }

      setImportResult(totals)
      setStep(4)
      onImportComplete()
      toast.success(`Imported ${totals.imported.toLocaleString()} leads`)
    } catch (error) {
      toast.error('Import failed: ' + error.message)
      console.error(error)
      setImportResult(totals.total > 0 ? totals : null)
      if (totals.total > 0) setStep(4)
      else setStep(2)
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
    setTotalRowCount(0)
    setSelectedCampaignId('none')
    setProgress({ percent: 0, sent: 0, total: 0, inserted: 0, updated: 0, skipped: 0, errors: 0, currentChunk: 0, totalChunks: 0, speed: 0, eta: '' })
    abortRef.current = false
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import Center</h1>
        <p className="text-muted-foreground">Import leads from CSV files — supports 500K+ rows</p>
      </div>

      <div className="flex items-center gap-4">
        {['Upload', 'Map Columns', 'Import', 'Complete'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step > i + 1 ? 'bg-primary text-primary-foreground' : step === i + 1 ? 'bg-accent text-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {step > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm hidden sm:inline ${step >= i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            {i < 3 && <div className={`w-8 h-px ${step > i + 1 ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

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
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Drop your CSV file here</h3>
              <p className="text-muted-foreground mb-4">or click to browse — supports up to 500K+ rows</p>
              <Button variant="outline">Select CSV File</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {/* File info banner */}
          <Card className="rounded-2xl border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-4">
              <FileSpreadsheet className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">{totalRowCount.toLocaleString()} rows detected &middot; {(file?.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-1">{totalRowCount.toLocaleString()} leads</Badge>
            </CardContent>
          </Card>

          {/* Campaign selector for enrichment */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Assign to Campaign (Optional)
              </CardTitle>
              <CardDescription>Link imported leads and their custom fields to a campaign. Enrichment data will be campaign-specific.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="No campaign — import as global leads" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Campaign</SelectItem>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.leadsCount || 0} leads)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCampaignId && selectedCampaignId !== 'none' && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Custom fields will be stored as campaign-specific enrichment data. Enrichment status will be tracked.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Map Columns</CardTitle>
              <CardDescription>Match your CSV columns to lead fields. Unmapped columns become custom fields.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {csvHeaders.map(header => (
                  <div key={header} className="flex items-center gap-4">
                    <div className="w-48 text-sm font-medium truncate" title={header}>{header}</div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Select value={columnMapping[header] || 'skip'} onValueChange={(value) => setColumnMapping({ ...columnMapping, [header]: value })}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {fieldOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Preview (First 20 rows)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {csvHeaders.map(h => <th key={h} className="p-2 text-left font-medium text-muted-foreground">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        {csvHeaders.map(h => <td key={h} className="p-2 truncate max-w-xs">{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4 items-center flex-wrap">
            <Button variant="outline" onClick={resetImport}>Back</Button>
            <Button onClick={handleImport} disabled={!Object.values(columnMapping).includes('email')} className="min-w-[200px]">
              <Upload className="w-4 h-4 mr-2" />
              Import {totalRowCount.toLocaleString()} Leads
              {selectedCampaignId && selectedCampaignId !== 'none' && ' + Enrich'}
            </Button>
            <span className="text-sm text-muted-foreground">
              Will upload in {Math.ceil(totalRowCount / CLIENT_CHUNK_SIZE)} batches of {CLIENT_CHUNK_SIZE.toLocaleString()}
              {selectedCampaignId && selectedCampaignId !== 'none' && ` → ${campaigns.find(c => c.id === selectedCampaignId)?.name || 'Campaign'}`}
            </span>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardContent className="p-8">
              {/* Percentage circle */}
              <div className="flex flex-col items-center mb-8">
                <div className="relative w-40 h-40">
                  <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                    <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="8" className="text-primary"
                      strokeDasharray={2 * Math.PI * 70}
                      strokeDashoffset={2 * Math.PI * 70 * (1 - progress.percent / 100)}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold">{progress.percent}%</span>
                    <span className="text-xs text-muted-foreground">{progress.eta}</span>
                  </div>
                </div>
              </div>

              {/* Linear progress bar */}
              <div className="w-full bg-muted rounded-full h-3 mb-4 overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${progress.percent}%` }} />
              </div>

              <div className="text-center mb-6">
                <p className="text-lg font-medium">
                  {progress.sent.toLocaleString()} / {progress.total.toLocaleString()} leads processed
                </p>
                <p className="text-sm text-muted-foreground">
                  Batch {progress.currentChunk} of {progress.totalChunks} &middot; {progress.speed.toLocaleString()} leads/sec
                </p>
              </div>

              {/* Live stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                  <p className="text-xl font-bold text-green-600">{progress.inserted.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Inserted</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <p className="text-xl font-bold text-blue-600">{progress.updated.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </div>
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                  <p className="text-xl font-bold text-yellow-600">{progress.skipped.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Duplicates</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                  <p className="text-xl font-bold text-red-600">{progress.errors.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <Button variant="destructive" size="sm" onClick={() => { abortRef.current = true }}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 4 && importResult && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Import Complete!</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-2xl font-bold text-green-600">{importResult.imported.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">New Inserted</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-2xl font-bold text-blue-600">{(importResult.updated || 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Updated</p>
              </div>
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-2xl font-bold text-yellow-600">{importResult.skipped.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Duplicates Skipped</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-2xl font-bold text-red-600">{(importResult.errors || 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
            <p className="text-muted-foreground mb-6">Total processed: {importResult.total.toLocaleString()}</p>
            <Button onClick={resetImport}>Import More</Button>
          </CardContent>
        </Card>
      )}

      <ImportLogsSection />
    </div>
  )
}

// Import Logs Section
function ImportLogsSection() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const res = await authFetch(`${API_BASE}/import-logs`)
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch import logs:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return null
  if (logs.length === 0) return null

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Import History
        </CardTitle>
        <CardDescription>Recent CSV import results</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium text-muted-foreground">File</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Total Rows</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Inserted</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Updated</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Duplicates</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Errors</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-t border-border">
                  <td className="p-3 font-medium">{log.file_name || '-'}</td>
                  <td className="p-3">{log.total_rows}</td>
                  <td className="p-3"><span className="text-green-600 font-medium">{log.inserted_count}</span></td>
                  <td className="p-3"><span className="text-blue-600 font-medium">{log.updated_count}</span></td>
                  <td className="p-3"><span className="text-yellow-600 font-medium">{log.duplicate_count}</span></td>
                  <td className="p-3"><span className="text-red-600 font-medium">{log.error_count}</span></td>
                  <td className="p-3 text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// Team Page (Admin only)
function TeamPage({ authUser }) {
  const [users, setUsers] = useState([])
  const [userStats, setUserStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' })
  const [addLoading, setAddLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('members')

  const fetchUsers = async () => {
    try {
      const res = await authFetch(`${API_BASE}/users`)
      if (res.ok) {
        const data = await res.json()
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch (err) { console.error('Failed to fetch users:', err) }
    finally { setLoading(false) }
  }

  const fetchStats = async () => {
    try {
      const res = await authFetch(`${API_BASE}/users/stats`)
      if (res.ok) {
        const data = await res.json()
        setUserStats(Array.isArray(data) ? data : [])
      }
    } catch (err) { console.error('Failed to fetch user stats:', err) }
  }

  useEffect(() => { fetchUsers(); fetchStats() }, [])

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('All fields are required'); return
    }
    setAddLoading(true)
    try {
      const res = await authFetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`User ${data.name} created`)
      setAddUserOpen(false)
      setNewUser({ name: '', email: '', password: '', role: 'user' })
      fetchUsers()
    } catch (err) {
      toast.error(err.message || 'Failed to create user')
    } finally { setAddLoading(false) }
  }

  const handleUpdateUser = async (userId, updates) => {
    try {
      const res = await authFetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('User updated')
      fetchUsers()
      setEditingUser(null)
    } catch (err) {
      toast.error(err.message || 'Failed to update user')
    }
  }

  const handleToggleSuspend = async (user) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active'
    await handleUpdateUser(user.id, { status: newStatus })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" />
            Team Management
          </h1>
          <p className="text-muted-foreground">Manage users, roles, and track extraction activity</p>
        </div>
        <Button onClick={() => setAddUserOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="members">Members ({users.length})</TabsTrigger>
          <TabsTrigger value="activity">Extraction Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          <Card className="rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Member</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Role</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Extractions</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Last Login</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Joined</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
                ) : users.map(user => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${user.status === 'suspended' ? 'bg-destructive/10 text-destructive' : 'bg-accent'}`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {user.name}
                            {user.id === authUser.id && <Badge variant="outline" className="text-[10px]">You</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="gap-1">
                        {user.role === 'admin' && <Shield className="w-3 h-3" />}
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm font-medium">{user.extractionCount || 0}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      {user.id !== authUser.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingUser(user)}>
                              <Settings className="w-4 h-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' })}>
                              <Shield className="w-4 h-4 mr-2" />
                              {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleToggleSuspend(user)}
                              className={user.status === 'active' ? 'text-destructive' : 'text-green-600'}
                            >
                              {user.status === 'active' ? (
                                <><Ban className="w-4 h-4 mr-2" />Suspend User</>
                              ) : (
                                <><UserCheck className="w-4 h-4 mr-2" />Reactivate User</>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userStats.length === 0 ? (
              <Card className="rounded-2xl col-span-full">
                <CardContent className="p-8 text-center text-muted-foreground">
                  No extraction stats yet.
                </CardContent>
              </Card>
            ) : userStats.map(stat => (
              <Card key={stat.id} className="rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-sm font-medium">
                      {stat.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="font-medium">{stat.name}</div>
                      <div className="text-xs text-muted-foreground">{stat.email}</div>
                    </div>
                    <Badge variant={stat.role === 'admin' ? 'default' : 'secondary'} className="ml-auto text-[10px]">{stat.role}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-lg bg-accent/50">
                      <p className="text-lg font-bold">{parseInt(stat.leads_extracted) || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Leads Extracted</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-accent/50">
                      <p className="text-lg font-bold">{parseInt(stat.total_actions) || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Total Actions</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-accent/50">
                      <p className="text-lg font-bold">{parseInt(stat.imports_done) || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Imports</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new team member account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@example.com" type="email" />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 6 characters" type="password" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={addLoading}>
              {addLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details for {editingUser?.name}</DialogDescription>
          </DialogHeader>
          {editingUser && <EditUserForm user={editingUser} onSave={handleUpdateUser} onCancel={() => setEditingUser(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditUserForm({ user, onSave, onCancel }) {
  const [form, setForm] = useState({ name: user.name, role: user.role, password: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    const updates = { name: form.name, role: form.role }
    if (form.password) updates.password = form.password
    await onSave(user.id, updates)
    setSaving(false)
  }

  return (
    <>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>New Password (leave blank to keep current)</Label>
          <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" placeholder="••••••" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </DialogFooter>
    </>
  )
}

// Settings Page
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
            <Button variant="outline" onClick={() => window.open(`${API_BASE}/leads/export`, '_blank')}>
              <Download className="w-4 h-4 mr-2" />
              Export All Leads
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Dialogs
function NewLeadDialog({ open, onOpenChange, onSuccess }) {
  const [formData, setFormData] = useState({ email: '', firstName: '', lastName: '', company: '', domain: '', phone: '', linkedinUrl: '', source: '', status: 'active' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!formData.email) { toast.error('Email is required'); return }
    setLoading(true)
    try {
      await authFetch(`${API_BASE}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      toast.success('Lead created')
      onOpenChange(false)
      setFormData({ email: '', firstName: '', lastName: '', company: '', domain: '', phone: '', linkedinUrl: '', source: '', status: 'active' })
      onSuccess()
    } catch (error) {
      toast.error('Failed to create lead')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
          <DialogDescription>Add a new lead to your database</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} placeholder="John" />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} placeholder="Doe" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} placeholder="Acme Inc" />
            </div>
            <div className="space-y-2">
              <Label>Domain</Label>
              <Input value={formData.domain} onChange={(e) => setFormData({ ...formData, domain: e.target.value })} placeholder="acme.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+1 555-0100" />
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Input value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} placeholder="e.g., LinkedIn" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>LinkedIn URL</Label>
            <Input value={formData.linkedinUrl} onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Lead</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewCampaignDialog({ open, onOpenChange, onSuccess }) {
  const [formData, setFormData] = useState({ name: '', description: '', status: 'active' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!formData.name) { toast.error('Campaign name is required'); return }
    setLoading(true)
    try {
      await authFetch(`${API_BASE}/campaigns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
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
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Q1 Outreach" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Campaign description..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Button onClick={handleSubmit} disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Campaign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewListDialog({ open, onOpenChange, onSuccess, campaigns, allTags }) {
  const [formData, setFormData] = useState({ name: '', description: '', filters: { dateFrom: '', dateTo: '', tags: [], campaigns: [] } })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!formData.name) { toast.error('List name is required'); return }
    setLoading(true)
    try {
      await authFetch(`${API_BASE}/lists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      toast.success('List created')
      onOpenChange(false)
      setFormData({ name: '', description: '', filters: { dateFrom: '', dateTo: '', tags: [], campaigns: [] } })
      onSuccess()
    } catch (error) {
      toast.error('Failed to create list')
    } finally {
      setLoading(false)
    }
  }

  const toggleTag = (tag) => {
    const tags = formData.filters.tags.includes(tag)
      ? formData.filters.tags.filter(t => t !== tag)
      : [...formData.filters.tags, tag]
    setFormData({ ...formData, filters: { ...formData.filters, tags } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New List</DialogTitle>
          <DialogDescription>Create a list based on filters</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>List Name *</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Hot Leads Q1" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="List description..." rows={2} />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><CalendarRange className="w-4 h-4" />Date Range</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" value={formData.filters.dateFrom} onChange={(e) => setFormData({ ...formData, filters: { ...formData.filters, dateFrom: e.target.value } })} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={formData.filters.dateTo} onChange={(e) => setFormData({ ...formData, filters: { ...formData.filters, dateTo: e.target.value } })} />
              </div>
            </div>
          </div>
          {allTags.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Tags className="w-4 h-4" />Filter by Tags</Label>
              <div className="flex flex-wrap gap-2">
                {(allTags || []).map(tag => (
                  <Badge
                    key={tag}
                    variant={formData.filters.tags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                    {formData.filters.tags.includes(tag) && <Check className="w-3 h-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create List</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BulkTagDialog({ open, onOpenChange, onSubmit, count, allTags }) {
  const [tag, setTag] = useState('')

  const handleSubmit = () => {
    if (tag) { onSubmit(tag); setTag('') }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tag</DialogTitle>
          <DialogDescription>Add a tag to {count} selected leads</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label>Tag Name</Label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g., Hot Lead" className="mt-2" />
          </div>
          {allTags.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Or select existing tag</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allTags.slice(0, 10).map(t => (
                  <Badge key={t} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => setTag(t)}>{t}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!tag}>Add Tag</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddLeadsToCampaignDialog({ open, onOpenChange, campaign, onSuccess }) {
  const [leads, setLeads] = useState([])
  const [selectedLeads, setSelectedLeads] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) fetchLeads()
  }, [open, search])

  const fetchLeads = async () => {
    try {
      const params = new URLSearchParams({ limit: '50', ...(search && { search }) })
      const res = await authFetch(`${API_BASE}/leads?${params}`)
      const data = await res.json()
      setLeads((data.leads || []).filter(l => !(l.campaigns || []).includes(campaign?.id)))
    } catch (error) {
      console.error('Failed to fetch leads:', error)
    }
  }

  const handleAdd = async () => {
    if (selectedLeads.length === 0 || !campaign) return
    setLoading(true)
    try {
      await authFetch(`${API_BASE}/leads/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addToCampaign', leadIds: selectedLeads, data: { campaignId: campaign.id } })
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
          <DialogDescription>Select leads to add to this campaign</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <ScrollArea className="h-[300px] border rounded-xl">
            {leads.map(lead => (
              <div
                key={lead.id}
                className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer"
                onClick={() => setSelectedLeads(prev => prev.includes(lead.id) ? prev.filter(id => id !== lead.id) : [...prev, lead.id])}
              >
                <Checkbox checked={selectedLeads.includes(lead.id)} />
                <div>
                  <div className="font-medium text-sm">{lead.email}</div>
                  <div className="text-xs text-muted-foreground">{lead.firstName} {lead.lastName} {lead.company && `• ${lead.company}`}</div>
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
