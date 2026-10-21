export type StudySessionStatus = 'upcoming' | 'completed' | 'cancelled';

export interface StudySession {
  id: string;
  userId: string;
  subjectId: string;
  moduleId?: string | null;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
  description?: string;
  status: StudySessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudySessionInput {
  subjectId: string;
  moduleId?: string | null;
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  description?: string;
  status?: StudySessionStatus;
}
