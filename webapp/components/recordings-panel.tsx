"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Pause,
  Download,
  Trash2,
  Mic,
  Clock,
  Phone,
  FileAudio,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Recording {
  sid: string;
  callSid: string;
  duration: string;
  dateCreated: string;
  status: string;
  mediaUrl?: string;
  transcriptions?: Array<{
    timestamp: number;
    role: "user" | "assistant";
    text: string;
  }>;
}

interface RecordingsPanelProps {
  callSid?: string;
  showAll?: boolean;
}

const RecordingsPanel: React.FC<RecordingsPanelProps> = ({
  callSid,
  showAll = false,
}) => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchRecordings();
    const interval = setInterval(fetchRecordings, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [callSid, showAll]);

  const fetchRecordings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
      
      let url = showAll 
        ? `${apiUrl}/api/recordings`
        : `${apiUrl}/api/call/${callSid}/recordings`;
      
      const response = await fetch(url, {
        headers: {
          "X-API-Key": apiKey,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecordings(data);
      } else {
        throw new Error("Failed to fetch recordings");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load recordings");
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (recordingSid: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
    
    if (playingId === recordingSid) {
      // Pause if already playing
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
      }
    } else {
      // Play new recording
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(`${apiUrl}/api/recording/${recordingSid}/audio?apiKey=${apiKey}`);
      audio.play();
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
      setPlayingId(recordingSid);
    }
  };

  const handleDownload = async (recording: Recording) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
    
    try {
      const response = await fetch(
        `${apiUrl}/api/recording/${recording.sid}/audio?apiKey=${apiKey}`
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recording_${recording.callSid}_${recording.sid}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to download recording:", err);
    }
  };

  const handleDelete = async (recordingSid: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
    
    if (confirm("Are you sure you want to delete this recording?")) {
      try {
        const response = await fetch(
          `${apiUrl}/api/recording/${recordingSid}`,
          {
            method: "DELETE",
            headers: {
              "X-API-Key": apiKey,
            },
          }
        );
        
        if (response.ok) {
          fetchRecordings();
        }
      } catch (err) {
        console.error("Failed to delete recording:", err);
      }
    }
  };

  const formatDuration = (seconds: string | number) => {
    const sec = typeof seconds === "string" ? parseInt(seconds) : seconds;
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileAudio className="h-5 w-5" />
          Call Recordings
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {loading && recordings.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : recordings.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No recordings available
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div
                  key={recording.sid}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Recording {recording.sid.slice(-8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePlay(recording.sid)}
                      >
                        {playingId === recording.sid ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(recording)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(recording.sid)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(recording.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {recording.callSid.slice(-8)}
                    </span>
                    <span>{formatDate(recording.dateCreated)}</span>
                  </div>
                  
                  {recording.transcriptions && recording.transcriptions.length > 0 && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-start text-xs"
                        onClick={() =>
                          setExpandedId(
                            expandedId === recording.sid ? null : recording.sid
                          )
                        }
                      >
                        {expandedId === recording.sid ? "Hide" : "Show"}{" "}
                        Transcript ({recording.transcriptions.length} messages)
                      </Button>
                      
                      {expandedId === recording.sid && (
                        <div className="bg-muted/50 rounded p-2 max-h-48 overflow-y-auto">
                          <div className="space-y-2 text-xs">
                            {recording.transcriptions.map((trans, idx) => (
                              <div
                                key={idx}
                                className={`p-2 rounded ${
                                  trans.role === "user"
                                    ? "bg-blue-100 dark:bg-blue-900/20"
                                    : "bg-green-100 dark:bg-green-900/20"
                                }`}
                              >
                                <div className="font-medium capitalize mb-1">
                                  {trans.role}
                                </div>
                                <div className="text-muted-foreground">
                                  {trans.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default RecordingsPanel;