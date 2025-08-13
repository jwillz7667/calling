# Development Setup with Ngrok

## Quick Start

Run everything (frontend, backend, and ngrok) with a single command from the root:

```bash
# From project root
npm run dev:all
```

This will:
1. Start the Next.js webapp on port 3000
2. Start the TypeScript websocket server on port 8081
3. Start ngrok tunnel to expose port 8081 to the internet
4. Automatically update the PUBLIC_URL in your .env file
5. **Automatically update your Twilio phone number webhooks** (if credentials are configured)
6. Display all the URLs for easy reference

## Available Scripts

### Combined Development (Recommended)
```bash
npm run dev:all
```
Runs both server and ngrok together with nice colored output.

### Individual Commands
```bash
npm run dev         # Run just the websocket server
npm run ngrok       # Run just ngrok (manual)
npm run ngrok:auto  # Run ngrok with auto .env update
```

## What the Scripts Do

### `dev:all`
- Uses `concurrently` to run multiple processes
- Shows colored, labeled output for each process
- Automatically kills all processes when you stop with Ctrl+C

### `ngrok:auto`
- Starts ngrok tunnel
- Automatically detects the public URL
- Updates PUBLIC_URL in .env file
- Shows you exactly what URLs to configure in Twilio
- Displays ngrok dashboard URL (http://127.0.0.1:4040)

## Twilio Configuration

After running `npm run dev:all`, you'll see output like:

```
📱 Configure this URL in your Twilio phone number webhooks:
   Voice URL: https://abc123.ngrok.app/twiml
   Status Callback: https://abc123.ngrok.app/call-status

🌐 Frontend WebSocket URLs:
   Call: wss://abc123.ngrok.app/call
   Logs: wss://abc123.ngrok.app/logs
```

Copy these URLs to your Twilio phone number configuration.

## Environment Variables

### Required for Basic Operation
The `ngrok:auto` script automatically updates your `.env` file with:
```
PUBLIC_URL=https://your-ngrok-url.ngrok.app
```

### Optional for Auto-Updating Twilio Webhooks
Add these to `webapp/.env` to enable automatic Twilio webhook updates:
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# Optional - if you have multiple phone numbers
TWILIO_PHONE_NUMBER=+1234567890  # Specify which number to update
# OR
TWILIO_PHONE_NUMBER_SID=PNxxxxxx  # Use the specific SID
```

When these are configured, the script will:
1. Automatically find your Twilio phone number
2. Update its voice URL to point to your ngrok tunnel
3. Update the status callback URL
4. Save the phone number SID for future use

## Troubleshooting

If ngrok doesn't start:
1. Make sure ngrok is installed: `brew install ngrok` (Mac) or download from ngrok.com
2. Make sure you're authenticated: `ngrok config add-authtoken YOUR_TOKEN`

If the .env file isn't updating:
1. Check file permissions
2. Make sure the websocket-server directory is writable

## Benefits

- **Single Command**: No need to manage multiple terminal windows
- **Auto Configuration**: PUBLIC_URL is automatically updated
- **Clear Output**: Color-coded logs make it easy to distinguish server vs ngrok output
- **Clean Shutdown**: Ctrl+C properly stops both processes