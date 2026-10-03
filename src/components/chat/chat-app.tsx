import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import {
  Hash,
  LoaderCircle,
  Menu,
  Plus,
  Radio,
  Send,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { UserButton } from "@/lib/auth/gates";
import type { AppUser } from "@/lib/auth/use-current-user";
import { createRoom, listRooms } from "@/lib/chat/server";
import { useLiveMessages } from "@/lib/chat/use-live-messages";
import type { ChatMessage, Room } from "@/lib/chat/types";
import { MESSAGE_MAX } from "@/lib/chat/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RelayMark } from "./mark";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function ChatApp({ user }: { user: AppUser }) {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    listRooms()
      .then((rows) => {
        if (!alive) return;
        setRooms(rows);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setRoomsError(err instanceof Error ? err.message : "Could not load rooms");
      });
    return () => {
      alive = false;
    };
  }, []);

  const active = useMemo(() => {
    if (!rooms?.length) return null;
    const wanted = search.room?.toLowerCase();
    if (wanted) {
      return rooms.find((r) => r.name.toLowerCase() === wanted) ?? rooms[0]!;
    }
    return rooms.find((r) => r.name === "general") ?? rooms[0]!;
  }, [rooms, search.room]);

  useEffect(() => {
    if (!active) return;
    if (search.room !== active.name) {
      void navigate({ search: { room: active.name }, replace: true });
    }
  }, [active, search.room, navigate]);

  function selectRoom(room: Room) {
    setDrawerOpen(false);
    void navigate({ search: { room: room.name } });
  }

  async function onCreated(room: Room) {
    setRooms((prev) => (prev ? [...prev, room].sort((a, b) => a.id - b.id) : [room]));
    setCreateOpen(false);
    selectRoom(room);
  }

  if (roomsError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <div>
          <p className="font-display text-2xl">Could not open Relay</p>
          <p className="mt-2 text-sm text-fg-muted">{roomsError}</p>
        </div>
      </div>
    );
  }

  if (!rooms || !active) {
    return <ChatSkeleton />;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-fg">
      <aside className="hidden w-[17.5rem] shrink-0 flex-col border-r border-border bg-bg-elevated md:flex">
        <RoomSidebar
          rooms={rooms}
          activeId={active.id}
          onSelect={selectRoom}
          onCreate={() => setCreateOpen(true)}
        />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close rooms"
            className="absolute inset-0 bg-bg/70"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative flex h-full w-[17.5rem] flex-col bg-bg-elevated shadow-2xl">
            <RoomSidebar
              rooms={rooms}
              activeId={active.id}
              onSelect={selectRoom}
              onCreate={() => {
                setDrawerOpen(false);
                setCreateOpen(true);
              }}
            />
          </div>
        </div>
      ) : null}

      <RoomPane
        key={active.id}
        room={active}
        user={user}
        onOpenRooms={() => setDrawerOpen(true)}
      />

      <CreateRoomDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onCreated}
      />
    </div>
  );
}

