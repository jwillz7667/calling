# OpenAI Realtime + Twilio Voice Assistant

A production-ready AI voice assistant that handles both inbound and outbound phone calls using OpenAI's Realtime API and Twilio. Features real-time voice conversation, call recording, custom instructions, and 8 different voice options.

<img width="1728" alt="Screenshot 2024-12-18 at 4 59 30 PM" src="https://github.com/user-attachments/assets/d3c8dcce-b339-410c-85ca-864a8e0fc326" />

## 🌟 Key Features

- **OpenAI Realtime API** - Latest model (`gpt-4o-realtime-preview-2025-06-05`) with 8 voice options
- **Bidirectional Calling** - Handle both inbound and outbound phone calls
- **Call Recording** - Automatic dual-channel recording with playback interface
- **Custom Instructions** - Strict enforcement of user-defined AI behavior
- **Real-time Transcription** - Live transcription using Whisper
- **Production Ready** - API authentication, rate limiting, session management
- **WebSocket Streaming** - Low-latency audio streaming via Twilio Media Streams

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Twilio Account with phone number
- OpenAI API key with Realtime API access
- ngrok (for local development)

### Local Development Setup

Open three terminal windows:

| Terminal | Purpose                       | Commands |
| -------- | ----------------------------- | -------- |
| 1        | Frontend (Next.js)           | `cd webapp && npm install && npm run dev` |
| 2        | Backend (Express + WS)       | `cd websocket-server && npm install && npm run dev` |
| 3        | Tunnel (ngrok)               | `ngrok http 8081` |

### Environment Configuration

1. **Backend** (`websocket-server/.env`):
```env
OPENAI_API_KEY=your_openai_key
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
PUBLIC_URL=https://your-ngrok-url.ngrok.app
API_KEY=generate_secure_key_with_openssl
```

