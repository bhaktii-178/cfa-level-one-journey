export type Status =
  | "not_started"
  | "in_progress"
  | "completed"
  | "needs_revision";

export type Progress = {
  status: Status;
  confidence: number;
  notes: string;
  lastStudied: string | null;
  revisionCount: number;
  updatedAt?: string;
};

export type ProgressMap = Record<string, Progress>;

export type Session = {
  id: string;
  date: string;
  subjectId: string;
  topicId: string;
  durationMinutes: number;
  notes: string;
  updatedAt?: string;
};

export type Snapshot = {
  progress: ProgressMap;
  sessions: Session[];
};
