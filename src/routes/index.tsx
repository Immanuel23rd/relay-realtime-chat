import { createFileRoute } from "@tanstack/react-router";
import { ChatApp, ChatSkeleton } from "@/components/chat/chat-app";
import { Landing } from "@/components/chat/landing";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type Search = { room?: string };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    room: typeof search.room === "string" ? search.room : undefined,
  }),
  component: Home,
});

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <ChatSkeleton />;
  if (!user) return <Landing />;
  return <ChatApp user={user} />;
}
