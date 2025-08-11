import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  apiKey?: string;
}

// API Key authentication middleware
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"] as string || req.query.apiKey as string;
  const configuredApiKey = process.env.API_KEY;

  // Skip auth in development - allow all requests
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  if (!apiKey) {
    res.status(401).json({ error: "API key required" });
    return;
  }

  if (!configuredApiKey) {
    res.status(500).json({ error: "Server API key not configured" });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (!safeCompare(apiKey, configuredApiKey)) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  (req as any).apiKey = apiKey;
  next();
}

// Twilio webhook signature validation
export function validateTwilioSignature(req: Request, res: Response, next: NextFunction): void {
  const twilioSignature = req.headers["x-twilio-signature"] as string;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  // Skip validation in development
  if (process.env.NODE_ENV === "development") {
    return next();
  }

  if (!twilioSignature || !authToken) {
    res.status(401).json({ error: "Invalid Twilio signature" });
    return;
  }

  const url = `${process.env.PUBLIC_URL}${req.originalUrl}`;
  const params = req.body;

  if (!isValidTwilioSignature(authToken, twilioSignature, url, params)) {
    res.status(401).json({ error: "Invalid Twilio signature" });
    return;
  }

  next();
}

// Rate limiting middleware
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.headers["x-forwarded-for"] as string || "unknown";
    const now = Date.now();
    
    const record = rateLimitStore.get(key);
    
    if (!record || record.resetTime < now) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set("Retry-After", retryAfter.toString());
      res.status(429).json({ 
        error: "Too many requests",
        retryAfter 
      });
      return;
    }
    
    record.count++;
    next();
  };
}

// CORS configuration
export function getCorsOptions() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"];
  
  // In development, allow all localhost origins
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:3000", "http://localhost:3001", "http://localhost:3002");
  }
  
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);
      
      // Allow any localhost origin in development
      if (process.env.NODE_ENV !== "production" && origin.startsWith("http://localhost:")) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  };
}

// WebSocket authentication
export function authenticateWebSocket(url: string): boolean {
  const urlObj = new URL(url, "http://localhost");
  const apiKey = urlObj.searchParams.get("apiKey");
  const configuredApiKey = process.env.API_KEY;

  // Skip auth in development if no API key is configured
  if (process.env.NODE_ENV === "development" && !configuredApiKey) {
    return true;
  }

  if (!apiKey || !configuredApiKey) {
    return false;
  }

  return safeCompare(apiKey, configuredApiKey);
}

// Helper function for constant-time string comparison
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

// Validate Twilio signature
function isValidTwilioSignature(
  authToken: string,
  twilioSignature: string,
  url: string,
  params: any
): boolean {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const signature = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  return safeCompare(signature, twilioSignature);
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date().toISOString()
    });
  });
  
  next();
}