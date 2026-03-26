# LeadOS - Client Handover Documentation

## 🔐 Admin Access Credentials

**Login URL:** https://tal-liard-one.vercel.app (or your custom domain)

**Default Admin Account:**
- **Email:** `admin@leados.com`
- **Password:** `admin123`

⚠️ **CRITICAL: Change this password immediately after first login!**

---

## 🚀 Application Overview

LeadOS is a lead management system with:
- CSV import (supports 500K+ rows)
- Smart deduplication
- Campaign management
- Custom fields
- Search & filtering
- Activity tracking

---

## 🔧 Environment Configuration (Vercel)

Your app is deployed on Vercel with these environment variables:

```
DATABASE_URL=postgresql://postgres.qaknkrystqejxgssqvah:VymCka8h&24J8yaW@aws-1-us-east-2.pooler.supabase.com:6543/postgres
JWT_SECRET=2416f2ef9d2f42646a8d42149d8c2cbad0a7922c10ab9f7874f1133ca7086c9c605eddec25de392dace08caf54e41b2a78415dd96e5ab778dd81ef900cfdf55c
NEXT_PUBLIC_BASE_URL=https://tal-liard-one.vercel.app
CORS_ORIGINS=*
```

---

## 🛡️ Security Checklist (Complete These ASAP)

### 1. Change Admin Password
- Log in with default credentials
- Go to Settings → Change Password
- Use a strong password (12+ characters, mixed case, numbers, symbols)

### 2. Create Your Admin Account
- Create a new admin user with your company email
- Test login with new account
- Delete or disable `admin@leados.com` account

### 3. Rotate JWT Secret (Every 90 Days)
Generate new secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Update in Vercel → Settings → Environment Variables → `JWT_SECRET`

### 4. Secure Database Password
- Go to Supabase Dashboard → Settings → Database
- Reset database password
- Update `DATABASE_URL` in Vercel with new password

### 5. Enable Supabase RLS Policies (Already Done ✅)
Row Level Security is enabled on all tables.

### 6. Restrict CORS (Optional)
If you have a specific domain, update in Vercel:
```
CORS_ORIGINS=https://yourdomain.com
```

---

## 📊 Database (Supabase)

**Connection:** Transaction Pooler (Port 6543)
**Provider:** Supabase PostgreSQL
**Dashboard:** https://supabase.com/dashboard

### Tables Created:
- `leads` - Core lead data
- `campaigns` - Campaign tracking
- `campaign_leads` - Lead-campaign relationships
- `users` - Authentication
- `activities` - Activity logs
- `lists` - Smart lists
- `import_logs` - Import history
- `lead_custom_fields` - Dynamic fields
- `campaign_field_templates` - Export templates

---

## 🔄 Deduplication Logic

**How it works:**
1. **Email + Key Fields Match** → Skip (counted as duplicate)
2. **Email Exists, Data Different** → Update existing lead
3. **New Email** → Insert new lead

**Key fields compared:** email, first_name, last_name, company, phone

---

## 📁 CSV Import Guidelines

**Supported columns:**
- email (required)
- first_name, last_name
- company, domain
- phone, linkedin_url
- source, status
- Any other columns → stored as custom fields

**Performance:**
- 50K leads: ~20-30 seconds
- 500K leads: ~5-7 minutes

---

## 🔑 GitHub Repository

**URL:** https://github.com/hardik25812/tal

To deploy updates:
1. Push changes to `main` branch
2. Vercel auto-deploys in ~2 minutes

---

## 🆘 Support & Maintenance

### Common Issues:

**1. Can't log in**
- Check credentials
- Clear browser cache
- Try incognito mode

**2. Import fails**
- Check CSV format (UTF-8 encoding)
- Ensure email column exists
- Max file size: 100MB

**3. Slow performance**
- Database connection pooler is optimized
- Contact Supabase support if persistent

### Monitoring:
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- Check logs for errors

---

## 📞 Emergency Contacts

**Database Issues:** Supabase Support
**Hosting Issues:** Vercel Support
**Code Issues:** GitHub repository

---

## ✅ Post-Handover Checklist

- [ ] Changed admin password
- [ ] Created company admin account
- [ ] Tested CSV import
- [ ] Reviewed security settings
- [ ] Bookmarked Vercel & Supabase dashboards
- [ ] Saved this documentation

---

**Last Updated:** March 26, 2026
**Version:** 1.0
