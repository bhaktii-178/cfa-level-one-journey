import { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { firebaseAuth, firebaseConfigured, firestore } from "@/lib/firebase-client";
import type { Progress, Session, Snapshot } from "@/lib/tracker-types";

const OWNER_STORAGE_KEY = "cfa-2027-journey-cloud-owner-v1";

export type CloudSyncStatus =
  | "not-configured"
  | "signed-out"
  | "loading"
  | "syncing"
  | "synced"
  | "error";

export type CloudSyncController = {
  configured: boolean;
  status: CloudSyncStatus;
  userEmail: string | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  signOut: () => Promise<boolean>;
};

const emptySnapshot = (): Snapshot => ({ progress: {}, sessions: [] });

function normalizeSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== "object") return emptySnapshot();
  const candidate = value as Partial<Snapshot>;
  const progress =
    candidate.progress && typeof candidate.progress === "object"
      ? candidate.progress
      : {};
  const sessions = Array.isArray(candidate.sessions)
    ? candidate.sessions.filter(
        (session): session is Session =>
          Boolean(session) &&
          typeof session === "object" &&
          typeof (session as Session).id === "string",
      )
    : [];
  return { progress, sessions };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hasProgressChanges(progress?: Progress) {
  if (!progress) return false;
  return (
    Boolean(progress.updatedAt) ||
    progress.status !== "not_started" ||
    progress.confidence !== 1 ||
    Boolean(progress.notes.trim()) ||
    progress.lastStudied !== null ||
    progress.revisionCount !== 0
  );
}

