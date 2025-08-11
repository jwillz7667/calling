# Split Deployment Guide: Frontend on Vercel, Backend on Railway

Since Vercel doesn't fully support WebSocket servers, deploy the backend separately.

## Architecture
- **Frontend (Next.js)**: Deploy on Vercel at `verbio.app`
- **Backend (Express + WebSockets)**: Deploy on Railway at `api.verbio.app`

## Part 1: Deploy Backend on Railway

### 1. Create Railway Account
Go to [Railway.app](https://railway.app) and sign up

### 2. Create New Project
```bash
# In websocket-server directory
cd websocket-server
npm install @railway/cli -g
railway login
railway init
```

### 3. Set Environment Variables in Railway
```env
OPENAI_API_KEY=your_openai_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
PUBLIC_URL=https://api.verbio.app
API_KEY=your_generated_api_key
ALLOWED_ORIGINS=https://verbio.app,https://www.verbio.app
NODE_ENV=production
```

### 4. Add Custom Domain in Railway
- Go to Settings > Domains
- Add custom domain: `api.verbio.app`
- Update DNS records:
  - Add CNAME record pointing `api.verbio.app` to Railway's provided domain

### 5. Deploy Backend
```bash
railway up
```

## Part 2: Deploy Frontend on Vercel

### 1. Update Frontend Environment
In Vercel dashboard, set:
```env
NEXT_PUBLIC_API_URL=https://api.verbio.app
NEXT_PUBLIC_WS_URL=wss://api.verbio.app
NEXT_PUBLIC_API_KEY=your_generated_api_key
```

### 2. Connect GitHub Repository
- Go to Vercel Dashboard
- Import repository
- Set root directory to: `webapp`
- Framework: Next.js

### 3. Deploy
```bash
vercel --prod
```

## Part 3: Configure Twilio Webhooks

Update your Twilio phone number webhooks to point to the backend:

1. **Voice URL**: `https://api.verbio.app/twiml`
2. **Call Status**: `https://api.verbio.app/call-status`
3. **Recording Status**: `https://api.verbio.app/recording-status`

## DNS Configuration

### For verbio.app (frontend):
- A record: Point to Vercel's IP
- Or CNAME: Point to `cname.vercel-dns.com`

### For api.verbio.app (backend):
- CNAME: Point to Railway's provided domain

## Alternative: Use Render.com for Backend

If you prefer Render over Railway:

### 1. Create render.yaml in websocket-server
```yaml
services:
  - type: web
    name: verbio-api
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

### 2. Deploy to Render
- Connect GitHub repo
- Select websocket-server as root directory
- Add environment variables
- Deploy

## Testing

1. **Test WebSocket Connection**:
```bash
wscat -c wss://api.verbio.app/call
```

2. **Test API Endpoints**:
```bash
curl https://api.verbio.app/tools
```

3. **Test Twilio Integration**:
- Make a call to your Twilio number
- Check if WebSocket connects properly

## Benefits of Split Deployment

1. **WebSocket Support**: Railway/Render fully support WebSockets
2. **Scalability**: Scale frontend and backend independently
3. **Cost Optimization**: Use Vercel's free tier for frontend
4. **Better Performance**: CDN for frontend, dedicated server for backend
5. **Easier Debugging**: Separate logs and monitoring

## Monitoring

- **Frontend Logs**: Vercel Dashboard > Functions > Logs
- **Backend Logs**: Railway Dashboard > Deployments > Logs
- **Twilio Logs**: Twilio Console > Monitor > Logs