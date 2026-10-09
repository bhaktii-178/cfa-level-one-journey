import { useState, type FormEvent } from "react";
import { Cloud, CloudCheck, LoaderCircle, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CloudSyncController,
  CloudSyncStatus,
} from "@/hooks/use-cloud-sync";

const SETUP_GUIDE =
  "https://github.com/bhaktii-178/cfa-level-one-journey/blob/main/artifacts/cfa-level-one-journey/CLOUD_SYNC_SETUP.md";

function statusLabel(status: CloudSyncStatus) {
  switch (status) {
    case "not-configured":
      return "Device only";
    case "signed-out":
      return "Sign in to sync";
    case "loading":
      return "Connecting…";
    case "syncing":
      return "Syncing…";
    case "synced":
      return "Synced";
    case "error":
      return "Sync issue";
  }
}

export function CloudSyncControl({
  sync,
}: {
  sync: CloudSyncController;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const succeeded =
      mode === "signup"
        ? await sync.signUp(email, password)
        : await sync.signIn(email, password);
    setBusy(false);
    if (succeeded) {
      setPassword("");
      setOpen(false);
    }
  };

  const sendReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const succeeded = await sync.resetPassword(email);
    setBusy(false);
    if (succeeded) {
      setNotice("Password reset email sent. Check your inbox.");
      setMode("signin");
    }
  };

  const closeDialog = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setMode("signin");
      setNotice("");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Cloud sync: ${statusLabel(sync.status)}`}
        onClick={() => setOpen(true)}
        className="h-9 gap-1.5 px-2.5 text-xs sm:px-3"
      >
        {sync.status === "synced" ? (
          <CloudCheck size={15} />
        ) : sync.status === "loading" || sync.status === "syncing" ? (
          <LoaderCircle size={15} className="animate-spin" />
        ) : (
          <Cloud size={15} />
        )}
        <span className="hidden sm:inline">{statusLabel(sync.status)}</span>
      </Button>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync your tracker across devices</DialogTitle>
            <DialogDescription>
              Your tracker remains saved in this browser. Sign in with the same
              account on your laptop and phone to keep progress together.
            </DialogDescription>
          </DialogHeader>

          {!sync.configured ? (
            <div className="space-y-4 rounded-xl border border-border bg-secondary/50 p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Cloud sync is not enabled in this published build yet. Your
                progress is still saved locally and will stay here until setup
                is complete.
              </p>
              <a
                href={SETUP_GUIDE}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Open the setup steps
              </a>
            </div>
          ) : sync.userEmail ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-secondary/50 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <CloudCheck size={17} className="text-accent" />
                  {statusLabel(sync.status)}
                </div>
                <p className="mt-2 break-all text-sm text-muted-foreground">
                  Signed in as {sync.userEmail}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Changes are saved on this device and synced to your private
                  account. Other signed-in devices receive updates
                  automatically.
                </p>
              </div>
              {sync.error && (
                <p role="alert" className="text-sm text-destructive">
                  {sync.error}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => void sync.signOut()}
                disabled={busy}
              >
                <LogOut size={15} />
                Sign out
              </Button>
            </div>
          ) : mode === "reset" ? (
            <form onSubmit={sendReset} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the email address for your tracker account.
              </p>
              <label className="block space-y-1.5 text-sm font-medium">
                Email
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              {sync.error && (
                <p role="alert" className="text-sm text-destructive">
                  {sync.error}
                </p>
              )}
              {notice && (
                <p role="status" className="text-sm text-accent-foreground">
                  {notice}
                </p>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send reset email"}
              </Button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="ml-3 text-sm text-muted-foreground underline underline-offset-4"
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block space-y-1.5 text-sm font-medium">
                Email
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                Password
                <Input
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={6}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                />
              </label>
              {sync.error && (
                <p role="alert" className="text-sm text-destructive">
                  {sync.error}
                </p>
              )}
              {notice && (
                <p role="status" className="text-sm text-accent-foreground">
                  {notice}
                </p>
              )}
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create sync account"
                    : "Sign in"}
              </Button>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {mode === "signin" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="underline underline-offset-4"
                    >
                      Create an account
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("reset")}
                      className="underline underline-offset-4"
                    >
                      Forgot password?
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="underline underline-offset-4"
                  >
                    Already have an account? Sign in
                  </button>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Use the same email and password on every device. Your study data
                is kept separate from other accounts.
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
