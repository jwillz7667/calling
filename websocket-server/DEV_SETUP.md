# Development Setup with Ngrok

## Quick Start

Run both the websocket server and ngrok with a single command:

```bash
cd websocket-server
npm run dev:all
```

This will:
1. Start the TypeScript development server with hot reload on port 8081
2. Start ngrok tunnel to expose port 8081 to the internet
3. Automatically update the PUBLIC_URL in your .env file
4. Display the URLs you need to configure in Twilio

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

The `ngrok:auto` script automatically updates your `.env` file with:
```
PUBLIC_URL=https://your-ngrok-url.ngrok.app
```

This ensures your server always knows its public URL for Twilio callbacks.

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