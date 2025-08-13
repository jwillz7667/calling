import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, ServerResponse } from "http";
import { Duplex } from "stream";
import dotenv from "dotenv";
import http from "http";
import { readFileSync } from "fs";
import https from "https";
import dns from "dns";
import { join } from "path";
import cors from "cors";
import {
  handleCallConnection,
  handleFrontendConnection,
  getActiveSessions,
  getSessionTranscriptions,
  AVAILABLE_VOICES,
  MODEL_VERSIONS,
} from "./sessionManager";
import functions from "./functionHandlers";
import { getOutboundCallService } from "./outboundCaller";
import { getRecordingManager } from "./recordingManager";
import {
  authenticateApiKey,
  validateTwilioSignature,
  rateLimit,
  getCorsOptions,
  authenticateWebSocket,
  securityHeaders,
  requestLogger
} from "./middleware/auth";

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || "8081", 10);
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Debug logging for Railway
console.log("=== Environment Configuration ===");
console.log("PORT:", PORT);
console.log("PUBLIC_URL:", PUBLIC_URL || "Not set");
console.log("OPENAI_API_KEY:", OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 10)}...` : "NOT SET");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("================================");
console.log("LOG_REALTIME_EVENTS:", (process.env.LOG_REALTIME_EVENTS || "false"));

if (!OPENAI_API_KEY) {
  console.error("\n❌ OPENAI_API_KEY environment variable is required");
  console.error("Set it in Railway dashboard under Variables tab");
  console.error("Exiting...");
  process.exit(1);
}

const app = express();

// Apply CORS first - this is critical for preflight requests
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // In production, allow specific origins
    const allowedOrigins = [
      'https://verbio.app',
      'https://www.verbio.app', 
      'https://calling.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Apply security and logging middleware
app.use(securityHeaders);
app.use(requestLogger);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Apply rate limiting to all routes
app.use(rateLimit(100, 60000)); // 100 requests per minute

const server = http.createServer(app);
// Accept WebSocket upgrades on all paths and route by pathname inside 'connection'
const wss = new WebSocketServer({ server });

const twimlPath = join(__dirname, "twiml.xml");
const twimlTemplate = readFileSync(twimlPath, "utf-8");

// Health check endpoint for Railway
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Test OpenAI connection endpoint
app.get("/test-openai", authenticateApiKey, async (req, res) => {
  console.log("[Test] Testing OpenAI connection...");
  console.log("[Test] API Key present:", !!OPENAI_API_KEY);
  console.log("[Test] API Key prefix:", OPENAI_API_KEY?.substring(0, 20));
  
  const testModel = process.env.OPENAI_REALTIME_MODEL || MODEL_VERSIONS.latest;
  const agent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    lookup: (hostname, options, cb) => dns.lookup(hostname, { family: 4 }, cb as any),
  });

  const testWs = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(testModel)}`,
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
      agent,
    }
  );

  testWs.on("open", () => {
    console.log("[Test] OpenAI WebSocket opened successfully");
    res.json({ 
      success: true, 
      message: "OpenAI WebSocket connection successful",
      apiKeyPrefix: OPENAI_API_KEY?.substring(0, 10)
    });
    testWs.close();
  });

  testWs.on("error", (error: any) => {
    console.error("[Test] OpenAI WebSocket error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      apiKeyPrefix: OPENAI_API_KEY?.substring(0, 10)
    });
  });

  setTimeout(() => {
    if (testWs.readyState === WebSocket.CONNECTING) {
      testWs.close();
      res.status(504).json({ 
        success: false, 
        error: "Connection timeout",
        apiKeyPrefix: OPENAI_API_KEY?.substring(0, 10)
      });
    }
  }, 5000);
});

app.get("/public-url", (req, res) => {
  res.json({ publicUrl: PUBLIC_URL });
});

app.all("/twiml", validateTwilioSignature, (req, res) => {
  const wsUrl = new URL(PUBLIC_URL);
  wsUrl.protocol = "wss:";
  wsUrl.pathname = `/call`;

  // XML-escape the URL to prevent XML parsing errors
  const escapedUrl = wsUrl.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  const twimlContent = twimlTemplate.replace("{{WS_URL}}", escapedUrl);
  res.type("text/xml").send(twimlContent);
});

