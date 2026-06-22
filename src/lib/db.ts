import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { OfflineEntry } from '@/types'

interface AnimeQDB extends DBSchema {
  offline: {
    key: string
    value: OfflineEntry
    indexes: { 'by-mal': number }
  }
  blobs: {
    key: string
    value: Blob
  }
}

const DB_NAME = 'animeq'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<AnimeQDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<AnimeQDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('offline')) {
          const store = database.createObjectStore('offline', { keyPath: 'blobKey' })
          store.createIndex('by-mal', 'malId')
        }
        if (!database.objectStoreNames.contains('blobs')) {
          database.createObjectStore('blobs')
        }
      },
    })
  }
  return dbPromise
}

export const offlineStore = {
  async list(): Promise<OfflineEntry[]> {
    const all = await (await db()).getAll('offline')
    return all.sort((a, b) => b.addedAt - a.addedAt)
  },

  async get(blobKey: string): Promise<OfflineEntry | undefined> {
    return (await db()).get('offline', blobKey)
  },

  async getBlob(blobKey: string): Promise<Blob | undefined> {
    return (await db()).get('blobs', blobKey)
  },

  async save(entry: OfflineEntry, blob: Blob): Promise<void> {
    const database = await db()
    const tx = database.transaction(['offline', 'blobs'], 'readwrite')
    await tx.objectStore('offline').put(entry)
    await tx.objectStore('blobs').put(blob, entry.blobKey)
    await tx.done
  },

  async remove(blobKey: string): Promise<void> {
    const database = await db()
    const tx = database.transaction(['offline', 'blobs'], 'readwrite')
    await tx.objectStore('offline').delete(blobKey)
    await tx.objectStore('blobs').delete(blobKey)
    await tx.done
  },

  async has(malId: number): Promise<boolean> {
    const idx = await (await db()).countFromIndex('offline', 'by-mal', malId)
    return idx > 0
  },

  async totalSize(): Promise<number> {
    const all = await (await db()).getAll('offline')
    return all.reduce((sum, e) => sum + e.size, 0)
  },
}
