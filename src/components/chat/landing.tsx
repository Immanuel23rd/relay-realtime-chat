import { Link } from "@tanstack/react-router";
import { ArrowRight, History, Lock, Radio } from "lucide-react";
import { RelayMark } from "./mark";
import { Button } from "@/components/ui/button";

const points = [
  {
    icon: Radio,
    title: "Live, not refresh",
    body: "Send a line and everyone in the room sees it land — no reload, no lag ritual.",
  },
  {
    icon: History,
    title: "History that holds",
    body: "Late joiners and reloads pick up the thread from the last fifty messages, in order.",
  },
  {
    icon: Lock,
    title: "The server names you",
    body: "Sign in, then speak. The payload never chooses the sender — identity is decided here.",
  },
];

export function Landing() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 500px at 50% -10%, color-mix(in oklab, var(--color-accent) 8%, transparent), transparent 70%)",
        }}
      />
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2.5">
          <RelayMark className="size-7 text-accent" />
          <span className="font-display text-lg tracking-tight">Relay</span>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/login">Sign in</Link>
        </Button>
      </header>

      <section className="relative mx-auto flex w-full max-w-3xl flex-col items-start px-5 pb-20 pt-10 sm:pt-20">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.18em] text-fg-subtle">
          Real-time rooms
        </p>
        <h1 className="font-display text-[clamp(2.75rem,8vw,5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
          Speak once.
          <br />
          Everyone hears it.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-fg-muted sm:text-lg">
          Relay is a quiet chat for people who share a room. Messages are saved,
          ordered, and broadcast — so a late arrival still gets the story.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/login">
              Enter a room
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="text-sm text-fg-subtle">Google, X, or email.</p>
        </div>
      </section>

      <section className="relative mx-auto grid w-full max-w-5xl gap-px border-y border-border bg-border px-0 sm:grid-cols-3">
        {points.map((p) => (
          <article
            key={p.title}
            className="bg-bg px-6 py-8 sm:px-8"
          >
            <p.icon className="mb-4 size-4 text-accent" strokeWidth={1.75} />
            <h2 className="text-sm font-medium text-fg">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{p.body}</p>
          </article>
        ))}
      </section>

      <footer className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-8 text-xs text-fg-subtle">
        <span>Relay</span>
        <span>Persistent rooms. One server. No refresh.</span>
      </footer>
    </main>
  );
}
