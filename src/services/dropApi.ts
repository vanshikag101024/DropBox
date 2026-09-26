import { DropPayload, GlobalTelemetryStats } from '../types';
import {
  getTelemetryStatsFromFirestore,
  recordDownloadedFileInFirestore,
  recordSentTransferInFirestore,
  recordRatingInFirestore,
  subscribeToTelemetryStats,
  saveDropToFirestore,
  consumeDropInFirestore,
  deleteDropFromFirestore,
} from './firebase';


function extractDropFromHash(id: string): DropPayload | null {
  try {
    const hash = window.location.hash;
    if (!hash.includes('data=')) return null;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const encodedData = params.get('data');
    if (!encodedData) return null;
    const jsonStr = decodeURIComponent(atob(decodeURIComponent(encodedData)));
    const drop = JSON.parse(jsonStr) as DropPayload;
    if (drop && drop.id) {
      return drop;
    }
  } catch { }
  return null;
}

export const dropApi = {
  async getStats(): Promise<GlobalTelemetryStats> {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        return await res.json();
      }
    } catch { }

    try {
      const firestoreStats = await getTelemetryStatsFromFirestore();
      if (firestoreStats) {
        return firestoreStats;
      }
    } catch { }

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
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stats) return data.stats;
      }
    } catch { }

    try {
      const updated = await recordRatingInFirestore(rating);
      if (updated) return updated;
    } catch { }

    return null;
  },

  async listDrops(): Promise<DropPayload[]> {
    try {
      const res = await fetch('/api/drops');
      if (res.ok) {
        return await res.json();
      }
    } catch { }
    return [];
  },

  async getDrop(id: string): Promise<DropPayload> {
    try {
      const res = await fetch(`/api/drops/${encodeURIComponent(id)}`);
      if (res.ok) {
        const drop = await res.json();
        try {
          localStorage.setItem(`ephem-drop-${id}`, JSON.stringify(drop));
        } catch { }
        return drop;
      }
      if (res.status === 410) {
        throw new Error('Drop has expired.');
      }
    } catch (err: any) {
      if (err?.message?.includes('expired')) throw err;
    }

    try {
      const cached = localStorage.getItem(`ephem-drop-${id}`);
      if (cached) {
        const parsed = JSON.parse(cached) as DropPayload;
        const now = Date.now();
        if (!parsed.expiresAt || parsed.expiresAt === 0 || parsed.expiresAt > now) {
          return parsed;
        }
      }
    } catch { }

    const hashDrop = extractDropFromHash(id);
    if (hashDrop) {
      try {
        localStorage.setItem(`ephem-drop-${id}`, JSON.stringify(hashDrop));
      } catch { }
      return hashDrop;
    }

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
      console.debug('Server drop creation notice:', err);
    }

    const payload = (createdDrop || drop) as DropPayload;

    try {
      const jsonStr = JSON.stringify(payload);
      if (jsonStr.length < 5000000) {
        localStorage.setItem(`ephem-drop-${payload.id}`, jsonStr);
      }
    } catch { }

    saveDropToFirestore(payload).catch(() => { });
    recordSentTransferInFirestore(payload.sizeBytes || 0).catch(() => { });

    return payload;
  },

  async consumeDrop(id: string): Promise<DropPayload | null> {
    let result: DropPayload | null = null;
    try {
      const res = await fetch(`/api/drops/${encodeURIComponent(id)}/consume`, { method: 'POST' });
      if (res.ok) {
        result = await res.json();
      }
    } catch { }
    recordDownloadedFileInFirestore().catch(() => { });
    consumeDropInFirestore(id).catch(() => { });
    return result;
  },

  async deleteDrop(id: string): Promise<void> {
    fetch(`/api/drops/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => { });
    deleteDropFromFirestore(id).catch(() => { });
  },

  getDownloadUrl(id: string): string {
    return `/api/drops/${encodeURIComponent(id)}/download`;
  },
};