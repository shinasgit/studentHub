import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StudySession, StudySessionInput, StudySessionStatus } from '../types/planner';

const formatTimestamp = (val: unknown): string => {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
};

const getSessionsCollection = (userId: string) => {
  if (!userId) {
    throw new Error('User ID is required to access study planner sessions.');
  }
  return collection(db, 'users', userId, 'studySessions');
};

/**
 * Fetch all study planner sessions for authenticated user, ordered by date and start time.
 */
export const getStudySessions = async (userId: string): Promise<StudySession[]> => {
  try {
    const sessionsRef = getSessionsCollection(userId);
    const q = query(sessionsRef, orderBy('date', 'asc'));
    const querySnapshot = await getDocs(q);

    const list = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId,
        subjectId: data.subjectId || '',
        moduleId: data.moduleId || null,
        title: data.title || '',
        date: data.date || '',
        startTime: data.startTime || '09:00',
        durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : 45,
        description: data.description || '',
        status: (data.status as StudySessionStatus) || 'upcoming',
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });

    // Secondary sort by startTime
    return list.sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.startTime.localeCompare(b.startTime);
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('Error fetching study sessions:', err);

    // Fallback if index on 'date' is building
    const sessionsRef = getSessionsCollection(userId);
    const querySnapshot = await getDocs(sessionsRef);
    const list = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId,
        subjectId: data.subjectId || '',
        moduleId: data.moduleId || null,
        title: data.title || '',
        date: data.date || '',
        startTime: data.startTime || '09:00',
        durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : 45,
        description: data.description || '',
        status: (data.status as StudySessionStatus) || 'upcoming',
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });

    return list.sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.startTime.localeCompare(b.startTime);
    });
  }
};

/**
 * Create a new scheduled study session.
 */
export const createStudySession = async (
  userId: string,
  input: StudySessionInput
): Promise<StudySession> => {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) throw new Error('Session title is required.');
  if (!input.subjectId) throw new Error('Associated subject is required.');
  if (!input.date) throw new Error('Session date is required.');
  if (!input.startTime) throw new Error('Start time is required.');
  if (!input.durationMinutes || input.durationMinutes < 5) {
    throw new Error('Duration must be at least 5 minutes.');
  }

  const sessionsRef = getSessionsCollection(userId);
  const now = new Date().toISOString();

  const docRef = await addDoc(sessionsRef, {
    subjectId: input.subjectId,
    moduleId: input.moduleId || null,
    title: cleanTitle,
    date: input.date,
    startTime: input.startTime,
    durationMinutes: Number(input.durationMinutes),
    description: input.description?.trim() || '',
    status: input.status || 'upcoming',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    userId,
    subjectId: input.subjectId,
    moduleId: input.moduleId || null,
    title: cleanTitle,
    date: input.date,
    startTime: input.startTime,
    durationMinutes: Number(input.durationMinutes),
    description: input.description?.trim() || '',
    status: input.status || 'upcoming',
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Update an existing study session.
 */
export const updateStudySession = async (
  userId: string,
  sessionId: string,
  input: Partial<StudySessionInput>
): Promise<void> => {
  const sessionDocRef = doc(db, 'users', userId, 'studySessions', sessionId);
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.subjectId !== undefined) payload.subjectId = input.subjectId;
  if (input.moduleId !== undefined) payload.moduleId = input.moduleId;
  if (input.date !== undefined) payload.date = input.date;
  if (input.startTime !== undefined) payload.startTime = input.startTime;
  if (input.durationMinutes !== undefined) payload.durationMinutes = Number(input.durationMinutes);
  if (input.description !== undefined) payload.description = input.description.trim();
  if (input.status !== undefined) payload.status = input.status;

  await updateDoc(sessionDocRef, payload);
};

/**
 * Update session status (e.g. 'completed', 'cancelled', 'upcoming').
 */
export const updateSessionStatus = async (
  userId: string,
  sessionId: string,
  status: StudySessionStatus
): Promise<void> => {
  const sessionDocRef = doc(db, 'users', userId, 'studySessions', sessionId);
  await updateDoc(sessionDocRef, {
    status,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Delete a study session.
 */
export const deleteStudySession = async (userId: string, sessionId: string): Promise<void> => {
  const sessionDocRef = doc(db, 'users', userId, 'studySessions', sessionId);
  await deleteDoc(sessionDocRef);
};
