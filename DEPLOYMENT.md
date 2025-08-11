# Production Deployment Guide for Vercel

## Prerequisites
- Vercel account
- GitHub repository connected to Vercel
- Twilio account with phone number
- OpenAI API key with Realtime API access

## Deployment Steps

### 1. Set Up GitHub Repository
```bash
git init
git remote add origin https://github.com/jwillz7667/calling.git
git add .
git commit -m "Production-ready OpenAI Realtime + Twilio application"
git push -u origin main
```

### 2. Connect to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Select the repository `jwillz7667/calling`

### 3. Configure Environment Variables in Vercel
Add these environment variables in Vercel project settings:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Server Configuration
PUBLIC_URL=https://verbio.app
NODE_ENV=production

# Security Configuration
API_KEY=generate_a_secure_api_key_here
ALLOWED_ORIGINS=https://verbio.app,https://www.verbio.app

# Frontend Configuration
NEXT_PUBLIC_API_URL=https://verbio.app
NEXT_PUBLIC_WS_URL=wss://verbio.app
NEXT_PUBLIC_API_KEY=same_as_API_KEY_above
```

### 4. Update Twilio Webhook URLs
After deployment, update your Twilio phone number webhooks:

1. Go to Twilio Console > Phone Numbers
2. Select your phone number
3. Configure webhooks:
   - **Voice Configuration:**
     - When a call comes in: `https://verbio.app/twiml`
     - Primary Handler Fails: Leave empty
     - Method: HTTP POST
   - **Call Status Webhook:**
     - `https://verbio.app/call-status`
     - Method: HTTP POST
   - **Recording Status Callback:**
     - `https://verbio.app/recording-status`
     - Method: HTTP POST

### 5. Deploy to Vercel
```bash
vercel --prod
```

Or push to GitHub and Vercel will auto-deploy:
```bash
git push origin main
```

## Important Notes

### WebSocket Support
Vercel supports WebSockets through their Edge Network. The application is configured to use WebSockets for:
- Real-time audio streaming with Twilio
- OpenAI Realtime API connections
- Frontend live updates

### Production Security
- Always use HTTPS URLs
- Set strong API keys
- Configure ALLOWED_ORIGINS properly
- Enable Twilio signature validation (automatic in production)

### Model Configuration
The application uses OpenAI's Realtime API with model: `gpt-4o-realtime-preview-2025-06-05`

### Features Enabled
- ✅ Inbound call handling
- ✅ Outbound call initiation
- ✅ Call recording with playback
- ✅ 8 voice options
- ✅ Custom instructions with strict enforcement
- ✅ Real-time transcription
- ✅ Function calling support
- ✅ 30-minute session management

## Testing Production

1. **Test Inbound Calls:**
   - Call your Twilio number
   - The AI should answer according to default instructions

2. **Test Outbound Calls:**
   - Use the web interface to initiate calls
   - Provide custom instructions
   - Select voice and temperature settings

3. **Test Recording Playback:**
   - After calls complete, check the Recordings tab
   - Verify audio playback works

## Troubleshooting

### Calls End Immediately
- Check PUBLIC_URL is set correctly in Vercel
- Ensure WebSocket URLs use `wss://` protocol
- Verify Twilio webhooks point to correct URLs

### "Application Error" Message
- Check OpenAI API key is valid
- Verify environment variables are set
- Check Vercel function logs

### CORS Errors
- Update ALLOWED_ORIGINS in environment variables
- Ensure frontend URLs match backend configuration

## Support
For issues, check:
- Vercel function logs
- Browser console for frontend errors
- Twilio debugger for call issues