function getProgressTime(progress?: Progress) {
  if (!progress) return 0;
  const value = progress.updatedAt || progress.lastStudied;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSessionTime(session?: Session) {
  if (!session) return 0;
  const value = session.updatedAt || `${session.date}T23:59:59Z`;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
  const progress = { ...remote.progress };
  const progressIds = new Set([
    ...Object.keys(remote.progress),
    ...Object.keys(local.progress),
  ]);

  for (const id of progressIds) {
    const localProgress = local.progress[id];
    const remoteProgress = remote.progress[id];
    if (!localProgress) continue;
    if (!remoteProgress) {
      progress[id] = localProgress;
      continue;
    }
    if (!hasProgressChanges(localProgress)) continue;
    if (
      !hasProgressChanges(remoteProgress) ||
      getProgressTime(localProgress) > getProgressTime(remoteProgress)
    ) {
      progress[id] = localProgress;
    }
  }

  const sessions = new Map(remote.sessions.map((session) => [session.id, session]));
  for (const session of local.sessions) {
    const remoteSession = sessions.get(session.id);
    if (!remoteSession || getSessionTime(session) > getSessionTime(remoteSession)) {
      sessions.set(session.id, session);
    }
  }

  return {
    progress,
    sessions: [...sessions.values()].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

function errorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  if (code === "auth/invalid-credential") {
    return "That email or password did not match. Try again or reset your password.";
  }
  if (code === "auth/email-already-in-use") {
    return "An account with that email already exists. Sign in instead.";
  }
  if (code === "auth/weak-password") {
    return "Choose a password with at least six characters.";
  }
  if (code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }
  if (code === "auth/too-many-requests") {
    return "There have been too many attempts. Wait a little and try again.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Email/password sign-in is not enabled in Firebase Authentication yet.";
  }
  if (code === "auth/unauthorized-domain") {
    return "Add bhaktii-178.github.io to Firebase Authentication's authorized domains.";
  }
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "Firebase denied access. Check the Firestore rules in the setup guide.";
  }
  if (
    code === "failed-precondition" ||
    code === "firestore/failed-precondition"
  ) {
    return "Create the Firestore database and publish the rules from the setup guide.";
  }
  if (code === "unavailable" || code === "firestore/unavailable") {
    return "Cloud sync is temporarily unavailable. Your local progress is still saved.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Cloud sync could not complete. Your local progress is still saved.";
}

export function useCloudSync(
  snapshot: Snapshot,
  setSnapshot: (snapshot: Snapshot) => void,
): CloudSyncController {
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const [user, setUser] = useState<User | null>(null);
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<CloudSyncStatus>(
    firebaseConfigured ? "loading" : "not-configured",
  );
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!firebaseAuth || !firestore) {
      setStatus("not-configured");
      return;
    }
    const database = firestore;

    let cancelled = false;
    let generation = 0;
    let stopRemote: Unsubscribe | undefined;

    const stopAuth = onAuthStateChanged(firebaseAuth, (nextUser) => {
      const currentGeneration = ++generation;
      stopRemote?.();
      stopRemote = undefined;
      setUser(nextUser);
      setError(null);

      if (!nextUser) {
        setReadyUserId(null);
        lastSyncedRef.current = null;
        setStatus("signed-out");
        return;
      }

      setReadyUserId(null);
      setStatus("loading");
      const owner = localStorage.getItem(OWNER_STORAGE_KEY);
      const reference = doc(database, "trackerSnapshots", nextUser.uid);

      void (async () => {
        const result = await runTransaction<{
          snapshot: Snapshot;
          created: boolean;
        }>(database, async (transaction) => {
          const existing = await transaction.get(reference);
          if (existing.exists()) {
            return {
              snapshot: normalizeSnapshot(existing.data().snapshot),
              created: false,
            };
          }

          const seed =
            owner && owner !== nextUser.uid
              ? emptySnapshot()
              : snapshotRef.current;
          transaction.set(reference, {
            snapshot: seed,
            updatedAt: serverTimestamp(),
          });
          return { snapshot: seed, created: true };
        });

        if (cancelled || currentGeneration !== generation) return;

        const resolvedSnapshot =
          owner && owner !== nextUser.uid
            ? result.snapshot
            : result.created
              ? result.snapshot
              : mergeSnapshots(snapshotRef.current, result.snapshot);

        localStorage.setItem(OWNER_STORAGE_KEY, nextUser.uid);
        lastSyncedRef.current = stableStringify(result.snapshot);
        setSnapshot(resolvedSnapshot);
        setReadyUserId(nextUser.uid);
        setStatus(
          stableStringify(resolvedSnapshot) ===
            stableStringify(result.snapshot)
            ? "synced"
            : "syncing",
        );

        stopRemote = onSnapshot(
          reference,
          (remoteDocument) => {
            if (
              cancelled ||
              currentGeneration !== generation ||
              !remoteDocument.exists()
            ) {
              return;
            }
            const remote = normalizeSnapshot(remoteDocument.data().snapshot);
            const remoteJson = stableStringify(remote);
            if (remoteJson === lastSyncedRef.current) {
              if (stableStringify(snapshotRef.current) === remoteJson) {
                setError(null);
                setStatus("synced");
              }
              return;
            }

            const merged =
              owner && owner !== nextUser.uid
                ? remote
                : mergeSnapshots(snapshotRef.current, remote);
            lastSyncedRef.current = remoteJson;
            setSnapshot(merged);
            setStatus(
              stableStringify(merged) === remoteJson ? "synced" : "syncing",
            );
          },
          (listenerError) => {
            setError(errorMessage(listenerError));
            setStatus("error");
          },
        );
      })().catch((syncError: unknown) => {
        if (cancelled || currentGeneration !== generation) return;
        setError(errorMessage(syncError));
        setReadyUserId(nextUser.uid);
        setStatus("error");
      });
    });

    return () => {
      cancelled = true;
      generation++;
      stopRemote?.();
      stopAuth();
    };
  }, [setSnapshot]);

  useEffect(() => {
    if (!firestore || !user || readyUserId !== user.uid) return;
    const database = firestore;
    const currentJson = stableStringify(snapshot);
    if (currentJson === lastSyncedRef.current) return;

    const timer = window.setTimeout(() => {
      const reference = doc(database, "trackerSnapshots", user.uid);
      setStatus("syncing");
      setError(null);

      void runTransaction<Snapshot>(database, async (transaction) => {
        const existing = await transaction.get(reference);
        const remote = existing.exists()
          ? normalizeSnapshot(existing.data().snapshot)
          : emptySnapshot();
        const merged = mergeSnapshots(snapshotRef.current, remote);
        transaction.set(reference, {
          snapshot: merged,
          updatedAt: serverTimestamp(),
        });
        return merged;
      })
        .then((merged) => {
          lastSyncedRef.current = stableStringify(merged);
          if (
            stableStringify(snapshotRef.current) !==
            stableStringify(merged)
          ) {
            setSnapshot(merged);
          }
          setStatus("synced");
        })
        .catch((syncError: unknown) => {
          setError(errorMessage(syncError));
          setStatus("error");
        });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [snapshot, user, readyUserId, retryVersion, setSnapshot]);

  useEffect(() => {
    if (!firestore || !user || readyUserId !== user.uid) return;
    const database = firestore;
    const refresh = async () => {
      try {
        const remoteDocument = await getDoc(
          doc(database, "trackerSnapshots", user.uid),
        );
        if (!remoteDocument.exists()) return;
        const remote = normalizeSnapshot(remoteDocument.data().snapshot);
        const remoteJson = stableStringify(remote);
        if (remoteJson === lastSyncedRef.current) {
          if (stableStringify(snapshotRef.current) === remoteJson) {
            setError(null);
            setStatus("synced");
          }
          return;
        }
        const merged = mergeSnapshots(snapshotRef.current, remote);
        lastSyncedRef.current = remoteJson;
        setSnapshot(merged);
        setStatus(
          stableStringify(merged) === remoteJson ? "synced" : "syncing",
        );
      } catch (refreshError) {
        setError(errorMessage(refreshError));
        setStatus("error");
      }
    };

    const retryWhenOnline = () => {
      setRetryVersion((current) => current + 1);
      void refresh();
    };
    window.addEventListener("focus", retryWhenOnline);
    window.addEventListener("online", retryWhenOnline);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.removeEventListener("focus", retryWhenOnline);
      window.removeEventListener("online", retryWhenOnline);
      window.clearInterval(interval);
    };
  }, [user, readyUserId, setSnapshot]);

  const signIn = async (email: string, password: string) => {
    if (!firebaseAuth) return false;
    setError(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      return true;
    } catch (authError) {
      setError(errorMessage(authError));
      return false;
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!firebaseAuth) return false;
    setError(null);
    try {
      await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      return true;
    } catch (authError) {
      setError(errorMessage(authError));
      return false;
    }
  };

  const resetPassword = async (email: string) => {
    if (!firebaseAuth) return false;
    setError(null);
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      return true;
    } catch (authError) {
      setError(errorMessage(authError));
      return false;
    }
  };

  const signOut = async () => {
    if (!firebaseAuth) return false;
    setError(null);
    try {
      await firebaseSignOut(firebaseAuth);
      return true;
    } catch (authError) {
      setError(errorMessage(authError));
      return false;
    }
  };

  return {
    configured: firebaseConfigured,
    status,
    userEmail: user?.email ?? null,
    error,
    signIn,
    signUp,
    resetPassword,
    signOut,
  };
}
