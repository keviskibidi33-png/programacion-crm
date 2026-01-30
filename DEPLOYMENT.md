# Programacion CRM - Deployment Guide

## 🚀 Quick Start for Coolify

### Prerequisites
- Coolify instance configured
- Domain name ready (e.g., `programacion.geofal.com.pe`)
- GitHub repository access

### Environment Variables

Set these in Coolify before deployment:

```env
NEXT_PUBLIC_SUPABASE_URL=https://db.geofal.com.pe
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2ODY2MDY4MCwiZXhwIjo0OTI0MzM0MjgwLCJyb2xlIjoiYW5vbiJ9.4z7Le-pgOQJXXkW51BxJ7-n-4rRZ64iTZmlWadXN2fE
```

### Coolify Configuration Steps

1. **Create New Resource**
   - Type: Docker Compose
   - Repository: Connect your GitHub repo
   - Branch: `main`

2. **Domain Configuration**
   - Set your domain: `programacion.geofal.com.pe`
   - Enable HTTPS/SSL (Coolify handles this automatically)

3. **Environment Variables**
   - Add the variables listed above
   - Make sure to use the production Supabase credentials

4. **Build & Deploy**
   - Coolify will automatically detect `docker-compose.yml`
   - Build process uses multi-stage Dockerfile for optimization
   - Container exposes port 3000

### Verification

After deployment:
- ✅ Check domain resolves: `https://programacion.geofal.com.pe`
- ✅ Verify Supabase connection works
- ✅ Test CRUD operations on programacion table
- ✅ Verify Excel export functionality

### Troubleshooting

**Issue**: Container fails to start
- Check Coolify logs for build errors
- Verify environment variables are set correctly

**Issue**: Database connection fails
- Verify Supabase URL and anon key
- Check network connectivity from Coolify to Supabase

**Issue**: Domain not resolving
- Verify DNS settings point to Coolify server
- Check Coolify domain configuration

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev -- -p 3001

# Build for production
npm run build

# Test production build locally
npm start
```

## Docker Local Test

```bash
# Build image
docker compose build

# Run container
docker compose up

# Access at http://localhost:3000
```

## Tech Stack

- **Framework**: Next.js 16.1.6
- **Runtime**: React 19.2.3
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Docker + Coolify
- **Port**: 3000
