// File Storage Service using browser IndexedDB (100% Free, Zero Billing, Offline-Capable)
// Stores real files selected from the student's computer/file manager.

const DB_NAME = 'StudentHub_FileVault';
const DB_VERSION = 1;
const STORE_NAME = 'module_files';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'txt',
  'jpg',
  'jpeg',
  'png',
  'webp',
];

interface StoredFileRecord {
  key: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  savedAt: number;
}

// Initialize or get the IndexedDB database
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Validate a user selected file for format and size limits.
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 25 MB limit (Current: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported file format (.${extension}). Supported: PDF, DOCX, PPTX, TXT, and Images.`,
    };
  }

  return { valid: true };
};

/**
 * Save a file from computer to IndexedDB.
 */
export const saveFileToVault = async (key: string, file: File): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record: StoredFileRecord = {
      key,
      name: file.name,
      type: file.type,
      size: file.size,
      blob: file,
      savedAt: Date.now(),
    };

    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Retrieve a file from IndexedDB by key.
 */
export const getFileFromVault = async (key: string): Promise<Blob | null> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const record = request.result as StoredFileRecord | undefined;
      resolve(record ? record.blob : null);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Search IndexedDB vault by file name or partial key if original storageKey is unknown.
 */
export const findFileInVaultByName = async (
  fileName: string
): Promise<{ blob: Blob; key: string } | null> => {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      const target = fileName.trim().toLowerCase();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          const record = cursor.value as StoredFileRecord;
          const recName = record.name?.toLowerCase() || '';
          const recKey = record.key?.toLowerCase() || '';
          if (recName === target || recName.endsWith(target) || recKey.includes(target)) {
            resolve({ blob: record.blob, key: record.key });
            return;
          }
          cursor.continue();
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

/**
 * Create a temporary object URL for a file stored in IndexedDB.
 */
export const getFileObjectUrl = async (key: string): Promise<string | null> => {
  try {
    const blob = await getFileFromVault(key);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Failed to get object URL from file vault:', err);
    return null;
  }
};

/**
 * Delete a file record from IndexedDB.
 */
export const deleteFileFromVault = async (key: string): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Format bytes to readable string (e.g. 2.4 MB or 450 KB).
 */
export const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
