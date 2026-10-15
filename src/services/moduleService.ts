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
import type { Module, ModuleInput } from '../types/module';

const formatTimestamp = (val: unknown): string => {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
};

const getModulesCollection = (userId: string, subjectId: string) => {
  if (!userId || !subjectId) {
    throw new Error('Both userId and subjectId are required to access modules.');
  }
  return collection(db, 'users', userId, 'subjects', subjectId, 'modules');
};

export const getModules = async (userId: string, subjectId: string): Promise<Module[]> => {
  try {
    const modulesRef = getModulesCollection(userId, subjectId);
    const q = query(modulesRef, orderBy('order', 'asc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        subjectId,
        userId,
        title: data.title || '',
        order: typeof data.order === 'number' ? data.order : 0,
        completed: Boolean(data.completed),
        fileName: data.fileName || null,
        fileUrl: data.fileUrl || null,
        fileSize: data.fileSize || null,
        fileStorageKey: data.fileStorageKey || null,
        fileType: data.fileType || null,
        createdAt: formatTimestamp(data.createdAt),
        updatedAt: formatTimestamp(data.updatedAt),
      };
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('Error fetching modules:', err);

    // Fallback if index on 'order' is missing
    if (err.code === 'failed-precondition' || err.message?.includes('index')) {
      const modulesRef = getModulesCollection(userId, subjectId);
      const querySnapshot = await getDocs(modulesRef);
      const list = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          subjectId,
          userId,
          title: data.title || '',
          order: typeof data.order === 'number' ? data.order : 0,
          completed: Boolean(data.completed),
          fileName: data.fileName || null,
          fileUrl: data.fileUrl || null,
          fileSize: data.fileSize || null,
          fileStorageKey: data.fileStorageKey || null,
          fileType: data.fileType || null,
          createdAt: formatTimestamp(data.createdAt),
          updatedAt: formatTimestamp(data.updatedAt),
        };
      });
      return list.sort((a, b) => a.order - b.order);
    }

    throw error;
  }
};

export const createModule = async (
  userId: string,
  subjectId: string,
  input: ModuleInput
): Promise<Module> => {
  const modulesRef = getModulesCollection(userId, subjectId);
  const now = new Date().toISOString();

  const docRef = await addDoc(modulesRef, {
    title: input.title.trim(),
    order: input.order,
    completed: Boolean(input.completed),
    fileName: input.fileName || null,
    fileUrl: input.fileUrl || null,
    fileSize: input.fileSize || null,
    fileStorageKey: input.fileStorageKey || null,
    fileType: input.fileType || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    subjectId,
    userId,
    title: input.title.trim(),
    order: input.order,
    completed: Boolean(input.completed),
    fileName: input.fileName || null,
    fileUrl: input.fileUrl || null,
    fileSize: input.fileSize || null,
    fileStorageKey: input.fileStorageKey || null,
    fileType: input.fileType || null,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateModule = async (
  userId: string,
  subjectId: string,
  moduleId: string,
  input: Partial<ModuleInput>
): Promise<void> => {
  const moduleDocRef = doc(db, 'users', userId, 'subjects', subjectId, 'modules', moduleId);
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.order !== undefined) payload.order = input.order;
  if (input.completed !== undefined) payload.completed = input.completed;
  if (input.fileName !== undefined) payload.fileName = input.fileName;
  if (input.fileUrl !== undefined) payload.fileUrl = input.fileUrl;
  if (input.fileSize !== undefined) payload.fileSize = input.fileSize;
  if (input.fileStorageKey !== undefined) payload.fileStorageKey = input.fileStorageKey;
  if (input.fileType !== undefined) payload.fileType = input.fileType;

  await updateDoc(moduleDocRef, payload);
};

export const deleteModule = async (
  userId: string,
  subjectId: string,
  moduleId: string
): Promise<void> => {
  const moduleDocRef = doc(db, 'users', userId, 'subjects', subjectId, 'modules', moduleId);
  await deleteDoc(moduleDocRef);
};

export const toggleModuleCompletion = async (
  userId: string,
  subjectId: string,
  moduleId: string,
  currentStatus: boolean
): Promise<boolean> => {
  const nextStatus = !currentStatus;
  await updateModule(userId, subjectId, moduleId, { completed: nextStatus });
  return nextStatus;
};
