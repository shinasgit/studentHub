// AI Student Hub - Stage 8.2 Safe ChromaDB Migration & Backup Utility
// Run with: npx vite-node scripts/migrate_embeddings_v2.mjs

import {
  checkCollectionPrefixStatus,
  createSafeBackupCollection,
} from '../src/services/ragMigrationService.ts';
import { getCollectionStats, listCollections } from '../src/services/chromaService.ts';

console.log('\n=============================================================');
console.log('🛡️ RAG STAGE 8.2: CHROMADB SAFE MIGRATION & BACKUP UTILITY');
console.log('=============================================================\n');

async function main() {
  console.log('1. Inspecting local ChromaDB server...');
  const collections = await listCollections();
  console.log(`Found ${collections.length} active collection(s) in ChromaDB:\n`);

  for (const col of collections) {
    const stats = await getCollectionStats(col.name);
    console.log(`- Collection: "${col.name}" (Total vectors: ${stats.totalVectors})`);
  }

  console.log('\n2. Assessing Nomic task prefix migration status...');
  const defaultCol = 'student_hub_documents';
  const hasDefault = collections.some((c) => c.name === defaultCol);

  if (!hasDefault) {
    console.log(`Collection "${defaultCol}" is empty or not yet created.`);
    console.log('All future PDF uploads will automatically be embedded with "search_document: "');
    console.log('and tagged with embeddingVersion: "v2_nomic_prefix".');
    console.log('\n✅ Migration Status: Clean baseline. No legacy data to migrate.');
    return;
  }

  const status = await checkCollectionPrefixStatus(defaultCol);
  console.log(`Collection: "${status.collectionName}"`);
  console.log(`Total vectors: ${status.totalVectors}`);
  console.log(`Prefixed vectors (v2): ${status.prefixedVectorsV2}`);
  console.log(`Legacy unprefixed vectors (v1): ${status.legacyVectorsV1}`);

  if (status.needsMigration) {
    console.log('\n⚠️ Found legacy unprefixed vectors.');
    console.log('Creating safe timestamped backup before migration...');
    const backupResult = await createSafeBackupCollection(defaultCol);
    console.log(`✅ Backup successfully created: "${backupResult.backupCollectionName}"`);
    console.log(`Copied ${backupResult.recordsCopied} records safely.`);
    console.log('\nSafe Migration Instructions:');
    console.log('1. Re-index your course PDFs via the UI or reindexPdfDocument API.');
    console.log('2. New vectors are automatically stored with "search_document: " prefix and version v2.');
    console.log('3. Your backup collection remains untouched in case rollback is ever needed.');
  } else {
    console.log('\n✅ Collection is fully up to date with v2 Nomic task prefixes.');
  }

  console.log('\n=============================================================');
  console.log('🎉 MIGRATION ASSESSMENT COMPLETED SAFELY (0 DATA DELETED)');
  console.log('=============================================================\n');
}

main().catch((err) => {
  console.error('Migration assessment error:', err);
  process.exit(1);
});
