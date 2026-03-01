"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useRpc } from "@/hooks/use-rpc";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

type ChatViewProps = {
  sessionId: string;
  sessionKey: string;
};

export function ChatView({ sessionId, sessionKey }: ChatViewProps) {
  const { rpc } = useRpc();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const header = useMemo(
    () => (
      <div style={{ borderBottom: "1px solid var(--border)", padding: "0.8rem 1rem" }}>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>Session Chat</div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          sessionId: {sessionId}
        </div>
      </div>
    ),
    [sessionId],
  );

  useEffect(() => {
    let disposed = false;

    async function loadHistory() {
      try {
        const response = (await rpc("chat.history", { sessionKey })) as { messages?: ChatMessage[] };
        if (!disposed) setMessages(response?.messages ?? []);
      } catch {
        if (!disposed) {
          toast.error("Sohbet gecmisi yuklenemedi");
        }
      }
    }

    loadHistory();
    return () => {
      disposed = true;
    };
  }, [rpc, sessionKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const result = (await rpc("chat.send", { sessionKey, text })) as { reply?: string };
      if (result?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: result.reply ?? "" }]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "RPC failed";
      toast.error(`RPC error: ${message}`);
      setMessages((prev) => [...prev, { role: "assistant", content: `RPC error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "0.8rem",
        backgroundColor: "var(--card)",
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {header}

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "grid", gap: "0.8rem" }}>
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          return (
            <div
              key={`${message.role}-${index}`}
              style={{
                justifySelf: isUser ? "end" : "start",
                maxWidth: "70%",
                padding: "0.6rem 0.8rem",
                borderRadius: isUser ? "0.8rem 0.8rem 0.2rem 0.8rem" : "0.8rem 0.8rem 0.8rem 0.2rem",
                backgroundColor: isUser ? "rgba(255,59,48,0.18)" : "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "0.87rem",
              }}
            >
              {message.content}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: "1px solid var(--border)", padding: "0.8rem", display: "flex", gap: "0.6rem" }}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Mesaj yaz..."
          style={{
            flex: 1,
            minHeight: "58px",
            resize: "none",
            borderRadius: "0.6rem",
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface-elevated)",
            color: "var(--text-primary)",
            padding: "0.6rem",
            fontSize: "0.85rem",
          }}
        />
        <button
          onClick={() => void send()}
          disabled={loading}
          className="btn-primary"
          style={{ width: "44px", height: "44px", padding: 0 }}
          aria-label="Send"
        >
          <Send style={{ width: "16px", height: "16px" }} />
        </button>
      </div>
    </div>
  );
}
