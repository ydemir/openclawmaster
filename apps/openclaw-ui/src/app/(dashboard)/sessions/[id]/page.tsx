import { resolveSessionKeyFromSessionId } from "@/lib/openclaw-fs";
import { ChatView } from "./chat-view";

type SessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  const sessionId = decodeURIComponent(id);
  const sessionKey = resolveSessionKeyFromSessionId(sessionId);

  if (!sessionKey) {
    return (
      <div style={{ padding: "1.5rem 2rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>Session bulunamadi</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          `sessionId` ile eslesen bir `sessionKey` bulunamadi: <code>{sessionId}</code>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem 2rem" }}>
      <ChatView sessionId={sessionId} sessionKey={sessionKey} />
    </div>
  );
}

