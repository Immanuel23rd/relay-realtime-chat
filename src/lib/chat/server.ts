import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  HISTORY_DEFAULT,
  HISTORY_MAX,
  MESSAGE_MAX,
  WATCH_TICK_MS,
  WATCH_WAIT_MS,
  type ChatMessage,
  type PresenceUser,
  type Room,
  type WatchResult,
} from "./types";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

type RoomRow = {
  id: number;
  name: string;
  created_by: string;
  created_at: Date | string;
  member_count: number;
};

type MessageRow = {
  id: number;
  room_id: number;
  sender_id: string;
  sender_name: string;
  content: string;
  sent_at: Date | string;
};

type PresenceRow = {
  user_id: string;
  display_name: string;
  last_seen: Date | string;
};

function iso(value: Date | string): string {
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return value.toISOString();
}

function mapRoom(row: RoomRow): Room {
  return {
    id: Number(row.id),
    name: row.name,
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
    memberCount: Number(row.member_count),
  };
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: Number(row.id),
    roomId: Number(row.room_id),
    senderId: row.sender_id,
    senderName: row.sender_name,
    content: row.content,
    sentAt: iso(row.sent_at),
  };
}

function mapPresence(row: PresenceRow): PresenceUser {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    lastSeen: iso(row.last_seen),
  };
}

function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /unique|duplicate/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function displayNameFor(sql: Sql, userId: string): Promise<string> {
  const rows = await sql<{ name: string | null; email: string | null }>`
    select name, email from "user" where id = ${userId} limit 1
  `;
  const row = rows[0];
  if (!row) return "Someone";
  const name = row.name?.trim();
  if (name) return name.slice(0, 80);
  const email = row.email?.trim();
  if (email) return email.split("@")[0]?.slice(0, 80) || "Someone";
  return "Someone";
}

async function getRoomById(sql: Sql, roomId: number): Promise<RoomRow | undefined> {
  const rows = await sql<RoomRow>`
    select r.id, r.name, r.created_by, r.created_at,
           (select count(*)::int from room_members m where m.room_id = r.id) as member_count
    from rooms r
    where r.id = ${roomId}
    limit 1
  `;
  return rows[0];
}

async function requireRoom(sql: Sql, roomId: number): Promise<RoomRow> {
  const room = await getRoomById(sql, roomId);
  if (!room) throw new HttpError(404, "Room not found");
  return room;
}

async function ensureMember(sql: Sql, roomId: number, userId: string): Promise<void> {
  await sql`
    insert into room_members (room_id, user_id)
    values (${roomId}, ${userId})
    on conflict (room_id, user_id) do nothing
  `;
}

async function touchPresence(
  sql: Sql,
  roomId: number,
  userId: string,
  displayName: string,
): Promise<void> {
  await sql`
    insert into room_presence (room_id, user_id, display_name, last_seen)
    values (${roomId}, ${userId}, ${displayName}, now())
    on conflict (room_id, user_id) do update
      set display_name = excluded.display_name,
          last_seen = now()
  `;
}

async function listPresence(sql: Sql, roomId: number): Promise<PresenceUser[]> {
  const rows = await sql<PresenceRow>`
    select user_id, display_name, last_seen
    from room_presence
    where room_id = ${roomId}
      and last_seen > now() - interval '20 seconds'
    order by display_name
  `;
  return rows.map(mapPresence);
}

function parseLimit(limit: number | undefined): number {
  const value = limit ?? HISTORY_DEFAULT;
  if (!Number.isInteger(value) || value < 1 || value > HISTORY_MAX) {
    throw new HttpError(400, "limit must be between 1 and 100");
  }
  return value;
}

async function queryHistory(
  sql: Sql,
  roomId: number,
  opts: { limit: number; beforeId?: number; afterId?: number },
): Promise<ChatMessage[]> {
  if (opts.beforeId != null && opts.afterId != null) {
    throw new HttpError(400, "beforeId and afterId cannot be combined");
  }

  if (opts.afterId != null) {
    const rows = await sql<MessageRow>`
      select id, room_id, sender_id, sender_name, content, sent_at
      from messages
      where room_id = ${roomId} and id > ${opts.afterId}
      order by id
      limit ${opts.limit}
    `;
    return rows.map(mapMessage);
  }

  if (opts.beforeId != null) {
    const rows = await sql<MessageRow>`
      select * from (
        select id, room_id, sender_id, sender_name, content, sent_at
        from messages
        where room_id = ${roomId} and id < ${opts.beforeId}
        order by id desc
        limit ${opts.limit}
      ) t
      order by id
    `;
    return rows.map(mapMessage);
  }

  const rows = await sql<MessageRow>`
    select * from (
      select id, room_id, sender_id, sender_name, content, sent_at
      from messages
      where room_id = ${roomId}
      order by id desc
      limit ${opts.limit}
    ) t
    order by id
  `;
  return rows.map(mapMessage);
}

