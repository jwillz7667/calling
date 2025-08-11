# Railway Deployment Guide for Backend

## Quick Deploy Steps

### 1. Create Railway Account
Go to [Railway.app](https://railway.app) and sign up with GitHub

### 2. Create New Project
Click "New Project" → "Deploy from GitHub repo" → Select your repository

### 3. Configure Service
- **Root Directory**: Set to `websocket-server`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### 4. Add Environment Variables
Go to Variables tab and add:

```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Server
PUBLIC_URL=https://api.verbio.app
NODE_ENV=production
PORT=8081

# Security
API_KEY=your_generated_api_key_here
ALLOWED_ORIGINS=https://verbio.app,https://www.verbio.app

# Session
SESSION_TIMEOUT_MS=1800000
MAX_CONCURRENT_SESSIONS=100
```

### 5. Generate Domain
Railway will provide a domain like: `your-app.up.railway.app`

### 6. Add Custom Domain (api.verbio.app)
1. Go to Settings → Domains
2. Add custom domain: `api.verbio.app`
3. Railway will provide a CNAME target

### 7. Update DNS Records
Add CNAME record in your DNS provider:
- **Name**: `api`
- **Value**: The CNAME target Railway provided
- **TTL**: 300

### 8. Update PUBLIC_URL After Domain Setup
Once DNS propagates, update the PUBLIC_URL environment variable:
```
PUBLIC_URL=https://api.verbio.app
```

### 9. Deploy
Railway auto-deploys when you push to GitHub, or manually trigger deployment.

## Verify Deployment

### Test API Endpoint:
```bash
curl https://api.verbio.app/tools
```

### Test WebSocket:
```bash
# If you have wscat installed
wscat -c wss://api.verbio.app/call
```

## Update Twilio Webhooks

In Twilio Console, update your phone number webhooks:

1. **Voice Configuration URL**: `https://api.verbio.app/twiml`
2. **Call Status Callback**: `https://api.verbio.app/call-status`  
3. **Recording Status Callback**: `https://api.verbio.app/recording-status`

## Update Frontend Environment

In your Vercel deployment (frontend), update environment variables:
```
NEXT_PUBLIC_API_URL=https://api.verbio.app
NEXT_PUBLIC_WS_URL=wss://api.verbio.app
```

## Monitoring

- View logs: Railway Dashboard → Deployments → View Logs
- Monitor metrics: Railway Dashboard → Metrics
- Set up health checks: Add endpoint `/health` if needed

## Troubleshooting

### WebSocket Connection Issues
- Ensure PUBLIC_URL uses `https://` (not `http://`)
- Check ALLOWED_ORIGINS includes your frontend domain
- Verify Railway supports WebSocket (it does by default)

### Twilio Connection Issues
- Check PUBLIC_URL matches your actual domain
- Verify Twilio webhooks use POST method
- Check Twilio signature validation (disabled in dev, enabled in prod)

## Cost
- Railway offers $5 free credits monthly
- WebSocket connections count toward usage
- Monitor usage in Railway dashboard

## Alternative Commands

If automatic deployment fails, use Railway CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy manually
railway up
```