// Outbound call TwiML endpoint
app.all("/twiml-outbound", validateTwilioSignature, (req, res) => {
  const { sessionId, to, direction, config: configBase64 } = req.query;
  
  // Parse configuration from base64
  let config = {};
  if (configBase64) {
    try {
      config = JSON.parse(Buffer.from(configBase64 as string, "base64").toString());
    } catch (e) {
      console.error("Failed to parse config:", e);
    }
  }
  
  const wsUrl = new URL(PUBLIC_URL);
  wsUrl.protocol = "wss:";
  wsUrl.pathname = `/call`;
  wsUrl.searchParams.set("sessionId", sessionId as string);
  wsUrl.searchParams.set("to", to as string);
  wsUrl.searchParams.set("direction", direction as string);
  wsUrl.searchParams.set("config", configBase64 as string);

  console.log(`[TwiML] Generated WebSocket URL: ${wsUrl.toString()}`);
  // XML-escape the URL to prevent XML parsing errors
  const escapedUrl = wsUrl.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  const twimlContent = twimlTemplate.replace("{{WS_URL}}", escapedUrl);
  console.log(`[TwiML] Sending TwiML response for session ${sessionId}`);
  res.type("text/xml").send(twimlContent);
});

// New endpoint to list available tools (schemas)
app.options("/tools", (req, res) => {
  res.sendStatus(204);
});

app.get("/tools", (req, res) => {
  res.json(functions.map((f) => f.schema));
});

// API endpoint to initiate outbound calls
app.post("/api/call/outbound", authenticateApiKey, async (req, res): Promise<void> => {
  try {
    const { to, from, instructions, voice, temperature, maxResponseOutputTokens, tools } = req.body;
    
    if (!to) {
      res.status(400).json({ error: "'to' phone number is required" });
      return;
    }
    
    const outboundService = getOutboundCallService();
    const result = await outboundService.makeCall({
      to,
      from,
      instructions,
      voice,
      temperature,
      maxResponseOutputTokens,
      tools,
    });
    
    res.json(result);
  } catch (error: any) {
    console.error("Outbound call error:", error);
    res.status(500).json({ error: error.message || "Failed to initiate call" });
  }
});

// Get call status
app.get("/api/call/:callSid/status", authenticateApiKey, async (req, res): Promise<void> => {
  try {
    const { callSid } = req.params;
    const outboundService = getOutboundCallService();
    const status = await outboundService.getCallStatus(callSid);
    
    if (!status) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    
    res.json(status);
  } catch (error: any) {
    console.error("Get call status error:", error);
    res.status(500).json({ error: error.message || "Failed to get call status" });
  }
});

// End a call
app.post("/api/call/:callSid/end", authenticateApiKey, async (req, res) => {
  try {
    const { callSid } = req.params;
    const outboundService = getOutboundCallService();
    const success = await outboundService.endCall(callSid);
    
    res.json({ success });
  } catch (error: any) {
    console.error("End call error:", error);
    res.status(500).json({ error: error.message || "Failed to end call" });
  }
});

// List active calls
app.get("/api/calls/active", authenticateApiKey, async (req, res) => {
  try {
    const outboundService = getOutboundCallService();
    const calls = await outboundService.listActiveCalls();
    res.json(calls);
  } catch (error: any) {
    console.error("List calls error:", error);
    res.status(500).json({ error: error.message || "Failed to list calls" });
  }
});

// Get available phone numbers
app.get("/api/phone-numbers", authenticateApiKey, async (req, res) => {
  try {
    const outboundService = getOutboundCallService();
    const numbers = await outboundService.getAvailablePhoneNumbers();
    res.json(numbers);
  } catch (error: any) {
    console.error("Get phone numbers error:", error);
    res.status(500).json({ error: error.message || "Failed to get phone numbers" });
  }
});

// Get active sessions
app.get("/api/sessions", authenticateApiKey, (req, res) => {
  res.json(getActiveSessions());
});

// Get session transcriptions
app.get("/api/sessions/:sessionId/transcriptions", authenticateApiKey, (req, res) => {
  const { sessionId } = req.params;
  res.json(getSessionTranscriptions(sessionId));
});

// Get available voices
app.get("/api/voices", (req, res) => {
  res.json(AVAILABLE_VOICES);
});

// Get model versions
app.get("/api/models", (req, res) => {
  res.json(MODEL_VERSIONS);
});

// Webhook endpoints for Twilio callbacks
app.post("/call-status", validateTwilioSignature, (req, res) => {
  console.log("Call status update:", req.body);
  res.sendStatus(200);
});

app.post("/amd-status", validateTwilioSignature, (req, res) => {
  console.log("AMD status:", req.body);
  res.sendStatus(200);
});

// Recording status callback
app.post("/recording-status", validateTwilioSignature, async (req, res) => {
  console.log("Recording status:", req.body);
  const recordingManager = getRecordingManager();
  await recordingManager.handleRecordingStatus(req.body);
  res.sendStatus(200);
});

