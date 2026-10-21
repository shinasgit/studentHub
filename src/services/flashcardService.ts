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
  where,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Flashcard, FlashcardInput, FlashcardReviewStatus } from '../types/flashcard';

const formatTimestamp = (val: unknown): string => {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
};

const getFlashcardsCollection = (userId: string) => {
  if (!userId) {
    throw new Error('User ID is required to access flashcards.');
  }
  return collection(db, 'users', userId, 'flashcards');
};

/**
 * Fetch flashcards for authenticated user, with optional subject and module filtering.
 */
export const getFlashcards = async (
  userId: string,
  subjectId?: string,
  moduleId?: string
): Promise<Flashcard[]> => {
  try {
    const cardsRef = getFlashcardsCollection(userId);
    let q = query(cardsRef, orderBy('createdAt', 'desc'));

    if (subjectId && subjectId !== 'all') {
      if (moduleId && moduleId !== 'all') {
        q = query(
          cardsRef,
          where('subjectId', '==', subjectId),
          where('moduleId', '==', moduleId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(cardsRef, where('subjectId', '==', subjectId), orderBy('createdAt', 'desc'));
      }
    }

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId,
        subjectId: data.subjectId || '',
        moduleId: data.moduleId || null,
        question: data.question || '',
        answer: data.answer || '',
        reviewStatus: (data.reviewStatus as FlashcardReviewStatus) || 'unreviewed',
        lastReviewedAt: data.lastReviewedAt ? formatTimestamp(data.lastReviewedAt) : null,
        reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('Error fetching flashcards:', err);

    // Fallback if composite index is missing
    const cardsRef = getFlashcardsCollection(userId);
    const querySnapshot = await getDocs(cardsRef);
    let list = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId,
        subjectId: data.subjectId || '',
        moduleId: data.moduleId || null,
        question: data.question || '',
        answer: data.answer || '',
        reviewStatus: (data.reviewStatus as FlashcardReviewStatus) || 'unreviewed',
        lastReviewedAt: data.lastReviewedAt ? formatTimestamp(data.lastReviewedAt) : null,
        reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });

    if (subjectId && subjectId !== 'all') {
      list = list.filter((c) => c.subjectId === subjectId);
    }
    if (moduleId && moduleId !== 'all') {
      list = list.filter((c) => c.moduleId === moduleId);
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
};

/**
 * Create a new flashcard.
 */
export const createFlashcard = async (
  userId: string,
  input: FlashcardInput
): Promise<Flashcard> => {
  const cleanQ = input.question.trim();
  const cleanA = input.answer.trim();

  if (!cleanQ) throw new Error('Flashcard question is required.');
  if (!cleanA) throw new Error('Flashcard answer is required.');
  if (!input.subjectId) throw new Error('Associated subject is required.');

  const cardsRef = getFlashcardsCollection(userId);
  const now = new Date().toISOString();

  const docRef = await addDoc(cardsRef, {
    subjectId: input.subjectId,
    moduleId: input.moduleId || null,
    question: cleanQ,
    answer: cleanA,
    reviewStatus: 'unreviewed',
    reviewCount: 0,
    lastReviewedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    userId,
    subjectId: input.subjectId,
    moduleId: input.moduleId || null,
    question: cleanQ,
    answer: cleanA,
    reviewStatus: 'unreviewed',
    reviewCount: 0,
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Update an existing flashcard's question, answer, or module/subject.
 */
export const updateFlashcard = async (
  userId: string,
  cardId: string,
  input: Partial<FlashcardInput>
): Promise<void> => {
  const cardDocRef = doc(db, 'users', userId, 'flashcards', cardId);
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.question !== undefined) payload.question = input.question.trim();
  if (input.answer !== undefined) payload.answer = input.answer.trim();
  if (input.subjectId !== undefined) payload.subjectId = input.subjectId;
  if (input.moduleId !== undefined) payload.moduleId = input.moduleId;

  await updateDoc(cardDocRef, payload);
};

/**
 * Update a card's review status ("know it" or "review again").
 */
export const updateFlashcardReview = async (
  userId: string,
  cardId: string,
  status: FlashcardReviewStatus
): Promise<void> => {
  const cardDocRef = doc(db, 'users', userId, 'flashcards', cardId);
  await updateDoc(cardDocRef, {
    reviewStatus: status,
    lastReviewedAt: serverTimestamp(),
    reviewCount: increment(1),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Delete a flashcard.
 */
export const deleteFlashcard = async (userId: string, cardId: string): Promise<void> => {
  const cardDocRef = doc(db, 'users', userId, 'flashcards', cardId);
  await deleteDoc(cardDocRef);
};
