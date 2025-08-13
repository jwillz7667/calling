"use client";

import React, { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EventLog {
  type: string;
  timestamp: number | string;
  _metadata?: {
    timestamp: string;
    sessionId: string;
    eventType: string;
    summary: any;
  };
  [key: string]: any;
}

interface EventLogPanelProps {
  ws: WebSocket | null;
}

const EventLogPanel: React.FC<EventLogPanelProps> = ({ ws }) => {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [openAIStatus, setOpenAIStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Track OpenAI connection status
        if (data.type === "openai.connection.established") {
          setOpenAIStatus("connected");
        } else if (data.type === "model.websocket_error") {
          setOpenAIStatus("disconnected");
        }
        
        // Add event to log
        setEvents(prev => [...prev.slice(-200), data]); // Keep last 200 events
      } catch (err) {
        console.error("Failed to parse event:", err);
      }
    };

    const handleOpen = () => {
      setConnectionStatus("connected");
    };

    const handleClose = () => {
      setConnectionStatus("disconnected");
      setOpenAIStatus("disconnected");
    };

    const handleError = () => {
      setConnectionStatus("disconnected");
      setOpenAIStatus("disconnected");
    };

    ws.addEventListener("message", handleMessage);
    ws.addEventListener("open", handleOpen);
    ws.addEventListener("close", handleClose);
    ws.addEventListener("error", handleError);

    // Set initial status
    if (ws.readyState === WebSocket.OPEN) {
      setConnectionStatus("connected");
    } else if (ws.readyState === WebSocket.CONNECTING) {
      setConnectionStatus("connecting");
    }

    return () => {
      ws.removeEventListener("message", handleMessage);
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("close", handleClose);
      ws.removeEventListener("error", handleError);
    };
  }, [ws]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const getEventColor = (type: string): string => {
    if (type.includes("error")) return "destructive";
    if (type.includes("session")) return "default";
    if (type.includes("audio")) return "secondary";
    if (type.includes("conversation")) return "outline";
    if (type.includes("response")) return "default";
    return "secondary";
  };

  const getEventEmoji = (type: string): string => {
    const emojiMap: Record<string, string> = {
      "session.created": "🎉",
      "session.updated": "🔄",
      "conversation.item.created": "💬",
      "conversation.item.input_audio_transcription.completed": "📝",
      "input_audio_buffer.speech_started": "🎤",
      "input_audio_buffer.speech_stopped": "🔇",
      "input_audio_buffer.committed": "✅",
      "response.audio.delta": "🔊",
      "response.audio_transcript.delta": "📋",
      "response.output_item.done": "✔️",
      "response.done": "🏁",
      "error": "❌",
      "rate_limits.updated": "⚠️",
      "openai.connection.established": "✅",
      "model.websocket_error": "❌"
    };
    return emojiMap[type] || "📡";
  };

  const filteredEvents = events.filter(event => {
    if (filter === "all") return true;
    if (filter === "errors") return event.type?.includes("error");
    if (filter === "audio") return event.type?.includes("audio");
    if (filter === "conversation") return event.type?.includes("conversation");
    return true;
  });

  const formatTimestamp = (timestamp: string | number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { 
      hour12: false, 
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit",
      fractionalSecondDigits: 3 
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">OpenAI Realtime Events</h3>
          <div className="flex gap-2">
            <Badge variant={connectionStatus === "connected" ? "default" : "secondary"}>
              WS: {connectionStatus}
            </Badge>
            <Badge variant={openAIStatus === "connected" ? "default" : openAIStatus === "connecting" ? "secondary" : "destructive"}>
              OpenAI: {openAIStatus}
            </Badge>
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filter === "errors" ? "default" : "outline"}
              onClick={() => setFilter("errors")}
            >
              Errors
            </Button>
            <Button
              size="sm"
              variant={filter === "audio" ? "default" : "outline"}
              onClick={() => setFilter("audio")}
            >
              Audio
            </Button>
            <Button
              size="sm"
              variant={filter === "conversation" ? "default" : "outline"}
              onClick={() => setFilter("conversation")}
            >
              Conversation
            </Button>
          </div>
          
          <div className="ml-auto">
            <Button
              size="sm"
              variant={autoScroll ? "default" : "outline"}
              onClick={() => setAutoScroll(!autoScroll)}
            >
              {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
            </Button>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No events yet. Waiting for call activity...
            </div>
          ) : (
            filteredEvents.map((event, index) => {
              const metadata = event._metadata;
              const timestamp = metadata?.timestamp || event.timestamp;
              
              return (
                <div
                  key={index}
                  className="flex gap-2 items-start text-xs font-mono p-2 bg-gray-50 rounded hover:bg-gray-100"
                >
                  <span className="text-gray-500 min-w-[80px]">
                    {formatTimestamp(timestamp)}
                  </span>
                  <span className="text-lg">
                    {getEventEmoji(event.type)}
                  </span>
                  <div className="flex-1">
                    <Badge variant={getEventColor(event.type) as any} className="mb-1">
                      {event.type}
                    </Badge>
                    {metadata?.summary && (
                      <div className="text-gray-600 mt-1">
                        {JSON.stringify(metadata.summary, null, 2)}
                      </div>
                    )}
                    {event.error && (
                      <div className="text-red-600 mt-1">
                        Error: {event.error.message || JSON.stringify(event.error)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      
      <div className="p-2 border-t text-xs text-gray-500 text-center">
        {filteredEvents.length} events {filter !== "all" && `(filtered: ${filter})`}
      </div>
    </Card>
  );
};

export default EventLogPanel;