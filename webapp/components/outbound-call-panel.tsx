"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Phone,
  PhoneOff,
  PhoneCall,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OutboundCallPanelProps {
  selectedPhoneNumber?: string;
  sessionConfig?: any;
}

interface ActiveCall {
  sid: string;
  to: string;
  from: string;
  status: string;
  direction: string;
  duration: string;
  startTime: string;
}

const OutboundCallPanel: React.FC<OutboundCallPanelProps> = ({
  selectedPhoneNumber,
  sessionConfig,
}) => {
  const [toNumber, setToNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);

  // Fetch available phone numbers on mount
  useEffect(() => {
    fetchAvailableNumbers();
    fetchActiveCalls();
    const interval = setInterval(fetchActiveCalls, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);


  const fetchAvailableNumbers = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
      const response = await fetch(`${apiUrl}/api/phone-numbers`, {
        headers: {
          "X-API-Key": apiKey,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableNumbers(data.map((n: any) => n.phoneNumber));
      }
    } catch (err) {
      console.error("Failed to fetch phone numbers:", err);
    }
  };

  const fetchActiveCalls = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
      const response = await fetch(`${apiUrl}/api/calls/active`, {
        headers: {
          "X-API-Key": apiKey,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setActiveCalls(data);
      }
    } catch (err) {
      console.error("Failed to fetch active calls:", err);
    }
  };

  const formatPhoneNumber = (number: string): string => {
    // Remove all non-digit characters
    const digits = number.replace(/\D/g, "");
    
    // Add country code if not present
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits[0] === "1") {
      return `+${digits}`;
    } else if (digits.startsWith("+")) {
      return number;
    }
    
    return `+${digits}`;
  };

  const handleMakeCall = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const formattedTo = formatPhoneNumber(toNumber);
    
    if (!formattedTo) {
      setError("Please enter a valid phone number");
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
      const response = await fetch(`${apiUrl}/api/call/outbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          to: formattedTo,
          from: "+17633636681", // Your Twilio number
          instructions: sessionConfig?.instructions || "You are a helpful AI assistant.",
          voice: sessionConfig?.voice || "ash",
          temperature: sessionConfig?.temperature || 0.8,
          maxResponseOutputTokens: sessionConfig?.max_response_output_tokens || 4096,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(`Call initiated successfully! Call SID: ${data.callSid}`);
        setToNumber("");
        fetchActiveCalls();
      } else {
        setError(data.error || "Failed to initiate call");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndCall = async (callSid: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
      const response = await fetch(
        `${apiUrl}/api/call/${callSid}/end`,
        {
          method: "POST",
        }
      );
      
      if (response.ok) {
        fetchActiveCalls();
      }
    } catch (err) {
      console.error("Failed to end call:", err);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Outbound Calling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">To Number</label>
          <Input
            type="tel"
            placeholder="+1234567890"
            value={toNumber}
            onChange={(e) => setToNumber(e.target.value)}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Enter the phone number to call (E.164 format)
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Using voice, temperature, and instructions from Session Configuration panel
          </p>
        </div>

        <Button
          className="w-full"
          onClick={handleMakeCall}
          disabled={isLoading || !toNumber}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initiating Call...
            </>
          ) : (
            <>
              <PhoneCall className="mr-2 h-4 w-4" />
              Make Call
            </>
          )}
        </Button>

        {activeCalls.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Active Calls</h3>
            <div className="space-y-2">
              {activeCalls.map((call) => (
                <div
                  key={call.sid}
                  className="flex items-center justify-between p-2 border rounded-md"
                >
                  <div className="text-sm">
                    <div className="font-medium">{call.to}</div>
                    <div className="text-xs text-muted-foreground">
                      {call.status} • {call.duration}s
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleEndCall(call.sid)}
                  >
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OutboundCallPanel;