export const listRooms = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<RoomRow>`
      select r.id, r.name, r.created_by, r.created_at,
             (select count(*)::int from room_members m where m.room_id = r.id) as member_count
      from rooms r
      order by r.id
    `;
    return rows.map(mapRoom);
  });

export const createRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string }) => {
    const name = input.name.trim();
    if (!name) throw new HttpError(400, "Room name is required");
    if (name.length > 50) throw new HttpError(400, "Room name must be 50 characters or fewer");
    return { name };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    try {
      const rows = await sql<RoomRow>`
        insert into rooms (name, created_by)
        values (${data.name}, ${context.userId})
        returning id, name, created_by, created_at, 0::int as member_count
      `;
      const room = rows[0];
      if (!room) throw new HttpError(500, "Failed to create room");
      await ensureMember(sql, Number(room.id), context.userId);
      return mapRoom({ ...room, member_count: 1 });
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, "A room with that name already exists");
      throw err;
    }
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: {
    roomId: number;
    limit?: number;
    beforeId?: number;
    afterId?: number;
  }) => {
    if (!Number.isInteger(input.roomId) || input.roomId < 1) {
      throw new HttpError(400, "Invalid room");
    }
    return {
      roomId: input.roomId,
      limit: input.limit,
      beforeId: input.beforeId,
      afterId: input.afterId,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireRoom(sql, data.roomId);
    await ensureMember(sql, data.roomId, context.userId);
    const limit = parseLimit(data.limit);
    return queryHistory(sql, data.roomId, {
      limit,
      beforeId: data.beforeId,
      afterId: data.afterId,
    });
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { roomId: number; content: string; sender?: string }) => {
    if (!Number.isInteger(input.roomId) || input.roomId < 1) {
      throw new HttpError(400, "Invalid room");
    }
    const content = input.content.trim();
    if (!content) throw new HttpError(400, "Message cannot be empty");
    if (content.length > MESSAGE_MAX) {
      throw new HttpError(400, `Message must be ${MESSAGE_MAX} characters or fewer`);
    }
    return { roomId: input.roomId, content };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireRoom(sql, data.roomId);
    await ensureMember(sql, data.roomId, context.userId);
    const senderName = await displayNameFor(sql, context.userId);
    const rows = await sql<MessageRow>`
      insert into messages (room_id, sender_id, sender_name, content)
      values (${data.roomId}, ${context.userId}, ${senderName}, ${data.content})
      returning id, room_id, sender_id, sender_name, content, sent_at
    `;
    const saved = rows[0];
    if (!saved) throw new HttpError(500, "Failed to save message");
    await touchPresence(sql, data.roomId, context.userId, senderName);
    return mapMessage(saved);
  });

export const watchMessages = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { roomId: number; afterId: number }) => {
    if (!Number.isInteger(input.roomId) || input.roomId < 1) {
      throw new HttpError(400, "Invalid room");
    }
    if (!Number.isInteger(input.afterId) || input.afterId < 0) {
      throw new HttpError(400, "Invalid afterId");
    }
    return input;
  })
  .handler(async ({ context, data }): Promise<WatchResult> => {
    const sql = await getSql();
    await requireRoom(sql, data.roomId);
    await ensureMember(sql, data.roomId, context.userId);
    const senderName = await displayNameFor(sql, context.userId);
    await touchPresence(sql, data.roomId, context.userId, senderName);

    const deadline = Date.now() + WATCH_WAIT_MS;
    while (true) {
      const messages = await queryHistory(sql, data.roomId, {
        limit: HISTORY_MAX,
        afterId: data.afterId,
      });
      if (messages.length > 0) {
        return { messages, presence: await listPresence(sql, data.roomId) };
      }
      if (Date.now() >= deadline) break;
      await sleep(WATCH_TICK_MS);
    }
    return { messages: [], presence: await listPresence(sql, data.roomId) };
  });

export const heartbeat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { roomId: number }) => {
    if (!Number.isInteger(input.roomId) || input.roomId < 1) {
      throw new HttpError(400, "Invalid room");
    }
    return input;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireRoom(sql, data.roomId);
    await ensureMember(sql, data.roomId, context.userId);
    const senderName = await displayNameFor(sql, context.userId);
    await touchPresence(sql, data.roomId, context.userId, senderName);
    return listPresence(sql, data.roomId);
  });
