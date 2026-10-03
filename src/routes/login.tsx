import { type FormEvent, useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RelayMark } from "@/components/chat/mark";
import { ChatSkeleton } from "@/components/chat/chat-app";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPending) return <ChatSkeleton />;
  if (user) return <Navigate to="/" />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split("@")[0] || "Member",
        });
        if (err) {
          setError(err.message ?? "Could not create an account.");
          return;
        }
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) {
          setError(err.message ?? "Could not sign in.");
          return;
        }
      }
      await authClient.getSession();
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-5 py-10 text-fg">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2 text-fg">
          <RelayMark className="size-7 text-accent" />
          <span className="font-display text-xl tracking-tight">Relay</span>
        </Link>
        <h1 className="font-display text-3xl tracking-tight">
          {mode === "in" ? "Welcome back" : "Create an account"}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {mode === "in"
            ? "Sign in to join a room. The server, not the payload, decides who you are."
            : "Pick a name, email, and a password of at least 8 characters."}
        </p>

        {authEnabled ? (
          <div className="mt-8 space-y-3">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </Button>
            ))}
            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-[0.16em] text-fg-subtle">
                or email
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <form className="space-y-3" onSubmit={onSubmit}>
              {mode === "up" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display name</Label>
                  <Input
                    id="name"
                    autoComplete="nickname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="alice"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alice@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy
                  ? mode === "up"
                    ? "Creating…"
                    : "Signing in…"
                  : mode === "up"
                    ? "Create account"
                    : "Sign in"}
              </Button>
            </form>
            <button
              type="button"
              className="w-full pt-1 text-center text-sm text-fg-muted hover:text-fg"
              onClick={() => {
                setError(null);
                setMode((m) => (m === "in" ? "up" : "in"));
              }}
            >
              {mode === "in"
                ? "Need an account? Create one"
                : "Already have an account? Sign in"}
            </button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-fg-muted">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}
