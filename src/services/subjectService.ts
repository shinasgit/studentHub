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
import type { Subject, SubjectInput } from '../types/subject';

/**
 * Normalizes Firestore timestamps or strings to an ISO string
 */
const formatTimestamp = (val: unknown): string => {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
};

/**
 * Returns the subjects collection reference scoped to a specific user
 * Path: users/{userId}/subjects
 */
const getUserSubjectsCollection = (userId: string) => {
  if (!userId) {
    throw new Error('User ID is required to access subjects.');
  }
  return collection(db, 'users', userId, 'subjects');
};

/**
 * Fetches all subjects for the authenticated user, ordered by creation date descending
 */
export const getSubjects = async (userId: string): Promise<Subject[]> => {
  try {
    const subjectsRef = getUserSubjectsCollection(userId);
    const q = query(subjectsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId,
        name: data.name || '',
        code: data.code || '',
        semester: data.semester || 'Semester 1',
        description: data.description || '',
        color: data.color || '#6366f1',
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('Error fetching subjects from Firestore:', err);

    // If Firestore fails with order-by index or similar, attempt fallback unordered fetch
    if (err.code === 'failed-precondition' || err.message?.includes('index')) {
      try {
        const subjectsRef = getUserSubjectsCollection(userId);
        const querySnapshot = await getDocs(subjectsRef);
        return querySnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId,
            name: data.name || '',
            code: data.code || '',
            semester: data.semester || 'Semester 1',
            description: data.description || '',
            color: data.color || '#6366f1',
            createdAt: formatTimestamp(data.createdAt),
            updatedAt: formatTimestamp(data.updatedAt),
          };
        });
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
      }
    }

    throw error;
  }
};

/**
 * Adds a new subject to the user's Firestore subjects collection
 */
export const createSubject = async (userId: string, input: SubjectInput): Promise<Subject> => {
  const subjectsRef = getUserSubjectsCollection(userId);
  const now = new Date().toISOString();

  const docRef = await addDoc(subjectsRef, {
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    semester: input.semester.trim(),
    description: (input.description || '').trim(),
    color: input.color || '#6366f1',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    userId,
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    semester: input.semester.trim(),
    description: (input.description || '').trim(),
    color: input.color || '#6366f1',
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Updates an existing subject in the user's Firestore collection
 */
export const updateSubject = async (
  userId: string,
  subjectId: string,
  input: Partial<SubjectInput>
): Promise<void> => {
  if (!userId || !subjectId) {
    throw new Error('Both userId and subjectId are required to update a subject.');
  }

  const subjectDocRef = doc(db, 'users', userId, 'subjects', subjectId);

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.code !== undefined) payload.code = input.code.trim().toUpperCase();
  if (input.semester !== undefined) payload.semester = input.semester.trim();
  if (input.description !== undefined) payload.description = input.description.trim();
  if (input.color !== undefined) payload.color = input.color;

  await updateDoc(subjectDocRef, payload);
};

/**
 * Deletes a subject from the user's Firestore collection
 */
export const deleteSubject = async (userId: string, subjectId: string): Promise<void> => {
  if (!userId || !subjectId) {
    throw new Error('Both userId and subjectId are required to delete a subject.');
  }

  const subjectDocRef = doc(db, 'users', userId, 'subjects', subjectId);
  await deleteDoc(subjectDocRef);
};
