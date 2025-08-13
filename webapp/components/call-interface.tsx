"use client";

import React, { useState, useEffect } from "react";
import TopBar from "@/components/top-bar";
import ChecklistAndConfig from "@/components/checklist-and-config";
import SessionConfigurationPanel from "@/components/session-configuration-panel";
import Transcript from "@/components/transcript";
import FunctionCallsPanel from "@/components/function-calls-panel";
import { Item } from "@/components/types";
import handleRealtimeEvent from "@/lib/handle-realtime-event";
import PhoneNumberChecklist from "@/components/phone-number-checklist";
import RecordingsPanel from "@/components/recordings-panel";
import OutboundCallPanel from "@/components/outbound-call-panel";
import EventLogPanel from "@/components/event-log-panel";

const CallInterface = () => {
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState("");
  const [allConfigsReady, setAllConfigsReady] = useState(true); // Skip checklist
  const [items, setItems] = useState<Item[]>([]);
  const [callStatus, setCallStatus] = useState("disconnected");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [activeTab, setActiveTab] = useState<"functions" | "recordings" | "outbound" | "events">("events");
  const [sessionConfig, setSessionConfig] = useState<any>({});

  useEffect(() => {
    // Auto-connect without waiting for checklist
    if (!ws) {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8081";
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
      const wsUrlWithAuth = apiKey ? `${wsUrl}/logs?apiKey=${apiKey}` : `${wsUrl}/logs`;
      const newWs = new WebSocket(wsUrlWithAuth);

      newWs.onopen = () => {
        console.log("Connected to logs websocket");
        setCallStatus("connected");
      };

      newWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Enhanced logging for OpenAI connection events
        if (data.type === "openai.connection.established") {
          console.log("✅ OpenAI Realtime API Connected!", {
            model: data.model,
            sessionId: data.sessionId,
            timestamp: data.timestamp
          });
        } else if (data.type === "model.websocket_error") {
          console.error("❌ OpenAI Connection Error:", data.error);
        } else if (data.type === "session.created") {
          console.log("🎉 OpenAI Session Created");
        } else if (data.type === "error") {
          console.error("❌ OpenAI Error:", data.error);
        } else if (data._metadata) {
          // Log events with metadata
          console.log(`[${data._metadata.eventType}]`, data._metadata.summary);
        } else {
          console.log("Received event:", data.type);
        }
        
        handleRealtimeEvent(data, setItems);
      };

      newWs.onclose = () => {
        console.log("Logs websocket disconnected");
        setWs(null);
        setCallStatus("disconnected");
      };

      setWs(newWs);
    }
  }, [ws]); // Removed allConfigsReady dependency

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* Checklist disabled - auto-connecting */}
      <TopBar />
      <div className="flex-grow p-4 h-full overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left Column */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            <SessionConfigurationPanel
              callStatus={callStatus}
              onSave={(config) => {
                setSessionConfig(config); // Store config for outbound calls
                if (ws && ws.readyState === WebSocket.OPEN) {
                  const updateEvent = {
                    type: "session.update",
                    session: {
                      ...config,
                    },
                  };
                  console.log("Sending update event:", updateEvent);
                  ws.send(JSON.stringify(updateEvent));
                }
              }}
            />
          </div>

          {/* Middle Column: Transcript */}
          <div className="col-span-6 flex flex-col gap-4 h-full overflow-hidden">
            {/* PhoneNumberChecklist removed - auto-connecting */}
            <Transcript items={items} />
          </div>

          {/* Right Column: Tabbed Panel */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            {/* Tab Buttons */}
            <div className="flex gap-2 mb-3 border-b">
              <button
                onClick={() => setActiveTab("events")}
                className={`px-3 py-2 font-medium transition-colors ${
                  activeTab === "events"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Events
              </button>
              <button
                onClick={() => setActiveTab("recordings")}
                className={`px-3 py-2 font-medium transition-colors ${
                  activeTab === "recordings"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Recordings
              </button>
              <button
                onClick={() => setActiveTab("outbound")}
                className={`px-3 py-2 font-medium transition-colors ${
                  activeTab === "outbound"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Outbound
              </button>
              <button
                onClick={() => setActiveTab("functions")}
                className={`px-3 py-2 font-medium transition-colors ${
                  activeTab === "functions"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Functions
              </button>
            </div>
            
            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "events" && (
                <EventLogPanel ws={ws} />
              )}
              {activeTab === "recordings" && (
                <RecordingsPanel showAll={true} />
              )}
              {activeTab === "outbound" && (
                <OutboundCallPanel 
                  selectedPhoneNumber={selectedPhoneNumber}
                  sessionConfig={sessionConfig}
                />
              )}
              {activeTab === "functions" && (
                <FunctionCallsPanel items={items} ws={ws} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;