function RoomSidebar({
  rooms,
  activeId,
  onSelect,
  onCreate,
}: {
  rooms: Room[];
  activeId: number;
  onSelect: (room: Room) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-4 py-4">
        <RelayMark className="size-6 text-accent" />
        <div className="min-w-0">
          <p className="font-display text-base leading-none tracking-tight">Relay</p>
          <p className="mt-1 text-[11px] text-fg-subtle">Rooms that keep up</p>
        </div>
      </div>
      <div className="px-3 pb-2">
        <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Rooms
        </p>
        <nav className="flex flex-col gap-0.5">
          {rooms.map((room) => {
            const active = room.id === activeId;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelect(room)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 text-left text-sm transition-colors duration-[var(--motion-quick)]",
                  active
                    ? "bg-bg-subtle text-fg"
                    : "text-fg-muted hover:bg-bg-subtle/60 hover:text-fg",
                )}
              >
                <Hash className="size-3.5 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{room.name}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto border-t border-border p-3">
        <Button variant="secondary" className="w-full" onClick={onCreate}>
          <Plus className="size-4" />
          New room
        </Button>
        <div className="mt-3 px-1">
          <UserButton />
        </div>
      </div>
    </>
  );
}

function RoomPane({
  room,
  user,
  onOpenRooms,
}: {
  room: Room;
  user: AppUser;
  onOpenRooms: () => void;
}) {
  const { messages, presence, status, send, loadOlder } = useLiveMessages(
    room.id,
    user.id,
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const didInitScroll = useRef(false);

  useEffect(() => {
    didInitScroll.current = false;
    nearBottom.current = true;
  }, [room.id]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (!didInitScroll.current && messages.length) {
      el.scrollTop = el.scrollHeight;
      didInitScroll.current = true;
      return;
    }
    if (nearBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottom.current = gap < 80;
    if (el.scrollTop < 48) void loadOlder();
  }

  async function submit() {
    const text = draft.trim();
    if (!text || sending) return;
    if (text.length > MESSAGE_MAX) {
      toast.error(`Messages can be ${MESSAGE_MAX} characters at most.`);
      return;
    }
    setSending(true);
    setDraft("");
    try {
      await send(text);
    } catch (err) {
      setDraft(text);
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  const others = presence.filter((p) => p.userId !== user.id);
  const onlineCount = Math.max(presence.length, 1);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-5">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-[var(--radius-sm)] text-fg md:hidden"
          onClick={onOpenRooms}
          aria-label="Open rooms"
        >
          <Menu className="size-5" />
        </button>
        <Hash className="hidden size-4 text-fg-subtle md:block" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium">{room.name}</h1>
          <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
            <StatusDot status={status} />
            {status === "reconnecting"
              ? "Reconnecting"
              : status === "connecting"
                ? "Connecting"
                : "Live"}
          </p>
        </div>
        <button
          type="button"
          className="flex h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-xs text-fg-muted hover:bg-bg-subtle"
          onClick={() => setPresenceOpen((v) => !v)}
        >
          <Users className="size-4" />
          <span className="tabular">{onlineCount}</span>
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="h-full overflow-y-auto px-3 py-4 sm:px-6"
        >
          {messages.length === 0 ? (
            <EmptyRoom name={room.name} />
          ) : (
            <MessageThread messages={messages} selfId={user.id} />
          )}
        </div>

        {presenceOpen ? (
          <aside className="absolute right-3 top-3 z-10 w-56 rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-fg-muted">In this room</p>
              <button
                type="button"
                className="grid size-8 place-items-center text-fg-muted"
                onClick={() => setPresenceOpen(false)}
                aria-label="Close presence"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-sm">
                <span className="size-1.5 rounded-full bg-accent" />
                You
              </li>
              {others.map((p) => (
                <li key={p.userId} className="flex items-center gap-2 text-sm text-fg-muted">
                  <span className="size-1.5 rounded-full bg-accent/60" />
                  <span className="truncate">{p.displayName}</span>
                </li>
              ))}
              {others.length === 0 ? (
                <li className="text-xs text-fg-subtle">No one else is here yet.</li>
              ) : null}
            </ul>
          </aside>
        ) : null}
      </div>

      <form
        className="shrink-0 border-t border-border px-3 pt-3 pb-[max(3.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-end gap-2 rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-2 pl-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={`Message #${room.name}`}
            rows={1}
            maxLength={MESSAGE_MAX + 1}
            className="min-h-[2.5rem] max-h-36 border-0 bg-transparent px-0 py-2 focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className="shrink-0"
          >
            {sending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
        <div className="mt-1.5 flex justify-between px-1 text-[11px] text-fg-subtle">
          <span>Enter to send · Shift+Enter for a new line</span>
          <span className={cn("tabular", draft.length > MESSAGE_MAX && "text-danger")}>
            {draft.length}/{MESSAGE_MAX}
          </span>
        </div>
      </form>
    </section>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 rounded-full",
        status === "live" && "bg-accent",
        status === "reconnecting" && "animate-pulse bg-fg-subtle",
        status === "connecting" && "animate-pulse bg-fg-muted",
        status === "idle" && "bg-fg-subtle",
      )}
    />
  );
}

function EmptyRoom({ name }: { name: string }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-start gap-3 py-16">
      <Radio className="size-5 text-accent" strokeWidth={1.75} />
      <h2 className="font-display text-2xl tracking-tight">#{name}</h2>
      <p className="text-sm leading-relaxed text-fg-muted">
        No messages yet. Subscribe is already live — the first line you send is
        saved, then broadcast to everyone here.
      </p>
    </div>
  );
}

function MessageThread({
  messages,
  selfId,
}: {
  messages: ChatMessage[];
  selfId: string;
}) {
  const nodes: ReactNode[] = [];
  let lastDay: string | null = null;
  let lastSender: string | null = null;
  let lastAt = 0;

  for (const m of messages) {
    const day = dayLabel(m.sentAt);
    if (day !== lastDay) {
      nodes.push(
        <div key={`d-${m.id}`} className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <Badge>{day}</Badge>
          <span className="h-px flex-1 bg-border" />
        </div>,
      );
      lastDay = day;
      lastSender = null;
    }
    const t = new Date(m.sentAt).getTime();
    const grouped =
      lastSender === m.senderId && t - lastAt < 2 * 60 * 1000 && isSameDay(t, lastAt);
    nodes.push(
      <MessageBubble
        key={m.id}
        message={m}
        mine={m.senderId === selfId}
        grouped={grouped}
      />,
    );
    lastSender = m.senderId;
    lastAt = t;
  }

  return <div className="mx-auto flex w-full max-w-3xl flex-col">{nodes}</div>;
}

function MessageBubble({
  message,
  mine,
  grouped,
}: {
  message: ChatMessage;
  mine: boolean;
  grouped: boolean;
}) {
  const pending = message.id < 0;
  return (
    <article
      className={cn(
        "flex gap-2.5",
        grouped ? "mt-0.5" : "mt-4",
        mine && "flex-row-reverse",
      )}
    >
      <div className={cn("size-8 shrink-0", grouped && "invisible")}>
        <span
          className={cn(
            "grid size-8 place-items-center rounded-full text-[11px] font-medium",
            mine ? "bg-accent text-accent-fg" : "bg-bg-subtle text-fg-muted",
          )}
        >
          {initials(message.senderName)}
        </span>
      </div>
      <div className={cn("max-w-[min(100%,28rem)]", mine && "items-end")}>
        {grouped ? null : (
          <div
            className={cn(
              "mb-1 flex items-baseline gap-2 px-1",
              mine && "flex-row-reverse",
            )}
          >
            <span className="text-xs font-medium">{mine ? "You" : message.senderName}</span>
            <time className="text-[11px] text-fg-subtle tabular">
              {format(new Date(message.sentAt), "h:mm a")}
            </time>
          </div>
        )}
        <div
          className={cn(
            "rounded-[var(--radius-md)] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
            mine ? "bg-mine text-fg" : "bg-theirs text-fg",
            pending && "opacity-60",
          )}
        >
          {message.content}
        </div>
      </div>
    </article>
  );
}

function CreateRoomDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (room: Room) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const room = await createRoom({ data: { name: trimmed } });
      setName("");
      onCreated(room);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New room</DialogTitle>
          <DialogDescription>
            A unique name, up to 50 characters. You become the first member.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="room-name">Name</Label>
            <Input
              id="room-name"
              value={name}
              maxLength={50}
              autoFocus
              placeholder="design-review"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim() || busy}>
            {busy ? "Creating…" : "Create room"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex h-dvh bg-bg text-fg">
      <aside className="hidden w-[17.5rem] border-r border-border p-4 md:block">
        <div className="flex items-center gap-2.5">
          <RelayMark className="size-6 text-accent" />
          <p className="font-display text-base tracking-tight">Relay</p>
        </div>
        <p className="mt-8 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Rooms
        </p>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-5/6" />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <RelayMark className="size-5 text-accent md:hidden" />
          <p className="text-sm font-medium">Opening Relay</p>
        </div>
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="ml-auto h-16 w-1/2" />
          <Skeleton className="h-12 w-1/3" />
        </div>
      </div>
    </div>
  );
}
