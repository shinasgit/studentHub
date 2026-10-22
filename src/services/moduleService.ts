import {
  collection,
  doc,
  getDoc,
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
import type { Module, ModuleInput, ModuleAttachment, ModuleLink } from '../types/module';

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

const normalizeAttachments = (data: Record<string, unknown>, id: string, createdAt: string): ModuleAttachment[] => {
  if (Array.isArray(data.attachments) && data.attachments.length > 0) {
    return data.attachments as ModuleAttachment[];
  }
  // Backward compatibility with single file attachment
  if (data.fileName && typeof data.fileName === 'string') {
    return [
      {
        id: `legacy-${id}`,
        name: data.fileName,
        size: (data.fileSize as string) || 'Attached Document',
        type: (data.fileType as string) || 'application/pdf',
        url: (data.fileUrl as string) || '',
        storageKey: (data.fileStorageKey as string) || undefined,
        uploadedAt: createdAt,
      },
    ];
  }
  return [];
};

const normalizeLinks = (data: Record<string, unknown>): ModuleLink[] => {
  if (Array.isArray(data.links)) {
    return data.links as ModuleLink[];
  }
  return [];
};

export const getModules = async (userId: string, subjectId: string): Promise<Module[]> => {
  try {
    const modulesRef = getModulesCollection(userId, subjectId);
    const q = query(modulesRef, orderBy('order', 'asc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const createdAt = formatTimestamp(data.createdAt);
      return {
        id: docSnap.id,
        subjectId,
        userId,
        title: data.title || '',
        description: data.description || '',
        order: typeof data.order === 'number' ? data.order : 0,
        completed: Boolean(data.completed),
        attachments: normalizeAttachments(data, docSnap.id, createdAt),
        links: normalizeLinks(data),
        fileName: data.fileName || null,
        fileUrl: data.fileUrl || null,
        fileSize: data.fileSize || null,
        fileStorageKey: data.fileStorageKey || null,
        fileType: data.fileType || null,
        createdAt,
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
        const createdAt = formatTimestamp(data.createdAt);
        return {
          id: docSnap.id,
          subjectId,
          userId,
          title: data.title || '',
          description: data.description || '',
          order: typeof data.order === 'number' ? data.order : 0,
          completed: Boolean(data.completed),
          attachments: normalizeAttachments(data, docSnap.id, createdAt),
          links: normalizeLinks(data),
          fileName: data.fileName || null,
          fileUrl: data.fileUrl || null,
          fileSize: data.fileSize || null,
          fileStorageKey: data.fileStorageKey || null,
          fileType: data.fileType || null,
          createdAt,
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
    description: (input.description || '').trim(),
    order: input.order,
    completed: Boolean(input.completed),
    attachments: input.attachments || [],
    links: input.links || [],
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
    description: (input.description || '').trim(),
    order: input.order,
    completed: Boolean(input.completed),
    attachments: input.attachments || [],
    links: input.links || [],
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
  if (input.description !== undefined) payload.description = input.description.trim();
  if (input.order !== undefined) payload.order = input.order;
  if (input.completed !== undefined) payload.completed = input.completed;
  if (input.attachments !== undefined) payload.attachments = input.attachments;
  if (input.links !== undefined) payload.links = input.links;
  if (input.fileName !== undefined) payload.fileName = input.fileName;
  if (input.fileUrl !== undefined) payload.fileUrl = input.fileUrl;
  if (input.fileSize !== undefined) payload.fileSize = input.fileSize;
  if (input.fileStorageKey !== undefined) payload.fileStorageKey = input.fileStorageKey;
  if (input.fileType !== undefined) payload.fileType = input.fileType;

  await updateDoc(moduleDocRef, payload);
};

export const addModuleAttachment = async (
  userId: string,
  subjectId: string,
  moduleId: string,
  attachment: ModuleAttachment
): Promise<ModuleAttachment[]> => {
  const moduleDocRef = doc(db, 'users', userId, 'subjects', subjectId, 'modules', moduleId);
  const snap = await getDoc(moduleDocRef);
  if (!snap.exists()) {
    throw new Error('Module does not exist.');
  }

  const data = snap.data();
  const currentAttachments = normalizeAttachments(data, moduleId, new Date().toISOString());
  const updatedAttachments = [...currentAttachments, attachment];

  await updateDoc(moduleDocRef, {
    attachments: updatedAttachments,
    updatedAt: serverTimestamp(),
  });

  return updatedAttachments;
};

export const deleteModuleAttachment = async (
  userId: string,
  subjectId: string,
  moduleId: string,
  attachmentId: string
): Promise<ModuleAttachment[]> => {
  const moduleDocRef = doc(db, 'users', userId, 'subjects', subjectId, 'modules', moduleId);
  const snap = await getDoc(moduleDocRef);
  if (!snap.exists()) {
    throw new Error('Module does not exist.');
  }

  const data = snap.data();
  const currentAttachments = normalizeAttachments(data, moduleId, new Date().toISOString());
  const updatedAttachments = currentAttachments.filter((att) => att.id !== attachmentId);

  await updateDoc(moduleDocRef, {
    attachments: updatedAttachments,
    updatedAt: serverTimestamp(),
  });

  return updatedAttachments;
};

export const addModuleLink = async (
  userId: string,
  subjectId: string,
  moduleId: string,
  linkInput: { title: string; url: string; description?: string }
): Promise<ModuleLink[]> => {
  const moduleDocRef = doc(db, 'users', userId, 'subjects', subjectId, 'modules', moduleId);
  const snap = await getDoc(moduleDocRef);
  if (!snap.exists()) {
    throw new Error('Module does not exist.');
  }

  const data = snap.data();
  const currentLinks = normalizeLinks(data);
  const newLink: ModuleLink = {
    id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: linkInput.title.trim(),
    url: linkInput.url.trim(),
    description: (linkInput.description || '').trim(),
    createdAt: new Date().toISOString(),
  };

  const updatedLinks = [...currentLinks, newLink];

  await updateDoc(moduleDocRef, {
    links: updatedLinks,
    updatedAt: serverTimestamp(),
  });

  return updatedLinks;
};

export const deleteModuleLink = async (
  userId: string,
  subjectId: string,
  moduleId: string,
  linkId: string
): Promise<ModuleLink[]> => {
  const moduleDocRef = doc(db, 'users', userId, 'subjects', subjectId, 'modules', moduleId);
  const snap = await getDoc(moduleDocRef);
  if (!snap.exists()) {
    throw new Error('Module does not exist.');
  }

  const data = snap.data();
  const currentLinks = normalizeLinks(data);
  const updatedLinks = currentLinks.filter((l) => l.id !== linkId);

  await updateDoc(moduleDocRef, {
    links: updatedLinks,
    updatedAt: serverTimestamp(),
  });

  return updatedLinks;
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
