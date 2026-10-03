import { useCallback, useEffect, useRef, useState } from "react";
import { listMessages, sendMessage, watchMessages } from "./server";
import type { ChatMessage, PresenceUser } from "./types";

export type LiveStatus = "idle" | "connecting" | "live" | "reconnecting";

type Optimistic = ChatMessage & { pending?: boolean };

function isUnauthorized(err: unknown): boolean {
  return err instanceof Error && err.message === "Unauthorized";
}

export function useLiveMessages(roomId: number | null, userId: string | null) {
  const [messages, setMessages] = useState<Optimistic[]>([]);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastIdRef = useRef(0);
  const seenRef = useRef(new Set<number>());

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const map = new Map<number, Optimistic>();
      for (const m of prev) {
        if (m.id > 0) map.set(m.id, m);
      }
      for (const m of incoming) {
        if (m.id <= 0) continue;
        map.set(m.id, m);
        seenRef.current.add(m.id);
        if (m.id > lastIdRef.current) lastIdRef.current = m.id;
      }
      return [...map.values()].sort((a, b) => a.id - b.id);
    });
  }, []);

  useEffect(() => {
    if (roomId == null || !userId) {
      setMessages([]);
      setPresence([]);
      setStatus("idle");
      return;
    }

    let alive = true;
    let delay = 500;
    lastIdRef.current = 0;
    seenRef.current = new Set();
    setMessages([]);
    setPresence([]);
    setError(null);
    setStatus("connecting");

    const channel = new BroadcastChannel(`relay-room-${roomId}`);
    channel.onmessage = (event: MessageEvent) => {
      if (!alive) return;
      const payload = event.data as { type?: string; message?: ChatMessage };
      if (payload?.type === "message" && payload.message) merge([payload.message]);
    };

    async function loadHistory() {
      const history = await listMessages({ data: { roomId: roomId!, limit: 50 } });
      if (!alive) return;
      merge(history);
    }

    async function loop() {
      try {
        await loadHistory();
        if (!alive) return;
        setStatus("live");
      } catch (err) {
        if (!alive) return;
        if (isUnauthorized(err)) {
          setError("Unauthorized");
          setStatus("idle");
          return;
        }
        setStatus("reconnecting");
      }

      while (alive) {
        try {
          const result = await watchMessages({
            data: { roomId: roomId!, afterId: lastIdRef.current },
          });
          if (!alive) return;
          if (result.messages.length) merge(result.messages);
          setPresence(result.presence);
          setStatus("live");
          setError(null);
          delay = 500;
        } catch (err) {
          if (!alive) return;
          if (isUnauthorized(err)) {
            setError("Unauthorized");
            setStatus("idle");
            return;
          }
          setStatus("reconnecting");
          await new Promise((r) => setTimeout(r, delay));
          delay = Math.min(delay * 2, 5000);
        }
      }
    }

    void loop();
    return () => {
      alive = false;
      channel.close();
    };
  }, [roomId, userId, merge]);

  const send = useCallback(
    async (content: string) => {
      if (roomId == null || !userId) throw new Error("Not in a room");
      const trimmed = content.trim();
      const tempId = -Date.now();
      const optimistic: Optimistic = {
        id: tempId,
        roomId,
        senderId: userId,
        senderName: "You",
        content: trimmed,
        sentAt: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const saved = await sendMessage({ data: { roomId, content: trimmed } });
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          const map = new Map(withoutTemp.filter((m) => m.id > 0).map((m) => [m.id, m]));
          map.set(saved.id, saved);
          seenRef.current.add(saved.id);
          if (saved.id > lastIdRef.current) lastIdRef.current = saved.id;
          return [...map.values()].sort((a, b) => a.id - b.id);
        });
        try {
          const ch = new BroadcastChannel(`relay-room-${roomId}`);
          ch.postMessage({ type: "message", message: saved });
          ch.close();
        } catch {
          /* BroadcastChannel may be unavailable */
        }
        return saved;
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        throw err;
      }
    },
    [roomId, userId],
  );

  const loadOlder = useCallback(async () => {
    if (roomId == null) return [];
    const oldest = messages.find((m) => m.id > 0);
    if (!oldest) return [];
    const older = await listMessages({
      data: { roomId, limit: 50, beforeId: oldest.id },
    });
    merge(older);
    return older;
  }, [roomId, messages, merge]);

  return { messages, presence, status, error, send, loadOlder };
}
