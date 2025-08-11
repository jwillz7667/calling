import { Twilio } from "twilio";
import { v4 as uuidv4 } from "uuid";

interface OutboundCallConfig {
  to: string;
  from: string;
  instructions?: string;
  voice?: string;
  temperature?: number;
  maxResponseOutputTokens?: number | "inf";
  tools?: any[];
}

interface OutboundCallResult {
  success: boolean;
  callSid?: string;
  error?: string;
}

export class OutboundCallService {
  private twilioClient: Twilio;
  private accountSid: string;
  private authToken: string;
  private twilioPhoneNumber: string;
  private publicUrl: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || "";
    this.publicUrl = process.env.PUBLIC_URL || "";

    if (!this.accountSid || !this.authToken) {
      throw new Error("Twilio credentials not configured");
    }

    if (!this.twilioPhoneNumber) {
      throw new Error("TWILIO_PHONE_NUMBER not configured");
    }

    this.twilioClient = new Twilio(this.accountSid, this.authToken);
  }

  async makeCall(config: OutboundCallConfig): Promise<OutboundCallResult> {
    try {
      // Validate phone number format
      if (!this.isValidPhoneNumber(config.to)) {
        return {
          success: false,
          error: "Invalid phone number format. Use E.164 format (e.g., +1234567890)",
        };
      }

      // Generate unique session ID for this call
      const sessionId = uuidv4();

      // Build TwiML URL with session parameters
      const twimlUrl = new URL(`${this.publicUrl}/twiml-outbound`);
      twimlUrl.searchParams.set("sessionId", sessionId);
      twimlUrl.searchParams.set("to", config.to);
      twimlUrl.searchParams.set("direction", "outbound");
      
      // Pass configuration as base64 encoded JSON to avoid URL length issues
      const configData = {
        instructions: config.instructions,
        voice: config.voice,
        temperature: config.temperature,
        max_response_output_tokens: config.maxResponseOutputTokens,
        tools: config.tools,
      };
      twimlUrl.searchParams.set("config", Buffer.from(JSON.stringify(configData)).toString("base64"));

      // Create the call with recording enabled
      const call = await this.twilioClient.calls.create({
        to: config.to,
        from: config.from || this.twilioPhoneNumber,
        url: twimlUrl.toString(),
        method: "POST",
        statusCallback: `${this.publicUrl}/call-status`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        record: true, // Enable recording
        recordingChannels: "dual" as any, // Record both sides separately
        recordingStatusCallback: `${this.publicUrl}/recording-status`,
        recordingStatusCallbackMethod: "POST",
        recordingStatusCallbackEvent: ["in-progress", "completed", "failed"],
        machineDetection: "Enable", // Detect answering machines
        machineDetectionTimeout: 3000,
        asyncAmd: "true" as any,
        asyncAmdStatusCallback: `${this.publicUrl}/amd-status`,
        asyncAmdStatusCallbackMethod: "POST",
      });

      console.log(`Outbound call initiated: ${call.sid} to ${config.to}`);

      return {
        success: true,
        callSid: call.sid,
      };
    } catch (error: any) {
      console.error("Failed to make outbound call:", error);
      return {
        success: false,
        error: error.message || "Failed to initiate call",
      };
    }
  }

  async getCallStatus(callSid: string) {
    try {
      const call = await this.twilioClient.calls(callSid).fetch();
      
      // Get recordings for this call
      const recordings = await this.twilioClient.recordings
        .list({ callSid, limit: 10 });
      
      return {
        status: call.status,
        duration: call.duration,
        direction: call.direction,
        to: call.to,
        from: call.from,
        startTime: call.startTime,
        endTime: call.endTime,
        answeredBy: call.answeredBy,
        recordings: recordings.map(r => ({
          sid: r.sid,
          duration: r.duration,
          dateCreated: r.dateCreated,
          uri: r.uri,
          status: r.status,
          channels: r.channels,
          mediaUrl: `https://api.twilio.com${r.uri.replace(".json", ".mp3")}`
        }))
      };
    } catch (error: any) {
      console.error("Failed to get call status:", error);
      return null;
    }
  }

  async endCall(callSid: string): Promise<boolean> {
    try {
      await this.twilioClient.calls(callSid).update({
        status: "completed",
      });
      console.log(`Call ${callSid} ended`);
      return true;
    } catch (error: any) {
      console.error("Failed to end call:", error);
      return false;
    }
  }

  async listActiveCalls() {
    try {
      const calls = await this.twilioClient.calls.list({
        status: "in-progress",
        limit: 20,
      });

      return calls.map((call) => ({
        sid: call.sid,
        to: call.to,
        from: call.from,
        status: call.status,
        direction: call.direction,
        duration: call.duration,
        startTime: call.startTime,
      }));
    } catch (error: any) {
      console.error("Failed to list active calls:", error);
      return [];
    }
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  // Get configured Twilio phone numbers
  async getAvailablePhoneNumbers() {
    try {
      const numbers = await this.twilioClient.incomingPhoneNumbers.list({
        limit: 20,
      });

      return numbers.map((number) => ({
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        capabilities: {
          voice: number.capabilities.voice,
          sms: number.capabilities.sms,
          mms: number.capabilities.mms,
        },
        voiceUrl: number.voiceUrl,
      }));
    } catch (error: any) {
      console.error("Failed to get available phone numbers:", error);
      return [];
    }
  }
}

// Singleton instance
let outboundCallService: OutboundCallService | null = null;

export function getOutboundCallService(): OutboundCallService {
  if (!outboundCallService) {
    outboundCallService = new OutboundCallService();
  }
  return outboundCallService;
}