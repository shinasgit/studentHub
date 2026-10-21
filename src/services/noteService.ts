import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Note, NoteInput } from '../types/note';

const formatTimestamp = (val: unknown): string => {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
};

const getNotesCollection = (userId: string) => {
  if (!userId) {
    throw new Error('User ID is required to access personal notes.');
  }
  return collection(db, 'users', userId, 'notes');
};

/**
 * Fetch all personal notes for the authenticated user, optionally filtered by subject.
 */
export const getNotes = async (userId: string, subjectId?: string): Promise<Note[]> => {
  try {
    const notesRef = getNotesCollection(userId);
    let q = query(notesRef, orderBy('updatedAt', 'desc'));

    if (subjectId) {
      q = query(notesRef, where('subjectId', '==', subjectId), orderBy('updatedAt', 'desc'));
    }

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId,
        subjectId: data.subjectId || '',
        moduleId: data.moduleId || null,
        title: data.title || '',
        content: data.content || '',
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('Error fetching notes:', err);

    // Fallback if composite index is required/missing for subjectId + updatedAt
    if (subjectId && (err.code === 'failed-precondition' || err.message?.includes('index'))) {
      const notesRef = getNotesCollection(userId);
      const q = query(notesRef, where('subjectId', '==', subjectId));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId,
          subjectId: data.subjectId || '',
          moduleId: data.moduleId || null,
          title: data.title || '',
          content: data.content || '',
          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
        };
      });
      return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    throw error;
  }
};

/**
 * Retrieve a single note by ID.
 */
export const getNoteById = async (userId: string, noteId: string): Promise<Note | null> => {
  const noteDocRef = doc(db, 'users', userId, 'notes', noteId);
  const snap = await getDoc(noteDocRef);
  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    id: snap.id,
    userId,
    subjectId: data.subjectId || '',
    moduleId: data.moduleId || null,
    title: data.title || '',
    content: data.content || '',
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
  };
};

/**
 * Create a new personal note for the authenticated user.
 */
export const createNote = async (userId: string, input: NoteInput): Promise<Note> => {
  const cleanTitle = input.title.trim();
  const cleanContent = input.content.trim();

  if (!cleanTitle) {
    throw new Error('Note title is required.');
  }
  if (!input.subjectId) {
    throw new Error('Please select an associated subject for this note.');
  }

  const notesRef = getNotesCollection(userId);
  const now = new Date().toISOString();

  const docRef = await addDoc(notesRef, {
    subjectId: input.subjectId,
    moduleId: input.moduleId || null,
    title: cleanTitle,
    content: cleanContent,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    userId,
    subjectId: input.subjectId,
    moduleId: input.moduleId || null,
    title: cleanTitle,
    content: cleanContent,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Update an existing note.
 */
export const updateNote = async (
  userId: string,
  noteId: string,
  input: Partial<NoteInput>
): Promise<void> => {
  const noteDocRef = doc(db, 'users', userId, 'notes', noteId);
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.content !== undefined) payload.content = input.content.trim();
  if (input.subjectId !== undefined) payload.subjectId = input.subjectId;
  if (input.moduleId !== undefined) payload.moduleId = input.moduleId;

  await updateDoc(noteDocRef, payload);
};

/**
 * Delete a note.
 */
export const deleteNote = async (userId: string, noteId: string): Promise<void> => {
  const noteDocRef = doc(db, 'users', userId, 'notes', noteId);
  await deleteDoc(noteDocRef);
};