2. **Frontend** (`webapp/.env`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8081
NEXT_PUBLIC_WS_URL=ws://localhost:8081
NEXT_PUBLIC_API_KEY=same_as_backend_api_key
```

3. **Configure Twilio Webhooks**:
   - Voice URL: `https://your-ngrok-url.ngrok.app/twiml`
   - Status Callback: `https://your-ngrok-url.ngrok.app/call-status`
   - Recording Status: `https://your-ngrok-url.ngrok.app/recording-status`

## 🏗 Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Twilio Phone   │────▶│  Backend Server  │────▶│  OpenAI         │
│  (Caller)       │◀────│  (Express + WS)  │◀────│  Realtime API   │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               ▲
                               │
                        ┌──────────────┐
                        │              │
                        │  Frontend    │
                        │  (Next.js)   │
                        │              │
                        └──────────────┘
```

### Life of a Phone Call

**Inbound Call Flow:**
1. Call placed to Twilio number
2. Twilio queries webhook for TwiML instructions
3. TwiML directs Twilio to open WebSocket stream to backend
4. Backend connects to OpenAI Realtime API
5. Audio streams between caller ↔ Twilio ↔ Backend ↔ OpenAI
6. Frontend receives real-time transcripts and events

**Outbound Call Flow:**
1. User initiates call from frontend with instructions
2. Backend uses Twilio API to place call
3. When answered, same streaming flow as inbound

## 🌐 Production Deployment

### Backend on Railway (api.verbio.app)

1. **Deploy to Railway**
   ```bash
   cd websocket-server
   railway init
   railway link
   railway up
   ```

2. **Environment Variables**
   ```env
   OPENAI_API_KEY=your_key
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_PHONE_NUMBER=+1234567890
   PUBLIC_URL=https://api.verbio.app
   API_KEY=your_secure_api_key
   ALLOWED_ORIGINS=https://verbio.app
   NODE_ENV=production
   ```

3. **Add Custom Domain**
   - Add `api.verbio.app` in Railway settings
   - Update DNS with provided CNAME

### Frontend on Vercel (verbio.app)

1. **Deploy to Vercel**
   ```bash
   cd webapp
   vercel --prod
   ```
   - Set root directory to `webapp`

2. **Environment Variables**
   ```env
   NEXT_PUBLIC_API_URL=https://api.verbio.app
   NEXT_PUBLIC_WS_URL=wss://api.verbio.app
   NEXT_PUBLIC_API_KEY=your_secure_api_key
   ```

### Twilio Production Configuration

Update phone number webhooks:
- Voice URL: `https://api.verbio.app/twiml`
- Call Status: `https://api.verbio.app/call-status`
- Recording Status: `https://api.verbio.app/recording-status`

## 📁 Project Structure

```
.
├── webapp/                 # Next.js frontend
│   ├── app/               # App router pages
│   ├── components/        # React components
│   │   ├── call-interface.tsx         # Main interface
│   │   ├── outbound-call-panel.tsx    # Outbound calling
│   │   ├── recordings-panel.tsx       # Recording playback
│   │   ├── session-configuration.tsx  # Voice & settings
│   │   └── transcript.tsx             # Live transcription
│   └── lib/              # Utilities
│
├── websocket-server/      # Express + WebSocket backend
│   ├── src/
│   │   ├── server.ts              # Express server & routes
│   │   ├── sessionManager.ts      # OpenAI session handling
│   │   ├── outboundCaller.ts      # Outbound call logic
│   │   ├── recordingManager.ts    # Recording management
│   │   └── middleware/            # Auth & security
│   └── recordings/       # Local recording storage
│
└── docs/                  # Deployment guides
```

## 🎨 Features & Configuration

### Voice Options
| Voice | Description |
|-------|------------|
| `alloy` | Neutral and balanced |
| `echo` | Warm and engaging |
| `shimmer` | Soft and gentle |
| `ash` | Natural and conversational |
| `ballad` | Expressive and dynamic |
| `coral` | Friendly and cheerful |
| `sage` | Wise and authoritative |
| `verse` | Creative and versatile |

### Custom Instructions

Instructions are enforced with ABSOLUTE SYSTEM MANDATE priority:
- Instructions are immutable once set
- Cannot be overridden by caller input
- Enforced at the OpenAI API level

Example:
```javascript
{
  "instructions": "You are a customer service agent for Acme Corp. Be professional and helpful. Never discuss competitors.",
  "voice": "ash",
  "temperature": 0.8
}
```

### Function Calling

Add custom functions that the AI can call:

```javascript
// websocket-server/src/functionHandlers.ts
export const functions = [
  {
    schema: {
      name: "check_order_status",
      description: "Check the status of an order",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" }
        }
      }
    },
    handler: async (args) => {
      // Your implementation
      return { status: "shipped" };
    }
  }
];
```

## 🔐 Security Features

- **API Key Authentication** - All endpoints require valid API key
- **Rate Limiting** - 100 requests/minute per IP
- **CORS Protection** - Configured allowed origins only
- **Twilio Signature Validation** - Verifies webhook authenticity
- **Session Timeout** - 30-minute automatic cleanup
- **Environment Variables** - Sensitive data in .env files (gitignored)

## 📊 API Endpoints

### Call Management
```bash
POST /api/call/outbound        # Initiate outbound call
GET  /api/call/:callSid/status # Get call status
POST /api/call/:callSid/end    # End active call
GET  /api/calls/active         # List active calls
```

### Recording Management
```bash
GET    /api/recordings                    # List all recordings
GET    /api/recording/:recordingSid       # Get recording metadata
GET    /api/recording/:recordingSid/audio # Stream recording audio
DELETE /api/recording/:recordingSid       # Delete recording
```

### Configuration
```bash
GET /api/voices     # Get available voices
GET /api/models     # Get model versions
GET /tools          # Get available functions
```

## 🧪 Testing

### Test Inbound Call
1. Call your Twilio number
2. AI assistant answers according to configured instructions

### Test Outbound Call
```bash
curl -X POST http://localhost:8081/api/call/outbound \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "to": "+1234567890",
    "instructions": "You are a friendly assistant. Introduce yourself and ask how you can help.",
    "voice": "ash"
  }'
```

### Test WebSocket Connection
```bash
# Install wscat globally
npm install -g wscat

# Test connection
wscat -c ws://localhost:8081/call
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Application error has occurred" | Check OpenAI API key, verify PUBLIC_URL is correct |
| Calls end immediately | Verify Twilio webhooks, check ngrok is running |
| CORS errors | Update ALLOWED_ORIGINS, check API_KEY matches |
| WebSocket fails locally | Use ngrok paid plan or deploy to production |
| No audio | Check Twilio media streams, verify audio format conversion |

## 📈 Monitoring

- **Frontend Logs**: Browser console & Vercel dashboard
- **Backend Logs**: Terminal output or Railway logs
- **Twilio Logs**: Twilio Console → Monitor → Logs
- **OpenAI Usage**: OpenAI Dashboard → Usage
- **Call Recordings**: Web interface → Recordings tab

## 🛠 Development

### Generate Secure API Key
```bash
openssl rand -hex 32
```

### Build for Production
```bash
# Backend
cd websocket-server
npm run build

# Frontend  
cd webapp
npm run build
```

### Type Checking
```bash
npm run typecheck
```

## 📝 Environment Variables Reference

### Backend (websocket-server/.env)
| Variable | Description | Example |
|----------|------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `...` |
| `TWILIO_PHONE_NUMBER` | Your Twilio number | `+1234567890` |
| `PUBLIC_URL` | Public URL for webhooks | `https://api.example.com` |
| `API_KEY` | API key for authentication | `generated_key` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://example.com` |

### Frontend (webapp/.env)
| Variable | Description | Example |
|----------|------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.example.com` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `wss://api.example.com` |
| `NEXT_PUBLIC_API_KEY` | API key for backend | `same_as_backend` |

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 🆘 Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/jwillz7667/calling/issues)
- Check documentation in `/docs` folder
- Review [OpenAI Realtime docs](https://platform.openai.com/docs/guides/realtime)
- Review [Twilio docs](https://www.twilio.com/docs/voice)

## ⚠️ Important Notes

- **WebSocket Support**: Vercel doesn't support persistent WebSockets, deploy backend separately
- **ngrok Limitations**: Free tier doesn't properly support WebSockets with Twilio
- **API Keys**: Never commit .env files, always use environment variables
- **Recording Storage**: Recordings are stored locally, implement cloud storage for production

---

Built with ❤️ for production voice AI applications

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>