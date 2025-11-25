/**
 * Offline Queue Service
 * Manages voice recordings when offline using IndexedDB
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface QueuedRecording {
  id: string;
  audioBlob: Blob;
  metadata: {
    recorded_at: string;
    duration: number;
    filename?: string;
  };
  timestamp: number;
  retryCount?: number;
}

interface OfflineQueueDB extends DBSchema {
  recordings: {
    key: string;
    value: QueuedRecording;
    indexes: { 'by-timestamp': number };
  };
}

class OfflineQueue {
  private db: IDBPDatabase<OfflineQueueDB> | null = null;
  private readonly DB_NAME = 'askmyfarm-offline';
  private readonly DB_VERSION = 1;

  async init() {
    if (this.db) return this.db;

    this.db = await openDB<OfflineQueueDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('recordings')) {
          const store = db.createObjectStore('recordings', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
        }
      },
    });

    return this.db;
  }

  async addRecording(recording: Omit<QueuedRecording, 'timestamp' | 'retryCount'>) {
    const db = await this.init();
    
    const queuedRecording: QueuedRecording = {
      ...recording,
      timestamp: Date.now(),
      retryCount: 0,
    };

    await db.put('recordings', queuedRecording);
    
    return queuedRecording;
  }

  async getAllRecordings(): Promise<QueuedRecording[]> {
    const db = await this.init();
    const recordings = await db.getAllFromIndex('recordings', 'by-timestamp');
    return recordings;
  }

  async getRecording(id: string): Promise<QueuedRecording | undefined> {
    const db = await this.init();
    return await db.get('recordings', id);
  }

  async removeRecording(id: string) {
    const db = await this.init();
    await db.delete('recordings', id);
  }

  async updateRetryCount(id: string) {
    const db = await this.init();
    const recording = await db.get('recordings', id);
    
    if (recording) {
      recording.retryCount = (recording.retryCount || 0) + 1;
      await db.put('recordings', recording);
    }
  }

  async getQueueSize(): Promise<number> {
    const db = await this.init();
    return await db.count('recordings');
  }

  async processQueue(
    uploadFunction: (recording: QueuedRecording) => Promise<void>,
    onProgress?: (current: number, total: number) => void
  ) {
    const recordings = await this.getAllRecordings();
    const total = recordings.length;

    if (total === 0) {
      return { success: 0, failed: 0 };
    }
    
    let success = 0;
    let failed = 0;

    for (let i = 0; i < recordings.length; i++) {
      const recording = recordings[i];
      
      try {
        onProgress?.(i + 1, total);
        await uploadFunction(recording);
        await this.removeRecording(recording.id);
        success++;
      } catch (error) {
        console.error(`❌ Failed to upload ${i + 1}/${total}:`, error);
        await this.updateRetryCount(recording.id);
        failed++;
        
        // Remove if retry count exceeds 3
        if ((recording.retryCount || 0) >= 3) {
          console.warn('⚠️ Max retries exceeded, removing:', recording.id);
          await this.removeRecording(recording.id);
        }
      }
    }

    return { success, failed };
  }

  async clearQueue() {
    const db = await this.init();
    await db.clear('recordings');
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();

