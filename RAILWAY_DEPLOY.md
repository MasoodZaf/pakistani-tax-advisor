# 🚂 Railway Deployment Guide

## Step-by-Step Deployment

### 1. Commit and Push Changes
```bash
git add .
git commit -m "Add Railway configuration"
git push origin main
```

### 2. Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Click **"Login"** → **"Login with GitHub"**
3. Authorize Railway to access your repositories

### 3. Deploy Database First
1. Click **"New Project"**
2. Select **"Provision PostgreSQL"**
3. Name it: `pakistani-tax-advisor-db`
4. Wait for database to be ready
5. **Copy the DATABASE_URL** from the Connect tab

### 4. Deploy Backend API
1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Select your **"Pakistani Tax Advisor"** repository
3. Choose **"backend"** folder as root directory
4. **Environment Variables to add:**
   ```
   NODE_ENV=production
   DATABASE_URL=[paste the URL from step 3]
   JWT_SECRET=your-random-secret-key-32-chars
   SESSION_SECRET=another-random-secret-32-chars
   PORT=$PORT
   ```
5. Click **"Deploy"**
6. **Copy your backend URL** (e.g., `https://xxx.railway.app`)

### 5. Deploy Frontend
1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Select your **"Pakistani Tax Advisor"** repository
3. Choose **"frontend"** folder as root directory
4. **Environment Variables to add:**
   ```
   REACT_APP_API_URL=[paste your backend URL from step 4]
   ```
5. Click **"Deploy"**
6. **Your frontend URL** will be available (e.g., `https://yyy.railway.app`)

### 6. Initialize Database
1. Once backend is deployed, visit: `[your-backend-url]/api/health`
2. Should show: `{"status":"success","message":"Server is healthy"}`

### 7. Test Your App
1. Visit your frontend URL
2. **Login with:**
   - **Admin:** `superadmin@paktaxadvisor.com` / `admin123`
   - **User:** `testuser@paktaxadvisor.com` / `testuser123`

## 💡 Pro Tips

### Free Limits:
- **$5 free credit** (enough for months of testing)
- **500 hours execution time** per month
- **1GB RAM** per service

### Monitoring:
- Check **"Deployments"** tab for build logs
- Use **"Metrics"** tab to monitor usage
- **"Logs"** tab shows runtime errors

### Custom Domains (Optional):
- Go to service → Settings → Domains
- Add your custom domain
- Railway provides SSL automatically

## 🚨 Important Notes

1. **Database Connection:** Make sure DATABASE_URL is correctly set in backend
2. **CORS:** Backend is configured to accept requests from any origin in production
3. **Build Time:** First deployment may take 5-10 minutes
4. **Sleep Mode:** Services sleep after 10 minutes of inactivity on free tier

## 🔧 Troubleshooting

### Backend Issues:
- Check if DATABASE_URL is set correctly
- Verify all environment variables are added
- Check logs in Railway dashboard

### Frontend Issues:
- Ensure REACT_APP_API_URL points to your deployed backend
- Check if backend is accessible at /api/health
- Verify build logs for any errors

### Database Issues:
- Make sure PostgreSQL service is running
- Check database connection in backend logs
- Verify database URL format is correct

## 📱 Your Live URLs

After deployment, you'll have:
- **Frontend:** `https://your-frontend.railway.app`
- **Backend API:** `https://your-backend.railway.app`
- **Database:** Internal Railway PostgreSQL

## 🎉 Success!

Your Pakistani Tax Advisor app will be live and accessible worldwide!

Test all features:
- ✅ User registration and login
- ✅ Tax calculations and forms
- ✅ Admin panel and system settings
- ✅ Change password functionality
- ✅ Reports and analytics