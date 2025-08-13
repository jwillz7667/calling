# Environment Configuration Guide

## Railway (Backend - api.verbio.app)

These environment variables should be set in your Railway dashboard:

```env
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Server Configuration
PUBLIC_URL=https://api.verbio.app
NODE_ENV=production
PORT=8081

# Security
API_KEY=your-secure-api-key
ALLOWED_ORIGINS=https://verbio.app,https://www.verbio.app,http://localhost:3000

# Twilio (Optional - for signature validation)
TWILIO_AUTH_TOKEN=your-twilio-auth-token

# Logging
LOG_REALTIME_EVENTS=true

# Session Management
SESSION_TIMEOUT_MS=1800000
MAX_CONCURRENT_SESSIONS=100
```

## Vercel (Frontend - verbio.app)

These environment variables should be set in your Vercel dashboard:

```env
# Backend Connection
NEXT_PUBLIC_WS_URL=https://api.verbio.app
NEXT_PUBLIC_API_KEY=your-secure-api-key

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
```

## Twilio Configuration

### Phone Number Webhook
In your Twilio Console, configure your phone number's webhook:
- **When a call comes in**: `https://api.verbio.app/twiml`
- **HTTP Method**: POST or GET

### Key URLs

- **Backend API**: `https://api.verbio.app`
- **Frontend App**: `https://verbio.app`
- **Twilio Webhook**: `https://api.verbio.app/twiml`
- **WebSocket (Twilio)**: `wss://api.verbio.app/call`
- **WebSocket (Logs)**: `wss://api.verbio.app/logs?apiKey=YOUR_API_KEY`

## Local Development

### Backend (.env)
```env
OPENAI_API_KEY=your-openai-api-key
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
PORT=8081
PUBLIC_URL=https://your-ngrok-url.ngrok-free.app
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_WS_URL=ws://localhost:8081
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
```

## Testing the Connection

1. **Test OpenAI Connection**: 
   ```bash
   curl https://api.verbio.app/test-openai
   ```

2. **Check Public URL**: 
   ```bash
   curl https://api.verbio.app/public-url
   ```

3. **View TwiML Response**: 
   ```bash
   curl https://api.verbio.app/twiml
   ```

## Important Notes

- The `PUBLIC_URL` in Railway must be `https://api.verbio.app` (your Railway custom domain)
- The `NEXT_PUBLIC_WS_URL` in Vercel should also be `https://api.verbio.app` (not including `/twiml`)
- Ensure your API_KEY matches between Railway and Vercel for authentication
- The `/twiml` endpoint is automatically appended by the application