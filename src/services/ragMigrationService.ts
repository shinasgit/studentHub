// RAG Migration & Safe Reindexing Service for AI Student Hub
// Stage 8.2: Safe Non-Destructive Migration Strategy for Nomic Task Prefixes
// 100% Local Privacy, Idempotent, Never deletes database without verified backup

import {
  getCollectionStats,
  getOrCreateCollection,
  getCollection,
  getCollectionsEndpoint,
} from './chromaService';
import { NOMIC_EMBEDDING_VERSION } from './documentEmbeddingService';
import { DEFAULT_CHROMA_COLLECTION, type ChromaStorageOptions } from '../types/chroma';

/**
 * Migration assessment status for an indexed ChromaDB collection.
 */
export interface CollectionMigrationStatus {
  collectionName: string;
  totalVectors: number;
  prefixedVectorsV2: number;
  legacyVectorsV1: number;
  isFullyMigrated: boolean;
  needsMigration: boolean;
  backupRecommended: boolean;
}

/**
 * Checks the Nomic task prefix migration status of a ChromaDB collection.
 * Distinguishes between legacy unprefixed vectors and v2_nomic_prefix vectors.
 */
export const checkCollectionPrefixStatus = async (
  collectionName: string = DEFAULT_CHROMA_COLLECTION,
  options?: ChromaStorageOptions
): Promise<CollectionMigrationStatus> => {
  const stats = await getCollectionStats(collectionName, options);
  const total = stats.totalVectors;

  if (total === 0) {
    return {
      collectionName,
      totalVectors: 0,
      prefixedVectorsV2: 0,
      legacyVectorsV1: 0,
      isFullyMigrated: true,
      needsMigration: false,
      backupRecommended: false,
    };
  }

  // Fetch sample metadata records to evaluate version distribution
  const collection = await getCollection(collectionName, options);
  if (!collection) {
    throw new Error(`Collection "${collectionName}" not found in ChromaDB.`);
  }

  const endpoint = `${getCollectionsEndpoint(options?.customBaseUrl)}/${collection.id}/get`;
  let prefixedCount = 0;
  let legacyCount = 0;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        limit: Math.min(total, 500),
        include: ['metadatas'],
      }),
      signal: options?.abortSignal,
    });

    if (res.ok) {
      const data = (await res.json()) as { metadatas?: Array<Record<string, unknown> | null> };
      const metadatas = data.metadatas || [];

      for (const meta of metadatas) {
        if (meta && meta.embeddingVersion === NOMIC_EMBEDDING_VERSION) {
          prefixedCount++;
        } else {
          legacyCount++;
        }
      }
    }
  } catch (err) {
    console.warn('Could not sample collection metadata for migration check:', err);
  }

  const needsMigration = legacyCount > 0;

  return {
    collectionName,
    totalVectors: total,
    prefixedVectorsV2: prefixedCount,
    legacyVectorsV1: legacyCount,
    isFullyMigrated: !needsMigration,
    needsMigration,
    backupRecommended: needsMigration && total > 0,
  };
};

/**
 * Safely duplicates an existing ChromaDB collection into a timestamped backup collection.
 * Strictly NON-DESTRUCTIVE: The original collection is completely untouched.
 */
export const createSafeBackupCollection = async (
  sourceCollectionName: string = DEFAULT_CHROMA_COLLECTION,
  customBackupName?: string,
  options?: ChromaStorageOptions
): Promise<{ success: boolean; backupCollectionName: string; recordsCopied: number }> => {
  const sourceCol = await getCollection(sourceCollectionName, options);
  if (!sourceCol) {
    throw new Error(`Source collection "${sourceCollectionName}" does not exist in ChromaDB.`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = customBackupName || `${sourceCollectionName}_backup_${timestamp}`;

  // 1. Create target backup collection
  await getOrCreateCollection(backupName, options);
  const backupCol = await getCollection(backupName, options);
  if (!backupCol) {
    throw new Error(`Failed to create backup collection "${backupName}".`);
  }

  // 2. Fetch all records from source collection in chunks
  const getEndpoint = `${getCollectionsEndpoint(options?.customBaseUrl)}/${sourceCol.id}/get`;
  const addEndpoint = `${getCollectionsEndpoint(options?.customBaseUrl)}/${backupCol.id}/add`;

  let offset = 0;
  const batchSize = 100;
  let totalCopied = 0;

  while (true) {
    const getRes = await fetch(getEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        limit: batchSize,
        offset,
        include: ['documents', 'metadatas', 'embeddings'],
      }),
      signal: options?.abortSignal,
    });

    if (!getRes.ok) {
      throw new Error(`Failed to read source records for backup at offset ${offset}.`);
    }

    const data = (await getRes.json()) as {
      ids?: string[];
      documents?: Array<string | null>;
      embeddings?: number[][];
      metadatas?: Array<Record<string, unknown> | null>;
    };

    const ids = data.ids || [];
    if (ids.length === 0) {
      break;
    }

    const addRes = await fetch(addEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ids: ids,
        documents: data.documents || [],
        embeddings: data.embeddings || [],
        metadatas: data.metadatas || [],
      }),
      signal: options?.abortSignal,
    });

    if (!addRes.ok) {
      throw new Error(`Failed to write batch to backup collection "${backupName}".`);
    }

    totalCopied += ids.length;
    offset += ids.length;

    if (ids.length < batchSize) {
      break;
    }
  }

  return {
    success: true,
    backupCollectionName: backupName,
    recordsCopied: totalCopied,
  };
};
