# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an OpenAI Realtime API with Twilio integration that creates an AI phone calling assistant. The project consists of two main components:

1. **webapp** - NextJS frontend (port 3000) for call configuration, transcript display, and function call management
2. **websocket-server** - Express backend (port 8081) that bridges Twilio phone calls with OpenAI's Realtime API

## Development Commands

### Frontend (webapp)
```bash
cd webapp
npm install        # Install dependencies
npm run dev        # Start development server (port 3000)
npm run build      # Build for production
npm run lint       # Run linting
```

### Backend (websocket-server)
```bash
cd websocket-server
npm install        # Install dependencies  
npm run dev        # Start development server with nodemon (port 8081)
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled server
```

### ngrok Setup (Required for Twilio)
```bash
ngrok http 8081    # Expose websocket server to internet
```

## Architecture

### Call Flow
1. Twilio receives phone call → queries `/twiml` endpoint for instructions
2. Backend returns TwiML XML instructing Twilio to open WebSocket stream to `/call`
3. Backend creates bidirectional bridge:
   - Twilio ↔ Backend ↔ OpenAI Realtime API
   - Frontend (`/logs` WebSocket) ↔ Backend for monitoring

### Key WebSocket Endpoints
- `wss://[backend]/call` - Handles Twilio media streams
- `wss://[backend]/logs` - Frontend connection for real-time updates

### Session Management
- `sessionManager.ts` orchestrates connections between Twilio, OpenAI, and frontend
- Handles audio format conversion (mulaw ↔ PCM16)
- Manages function calling between OpenAI and custom handlers

### Function Calling
- Function schemas defined in `websocket-server/src/functionHandlers.ts`
- Frontend can mock function responses via UI
- Backend forwards function calls between OpenAI and frontend

## Environment Configuration

### webapp/.env
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
```

### websocket-server/.env
```
OPENAI_API_KEY=
PUBLIC_URL=         # ngrok URL (e.g., https://abc123.ngrok-free.app)
TWILIO_AUTH_TOKEN=  # Optional for signature validation
REQUIRE_TWILIO_SIGNATURE=false  # Set to true in production
```

## TypeScript Configuration

Both projects use strict TypeScript:
- webapp: Next.js TypeScript config with path aliases (`@/*`)
- websocket-server: CommonJS output to `dist/` directory

## Key Implementation Details

- Audio streaming uses base64-encoded PCM16 format
- Twilio media messages require mulaw↔PCM16 conversion
- Single active call/log connection enforced (new connections close existing ones)
- Function calls can be handled by backend or mocked in frontend UI
- TwiML template at `websocket-server/src/twiml.xml` defines call handling