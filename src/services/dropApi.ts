import { DropPayload, GlobalTelemetryStats } from '../types';
import {
  getTelemetryStatsFromFirestore,
  recordDownloadedFileInFirestore,
  recordSentTransferInFirestore,
  recordRatingInFirestore,
  subscribeToTelemetryStats,
  listActiveDropsFromFirestore,
  saveDropToFirestore,
  getDropFromFirestore,
  consumeDropInFirestore,
  deleteDropFromFirestore,
} from './firebase';

export const dropApi = {
  async getStats(): Promise<GlobalTelemetryStats> {
    try {
      const firestoreStats = await getTelemetryStatsFromFirestore();
      if (firestoreStats) {
        return firestoreStats;
      }
    } catch {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }
    return {
      downloadedFiles: 0,
      sentTransfers: 0,
      gigabytesSent: 0,
      bytesSent: 0,
      rating: 5.0,
      ratingsCount: 0,
    };
  },

  subscribeStats(callback: (stats: GlobalTelemetryStats) => void): () => void {
    return subscribeToTelemetryStats(callback);
  },

  async submitRating(rating: number): Promise<GlobalTelemetryStats | null> {
    try {
      const updated = await recordRatingInFirestore(rating);
      fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      }).catch(() => {});

      if (updated) {
        return updated;
      }
    } catch (err) {
      console.warn('Error submitting rating to Firestore:', err);
    }
    return null;
  },

  async listDrops(): Promise<DropPayload[]> {
    try {
      const res = await fetch('/api/drops');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      try {
        return await listActiveDropsFromFirestore();
      } catch (err) {
        console.warn('Firestore fallback list error:', err);
        return [];
      }
    }
    return [];
  },

  async getDrop(id: string): Promise<DropPayload> {
    try {
      const res = await fetch(`/api/drops/${encodeURIComponent(id)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {}

    try {
      const firestoreDrop = await getDropFromFirestore(id);
      if (firestoreDrop) {
        return firestoreDrop;
      }
    } catch {}

    try {
      const cached = localStorage.getItem(`ephem-drop-${id}`);
      if (cached) {
        const parsed = JSON.parse(cached) as DropPayload;
        if (!parsed.expiresAt || parsed.expiresAt > Date.now()) {
          return parsed;
        }
      }
    } catch {}

    throw new Error('Drop expired or not found');
  },

  async createDrop(drop: Partial<DropPayload>): Promise<DropPayload> {
    let createdDrop: DropPayload | null = null;

    try {
      const res = await fetch('/api/drops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(drop),
      });
      if (res.ok) {
        createdDrop = await res.json();
      }
    } catch (err) {
      console.warn('Server drop creation warning:', err);
    }

    const payload = (createdDrop || drop) as DropPayload;

    try {
      await saveDropToFirestore(payload);
    } catch (err) {
      console.warn('Failed to save drop to Firestore:', err);
    }

    try {
      const jsonStr = JSON.stringify(payload);
      if (jsonStr.length < 2000000) {
        localStorage.setItem(`ephem-drop-${payload.id}`, jsonStr);
      }
    } catch {}

    try {
      await recordSentTransferInFirestore(payload.sizeBytes || 0);
    } catch (err) {
      console.warn('Failed to record sent transfer in Firestore:', err);
    }

    return payload;
  },

  async consumeDrop(id: string): Promise<DropPayload | null> {
    let result: DropPayload | null = null;
    try {
      const res = await fetch(`/api/drops/${encodeURIComponent(id)}/consume`, { method: 'POST' });
      if (res.ok) {
        result = await res.json();
      }
    } catch {}
    await recordDownloadedFileInFirestore().catch(() => {});
    await consumeDropInFirestore(id).catch(() => {});
    return result;
  },

  async deleteDrop(id: string): Promise<void> {
    fetch(`/api/drops/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    await deleteDropFromFirestore(id).catch(() => {});
  },

  getDownloadUrl(id: string): string {
    return `/api/drops/${encodeURIComponent(id)}/download`;
  },
};