// Get recordings for a call
app.get("/api/call/:callSid/recordings", authenticateApiKey, async (req, res) => {
  try {
    const { callSid } = req.params;
    const recordingManager = getRecordingManager();
    const recordings = await recordingManager.getCallRecordings(callSid);
    res.json(recordings);
  } catch (error: any) {
    console.error("Get recordings error:", error);
    res.status(500).json({ error: error.message || "Failed to get recordings" });
  }
});

// Get a specific recording
app.get("/api/recording/:recordingSid", authenticateApiKey, async (req, res): Promise<void> => {
  try {
    const { recordingSid } = req.params;
    const recordingManager = getRecordingManager();
    const recording = await recordingManager.getRecording(recordingSid);
    
    if (!recording) {
      res.status(404).json({ error: "Recording not found" });
      return;
    }
    
    res.json(recording);
  } catch (error: any) {
    console.error("Get recording error:", error);
    res.status(500).json({ error: error.message || "Failed to get recording" });
  }
});

// Stream recording audio for playback
app.get("/api/recording/:recordingSid/audio", authenticateApiKey, (req, res): void => {
  try {
    const { recordingSid } = req.params;
    const recordingManager = getRecordingManager();
    const stream = recordingManager.getRecordingStream(recordingSid);
    
    if (!stream) {
      res.status(404).json({ error: "Recording audio not found" });
      return;
    }
    
    res.setHeader("Content-Type", "audio/mpeg");
    stream.pipe(res);
  } catch (error: any) {
    console.error("Stream recording error:", error);
    res.status(500).json({ error: error.message || "Failed to stream recording" });
  }
});

// Delete a recording
app.delete("/api/recording/:recordingSid", authenticateApiKey, async (req, res) => {
  try {
    const { recordingSid } = req.params;
    const recordingManager = getRecordingManager();
    const success = await recordingManager.deleteRecording(recordingSid);
    
    res.json({ success });
  } catch (error: any) {
    console.error("Delete recording error:", error);
    res.status(500).json({ error: error.message || "Failed to delete recording" });
  }
});

// Get all recordings
app.get("/api/recordings", authenticateApiKey, (req, res) => {
  try {
    const recordingManager = getRecordingManager();
    const recordings = recordingManager.getAllRecordings();
    res.json(recordings);
  } catch (error: any) {
    console.error("Get all recordings error:", error);
    res.status(500).json({ error: error.message || "Failed to get recordings" });
  }
});

let currentCall: WebSocket | null = null;
let currentLogs: WebSocket | null = null;

console.log("[WebSocket Server] WebSocket server initialized and waiting for connections");

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  console.log(`[WebSocket Server] ======== NEW CONNECTION ========`);
  console.log(`[WebSocket Server] Time: ${new Date().toISOString()}`);
  console.log(`[WebSocket Server] URL: ${req.url}`);
  console.log(`[WebSocket Server] Host: ${req.headers.host}`);
  console.log(`[WebSocket Server] User-Agent: ${req.headers['user-agent']}`);
  console.log(`[WebSocket Server] ================================`);
  
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);
  
  if (parts.length < 1) {
    ws.close();
    return;
  }

  const type = parts[0];
  
  // Authenticate WebSocket connections (except for Twilio calls)
  if (type === "logs" && !authenticateWebSocket(req.url || "")) {
    ws.close(1008, "Unauthorized");
    return;
  }

  if (type === "call") {
    console.log(`[WebSocket] New call connection received`);
    const query = url.searchParams;
    const sessionId = query.get("sessionId") || undefined;
    const to = query.get("to") || undefined;
    const direction = (query.get("direction") as "inbound" | "outbound") || "inbound";
    const configBase64 = query.get("config") || undefined;
    
    console.log(`[WebSocket] Call params - sessionId: ${sessionId}, to: ${to}, direction: ${direction}`);
    
    let config: any = {};
    if (configBase64) {
      try {
        config = JSON.parse(Buffer.from(configBase64, "base64").toString());
        console.log(`[WebSocket] Parsed config:`, config);
      } catch (e) {
        console.error("Failed to parse config:", e);
      }
    }
    
    if (currentCall) currentCall.close();
    currentCall = ws;
    console.log(`[WebSocket] Calling handleCallConnection with config`);
    // Pass configuration directly to handleCallConnection
    handleCallConnection(currentCall, OPENAI_API_KEY, sessionId, to, direction, config);
  } else if (type === "logs") {
    if (currentLogs) currentLogs.close();
    currentLogs = ws;
    handleFrontendConnection(currentLogs);
  } else {
    ws.close();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Health check available at: http://0.0.0.0:${PORT}/health`);
});
