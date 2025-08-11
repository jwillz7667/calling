import { Twilio } from "twilio";
import { getSessionTranscriptions } from "./sessionManager";
import fs from "fs";
import path from "path";
import https from "https";

interface Recording {
  sid: string;
  callSid: string;
  duration: string;
  dateCreated: Date;
  status: string;
  mediaUrl: string;
  transcriptions?: any[];
  localPath?: string;
}

export class RecordingManager {
  private twilioClient: Twilio;
  private recordingsDir: string;
  private recordings: Map<string, Recording> = new Map();

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    const authToken = process.env.TWILIO_AUTH_TOKEN || "";

    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials not configured");
    }

    this.twilioClient = new Twilio(accountSid, authToken);
    
    // Create recordings directory if it doesn't exist
    this.recordingsDir = path.join(process.cwd(), "recordings");
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  // Handle recording status callback from Twilio
  async handleRecordingStatus(data: any) {
    const { RecordingSid, CallSid, RecordingStatus, RecordingDuration, RecordingUrl } = data;
    
    console.log(`Recording ${RecordingSid} status: ${RecordingStatus}`);
    
    if (RecordingStatus === "completed") {
      // Store recording metadata
      const recording: Recording = {
        sid: RecordingSid,
        callSid: CallSid,
        duration: RecordingDuration,
        dateCreated: new Date(),
        status: RecordingStatus,
        mediaUrl: RecordingUrl + ".mp3"
      };
      
      this.recordings.set(RecordingSid, recording);
      
      // Download recording for local storage
      await this.downloadRecording(recording);
      
      // Associate transcriptions with recording
      const transcriptions = getSessionTranscriptions(CallSid);
      if (transcriptions.length > 0) {
        recording.transcriptions = transcriptions;
      }
    }
  }

  // Download recording from Twilio
  private async downloadRecording(recording: Recording): Promise<void> {
    return new Promise((resolve, reject) => {
      const filename = `${recording.callSid}_${recording.sid}.mp3`;
      const localPath = path.join(this.recordingsDir, filename);
      const file = fs.createWriteStream(localPath);
      
      // Add auth to URL
      const url = new URL(recording.mediaUrl);
      url.username = process.env.TWILIO_ACCOUNT_SID || "";
      url.password = process.env.TWILIO_AUTH_TOKEN || "";
      
      https.get(url.toString(), (response) => {
        response.pipe(file);
        
        file.on("finish", () => {
          file.close();
          recording.localPath = localPath;
          console.log(`Recording downloaded: ${filename}`);
          resolve();
        });
      }).on("error", (err) => {
        fs.unlink(localPath, () => {}); // Delete the file on error
        console.error("Failed to download recording:", err);
        reject(err);
      });
    });
  }

  // Get all recordings for a call
  async getCallRecordings(callSid: string): Promise<Recording[]> {
    try {
      const twilioRecordings = await this.twilioClient.recordings.list({
        callSid,
        limit: 20
      });
      
      const recordings: Recording[] = [];
      
      for (const rec of twilioRecordings) {
        // Check if we already have this recording locally
        let recording = this.recordings.get(rec.sid);
        
        if (!recording) {
          recording = {
            sid: rec.sid,
            callSid: rec.callSid,
            duration: rec.duration,
            dateCreated: rec.dateCreated,
            status: rec.status,
            mediaUrl: `https://api.twilio.com${rec.uri.replace(".json", ".mp3")}`
          };
          
          // Try to download if not already local
          await this.downloadRecording(recording);
          this.recordings.set(rec.sid, recording);
        }
        
        // Add transcriptions
        const transcriptions = getSessionTranscriptions(callSid);
        if (transcriptions.length > 0) {
          recording.transcriptions = transcriptions;
        }
        
        recordings.push(recording);
      }
      
      return recordings;
    } catch (error: any) {
      console.error("Failed to get call recordings:", error);
      return [];
    }
  }

  // Get a specific recording
  async getRecording(recordingSid: string): Promise<Recording | null> {
    // Check local cache first
    let recording = this.recordings.get(recordingSid);
    if (recording) {
      return recording;
    }
    
    try {
      const twilioRecording = await this.twilioClient.recordings(recordingSid).fetch();
      
      recording = {
        sid: twilioRecording.sid,
        callSid: twilioRecording.callSid,
        duration: twilioRecording.duration,
        dateCreated: twilioRecording.dateCreated,
        status: twilioRecording.status,
        mediaUrl: `https://api.twilio.com${twilioRecording.uri.replace(".json", ".mp3")}`
      };
      
      await this.downloadRecording(recording);
      this.recordings.set(recordingSid, recording);
      
      return recording;
    } catch (error: any) {
      console.error("Failed to get recording:", error);
      return null;
    }
  }

  // Delete a recording
  async deleteRecording(recordingSid: string): Promise<boolean> {
    try {
      // Delete from Twilio
      await this.twilioClient.recordings(recordingSid).remove();
      
      // Delete local file if exists
      const recording = this.recordings.get(recordingSid);
      if (recording?.localPath && fs.existsSync(recording.localPath)) {
        fs.unlinkSync(recording.localPath);
      }
      
      // Remove from cache
      this.recordings.delete(recordingSid);
      
      console.log(`Recording ${recordingSid} deleted`);
      return true;
    } catch (error: any) {
      console.error("Failed to delete recording:", error);
      return false;
    }
  }

  // Get recording file stream for playback
  getRecordingStream(recordingSid: string): fs.ReadStream | null {
    const recording = this.recordings.get(recordingSid);
    
    if (recording?.localPath && fs.existsSync(recording.localPath)) {
      return fs.createReadStream(recording.localPath);
    }
    
    return null;
  }

  // Get all recordings with metadata
  getAllRecordings(): Recording[] {
    return Array.from(this.recordings.values());
  }
}

// Singleton instance
let recordingManager: RecordingManager | null = null;

export function getRecordingManager(): RecordingManager {
  if (!recordingManager) {
    recordingManager = new RecordingManager();
  }
  return recordingManager;
}