# 🚀 Free Deployment Guide - Pakistani Tax Advisor

## Quick Deploy Options

### 🌟 Option 1: Render.com (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy on Render:**
   - Go to [render.com](https://render.com)
   - Connect your GitHub account
   - Select "New" → "Blueprint"
   - Connect your repository
   - The `render.yaml` file will configure everything automatically

3. **Your URLs:**
   - **Frontend**: `https://your-app-name-web.onrender.com`
   - **API**: `https://your-app-name-api.onrender.com`
   - **Database**: Automatically configured

---

### 🚂 Option 2: Railway.app

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Deploy Backend:**
   ```bash
   cd backend
   railway link
   railway up
   ```

3. **Deploy Frontend:**
   ```bash
   cd ../frontend
   railway link
   railway up
   ```

---

### 🌐 Option 3: Vercel + PlanetScale

#### Frontend (Vercel):
1. Go to [vercel.com](https://vercel.com)
2. Import your repository
3. Set build command: `cd frontend && npm run build`
4. Set output directory: `frontend/build`

#### Database (PlanetScale):
1. Go to [planetscale.com](https://planetscale.com)
2. Create new database
3. Apply the Prisma baseline + phase migrations (see Database Setup below).
   The legacy `/database/schema.sql` and root `schema.legacy.sql` are NOT
   authoritative — do not use them to bootstrap a new database.

#### Backend (Vercel Functions):
- Convert to serverless functions (requires code changes)

---

## 📋 Pre-Deployment Checklist

### ✅ Environment Variables Needed:

**Backend:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Random secure key  
- `SESSION_SECRET` - Random secure key
- `NODE_ENV=production`
- `PORT` - Will be set by hosting provider

**Frontend:**  
- `REACT_APP_API_URL` - Your deployed API URL

### 🗄️ Database Setup:

1. **Apply migrations (authoritative — do not use legacy schema files):**
   ```bash
   cd backend
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/0_init/migration.sql
   for f in $(ls database/migrations/phase-*.sql | sort); do
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
   done
   ```
   This creates all tables (users, tax_years, tax_slabs, tax_rates_config,
   form tables, tax_return_history) and seeds TY 2024-25 + TY 2025-26 rates.

2. **Insert Default Data:**
   ```bash
   # Run the system settings script
   node backend/src/scripts/createSystemSettingsTable.js
   ```

---

## 🎯 Recommended: Render.com Deployment

### Why Render.com?
- ✅ **Free PostgreSQL database** (90 days free, then $7/month)
- ✅ **Free web services** (750 hours/month)
- ✅ **Automatic SSL certificates**
- ✅ **GitHub integration**
- ✅ **Easy environment variable management**

### Step-by-Step:

1. **Commit your code:**
   ```bash
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```

2. **Create Render account:**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

3. **Create Blueprint:**
   - Click "New" → "Blueprint" 
   - Connect your GitHub repository
   - Select "Pakistani Tax Advisor" repository
   - Click "Apply"

4. **Configure Environment Variables:**
   - Go to your backend service
   - Add environment variables:
     - `JWT_SECRET`: Generate a random 32-character string
     - `SESSION_SECRET`: Generate a random 32-character string

5. **Access your app:**
   - Frontend: `https://pakistani-tax-advisor-web.onrender.com`
   - API: `https://pakistani-tax-advisor-api.onrender.com`

---

## 🔧 Testing Your Deployment

### Health Check Endpoints:
- **API Health**: `https://your-api-url.onrender.com/api/health`
- **Frontend**: Should load the login page

### Admin Login:
- Email: `superadmin@paktaxadvisor.com`  
- Password: `admin123`

### User Login:
- Email: `testuser@paktaxadvisor.com`
- Password: `testuser123`

---

## 💰 Cost Breakdown (Free Tiers)

### Render.com:
- ✅ **Web Services**: 750 hours/month (enough for testing)
- ✅ **PostgreSQL**: 90 days free, then $7/month
- ✅ **SSL & Custom domains**: Free

### Railway.app:
- ✅ **$5/month free credit**
- ✅ **All services included**

### Vercel + PlanetScale:
- ✅ **Frontend hosting**: Free
- ✅ **Database**: Free tier available
- ✅ **Serverless functions**: Free tier

---

## 🚨 Important Notes

1. **Free tier limitations:**
   - Services may sleep after 15 minutes of inactivity
   - Database has storage limits
   - Bandwidth limits apply

2. **Security:**
   - Change default passwords immediately
   - Use strong JWT secrets
   - Enable HTTPS only

3. **Performance:**
   - Free tiers have limited resources
   - Consider upgrading for production use

---

## 🆘 Troubleshooting

### Common Issues:
1. **Build failures**: Check logs in hosting dashboard
2. **Database connection**: Verify DATABASE_URL format
3. **API calls failing**: Check REACT_APP_API_URL setting
4. **CORS errors**: Update backend CORS configuration

### Support:
- Check hosting provider documentation
- Review application logs
- Test API endpoints directly

---

Ready to deploy? Choose **Render.com** for the easiest deployment experience! 🚀