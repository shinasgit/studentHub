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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StudyResource, ResourceInput } from '../types/resource';

const formatTimestamp = (val: unknown): string => {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
};

const getResourcesCollection = (userId: string) => {
  if (!userId) {
    throw new Error('User ID is required to access resources.');
  }
  return collection(db, 'users', userId, 'resources');
};

export const getResources = async (
  userId: string,
  subjectId?: string
): Promise<StudyResource[]> => {
  try {
    const resourcesRef = getResourcesCollection(userId);
    let q = query(resourcesRef, orderBy('createdAt', 'desc'));

    if (subjectId) {
      q = query(resourcesRef, where('subjectId', '==', subjectId), orderBy('createdAt', 'desc'));
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
        type: data.type || 'external-link',
        url: data.url || '',
        description: data.description || '',
        fileSize: data.fileSize || null,
        fileStorageKey: data.fileStorageKey || null,
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('Error fetching resources:', err);

    // If query with 'where' + 'orderBy' requires composite index, fallback to in-memory filter
    if (err.code === 'failed-precondition' || err.message?.includes('index')) {
      const resourcesRef = getResourcesCollection(userId);
      const querySnapshot = await getDocs(resourcesRef);
      let list = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId,
          subjectId: data.subjectId || '',
          moduleId: data.moduleId || null,
          title: data.title || '',
          type: data.type || 'external-link',
          url: data.url || '',
          description: data.description || '',
          fileSize: data.fileSize || null,
          fileStorageKey: data.fileStorageKey || null,
          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
        };
      });

      if (subjectId) {
        list = list.filter((r) => r.subjectId === subjectId);
      }

      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    throw error;
  }
};

export const createResource = async (
  userId: string,
  input: ResourceInput
): Promise<StudyResource> => {
  const resourcesRef = getResourcesCollection(userId);
  const now = new Date().toISOString();

  const docRef = await addDoc(resourcesRef, {
    subjectId: input.subjectId,
    moduleId: input.moduleId || null,
    title: input.title.trim(),
    type: input.type,
    url: input.url.trim(),
    description: (input.description || '').trim(),
    fileSize: input.fileSize || null,
    fileStorageKey: input.fileStorageKey || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    userId,
    subjectId: input.subjectId,
    moduleId: input.moduleId || null,
    title: input.title.trim(),
    type: input.type,
    url: input.url.trim(),
    description: (input.description || '').trim(),
    fileSize: input.fileSize || null,
    fileStorageKey: input.fileStorageKey || null,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateResource = async (
  userId: string,
  resourceId: string,
  input: Partial<ResourceInput>
): Promise<void> => {
  const resourceDocRef = doc(db, 'users', userId, 'resources', resourceId);
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.type !== undefined) payload.type = input.type;
  if (input.url !== undefined) payload.url = input.url.trim();
  if (input.subjectId !== undefined) payload.subjectId = input.subjectId;
  if (input.moduleId !== undefined) payload.moduleId = input.moduleId;
  if (input.description !== undefined) payload.description = input.description.trim();
  if (input.fileSize !== undefined) payload.fileSize = input.fileSize;
  if (input.fileStorageKey !== undefined) payload.fileStorageKey = input.fileStorageKey;

  await updateDoc(resourceDocRef, payload);
};

export const deleteResource = async (
  userId: string,
  resourceId: string
): Promise<void> => {
  const resourceDocRef = doc(db, 'users', userId, 'resources', resourceId);
  await deleteDoc(resourceDocRef);
};
