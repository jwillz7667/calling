# Production Deployment Guide - OpenAI Realtime API with Twilio

This guide covers deploying the OpenAI Realtime API with Twilio integration to production using Vercel and the verbio.app domain.

## Architecture Overview

- **Frontend**: Next.js app deployed on Vercel (verbio.app)
- **Backend**: Express WebSocket server deployed on Vercel (api.verbio.app)
- **Phone Service**: Twilio for inbound/outbound calling
- **AI**: OpenAI Realtime API with latest model (gpt-4o-realtime-preview-2025-06-05)

## Features

### Latest Realtime API Features
- **Model Snapshots**: Using June 2025 snapshot (gpt-4o-realtime-preview-2025-06-05)
- **8 Voice Options**: alloy, echo, shimmer, ash, ballad, coral, sage, verse
- **Session Controls**: Dynamic session.update and response.create events
- **Input Transcription**: Real-time transcription with Whisper
- **Session Management**: 30-minute session expiry with automatic cleanup

### Calling Features
- **Inbound Calls**: Receive calls on Twilio numbers
- **Outbound Calls**: Initiate AI calls to any phone number
- **Call Management**: Monitor and control active calls
- **Transcriptions**: Store and retrieve call transcripts

### Production Features
- **Multi-session Support**: Handle multiple concurrent calls
- **Session Persistence**: Maintain state across reconnections
- **Error Handling**: Robust error recovery and logging
- **Rate Limiting**: Built-in rate limit tracking
- **Security**: API key authentication and CORS configuration

## Deployment Steps

### 1. Prerequisites

- Vercel account
- Twilio account with phone number
- OpenAI API key with Realtime API access
- Domain configured (verbio.app)

### 2. Environment Variables

Set these in Vercel dashboard for both projects:

#### Backend (api.verbio.app)
```env
OPENAI_API_KEY=your_openai_api_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
PUBLIC_URL=https://api.verbio.app
API_KEY=your_secure_api_key
ALLOWED_ORIGINS=https://verbio.app,https://www.verbio.app
```

#### Frontend (verbio.app)
```env
NEXT_PUBLIC_API_URL=https://api.verbio.app
NEXT_PUBLIC_WS_URL=wss://api.verbio.app
NEXT_PUBLIC_API_KEY=your_secure_api_key
```

### 3. Deploy Backend

```bash
cd websocket-server
vercel --prod
```

Configure domain: api.verbio.app → your-backend-deployment.vercel.app

### 4. Deploy Frontend

```bash
cd webapp
vercel --prod
```

Configure domain: verbio.app → your-frontend-deployment.vercel.app

### 5. Configure Twilio

1. Go to Twilio Console → Phone Numbers
2. Select your phone number
3. Set Voice webhook to: `https://api.verbio.app/twiml`
4. Set webhook method to: POST
5. Save configuration

### 6. Test Deployment

1. Visit https://verbio.app
2. Configure your phone number
3. Make a test call to your Twilio number
4. Test outbound calling feature

## API Endpoints

### WebSocket Endpoints
- `wss://api.verbio.app/call` - Twilio media stream
- `wss://api.verbio.app/logs` - Frontend monitoring

### REST Endpoints
- `POST /api/call/outbound` - Initiate outbound call
- `GET /api/call/:callSid/status` - Get call status
- `POST /api/call/:callSid/end` - End active call
- `GET /api/calls/active` - List active calls
- `GET /api/phone-numbers` - Get available numbers
- `GET /api/sessions` - Get active sessions
- `GET /api/sessions/:id/transcriptions` - Get transcripts
- `GET /api/voices` - Get available voices
- `GET /api/models` - Get model versions

## Configuration Options

### Session Configuration
```javascript
{
  model: "latest" | "june2025" | "december" | "october",
  voice: "alloy" | "echo" | "shimmer" | "ash" | "ballad" | "coral" | "sage" | "verse",
  instructions: "Custom instructions for the AI",
  temperature: 0.0 - 2.0,
  max_response_output_tokens: number | "inf",
  input_audio_transcription: { model: "whisper-1" },
  turn_detection: {
    type: "server_vad" | "none",
    threshold: 0.0 - 1.0,
    prefix_padding_ms: number,
    silence_duration_ms: number
  }
}
```

### Outbound Call Configuration
```javascript
{
  to: "+1234567890",           // E.164 format
  from: "+0987654321",          // Your Twilio number
  instructions: "AI instructions",
  voice: "ash",
  temperature: 0.8,
  maxResponseOutputTokens: 4096
}
```

## Monitoring

### Session Monitoring
- Active sessions: `GET /api/sessions`
- Session duration tracking
- Automatic 30-minute expiry
- Transcription storage

### Call Monitoring
- Real-time call status
- Call duration tracking
- Answering machine detection
- Call direction (inbound/outbound)

## Security Considerations

1. **API Keys**: Use strong, unique API keys
2. **CORS**: Configure allowed origins properly
3. **Rate Limiting**: Monitor OpenAI rate limits
4. **Session Expiry**: 30-minute automatic cleanup
5. **HTTPS Only**: All traffic over TLS
6. **Environment Variables**: Never commit secrets

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check CORS configuration
   - Verify WebSocket support in hosting
   - Check firewall rules

2. **Twilio Webhook Errors**
   - Verify PUBLIC_URL is correct
   - Check Twilio webhook configuration
   - Review Twilio error logs

3. **OpenAI Connection Issues**
   - Verify API key has Realtime access
   - Check rate limits
   - Monitor error events

4. **Session Expiry**
   - Sessions auto-expire after 30 minutes
   - Implement reconnection logic
   - Store important data externally

## Performance Optimization

1. **Sticky Sessions**: Configure load balancer for WebSocket affinity
2. **Connection Pooling**: Reuse OpenAI connections
3. **Caching**: Cache tool schemas and configurations
4. **Compression**: Enable WebSocket compression
5. **CDN**: Use CDN for static assets

## Scaling Considerations

1. **Horizontal Scaling**: Use Redis for session storage
2. **Load Balancing**: Configure WebSocket-aware load balancer
3. **Database**: Add PostgreSQL for persistent storage
4. **Monitoring**: Implement APM (Application Performance Monitoring)
5. **Logging**: Centralized logging with correlation IDs

## Cost Management

1. **OpenAI Costs**
   - Monitor token usage
   - Set max_response_output_tokens limits
   - Implement user quotas

2. **Twilio Costs**
   - Monitor call duration
   - Set maximum call length
   - Track phone number usage

3. **Vercel Costs**
   - Monitor bandwidth usage
   - Optimize WebSocket connections
   - Use appropriate plan

## Support

For issues or questions:
1. Check Vercel deployment logs
2. Review Twilio debugger
3. Monitor OpenAI API status
4. Check browser console for WebSocket errors

## License

This project is configured for production use with appropriate security and scalability considerations.