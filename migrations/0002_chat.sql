-- Relay chat schema. Identity lives in Better Auth's "user" table;
-- sender_id / created_by / room_members.user_id store those text ids.
-- Order clients trust is messages.id; sent_at is display-only.

create table if not exists rooms (
  id         bigint generated always as identity primary key,
  name       varchar(50) not null unique,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists room_members (
  room_id   bigint not null references rooms(id) on delete cascade,
  user_id   text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists messages (
  id          bigint generated always as identity primary key,
  room_id     bigint not null references rooms(id) on delete cascade,
  sender_id   text not null,
  sender_name varchar(80) not null,
  content     varchar(1000) not null,
  sent_at     timestamptz not null default now(),
  constraint messages_content_not_blank check (length(btrim(content)) > 0)
);

create index if not exists idx_messages_room_id_id on messages (room_id, id desc);

create table if not exists room_presence (
  room_id       bigint not null references rooms(id) on delete cascade,
  user_id       text not null,
  display_name  text not null,
  last_seen     timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_room_presence_seen on room_presence (room_id, last_seen desc);

insert into rooms (name, created_by)
values ('general', 'system'), ('lounge', 'system'), ('dev', 'system')
on conflict (name) do nothing;
