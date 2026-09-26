import { DropPayload, GlobalTelemetryStats } from '../types';
import { supabase } from './supabase';

/**
 * Try to extract drop data embedded in the current URL hash.
 * Links encode the drop payload as base64 in &data=... for zero-server fallback.
 */
function extractDropFromHash(id: string): DropPayload | null {
  try {
    const hash = window.location.hash;
    if (!hash.includes('data=')) return null;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const encodedData = params.get('data');
    if (!encodedData) return null;
    const decoded = decodeURIComponent(encodedData);
    const jsonStr = decodeURIComponent(atob(decoded));
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
      const { data, error } = await supabase
        .from('telemetry_stats')
        .select('*')
        .eq('id', 'global')
        .single();
        
      if (!error && data) {
        return {
          downloadedFiles: data.downloadedFiles || 0,
          sentTransfers: data.sentTransfers || 0,
          gigabytesSent: data.gigabytesSent || 0,
          bytesSent: data.bytesSent || 0,
          rating: Number(data.rating) || 5.0,
          ratingsCount: data.ratingsCount || 0,
        };
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
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'telemetry_stats',
        },
        (payload) => {
          const data = payload.new;
          if (data && data.id === 'global') {
            callback({
              downloadedFiles: data.downloadedFiles || 0,
              sentTransfers: data.sentTransfers || 0,
              gigabytesSent: data.gigabytesSent || 0,
              bytesSent: data.bytesSent || 0,
              rating: Number(data.rating) || 5.0,
              ratingsCount: data.ratingsCount || 0,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async submitRating(rating: number): Promise<GlobalTelemetryStats | null> {
    try {
      const current = await this.getStats();
      const currentRating = current.rating || 5.0;
      const count = current.ratingsCount || 0;
      const newCount = count + 1;
      const newRating = ((currentRating * count) + rating) / newCount;

      const { data, error } = await supabase
        .from('telemetry_stats')
        .update({
          rating: newRating,
          ratingsCount: newCount
        })
        .eq('id', 'global')
        .select()
        .single();

      if (!error && data) {
        return {
          downloadedFiles: data.downloadedFiles || 0,
          sentTransfers: data.sentTransfers || 0,
          gigabytesSent: data.gigabytesSent || 0,
          bytesSent: data.bytesSent || 0,
          rating: Number(data.rating) || 5.0,
          ratingsCount: data.ratingsCount || 0,
        };
      }
    } catch { }

    return null;
  },

  async listDrops(): Promise<DropPayload[]> {
    try {
      const { data, error } = await supabase
        .from('drops')
        .select('*')
        .eq('status', 'active');
        
      if (!error && data) {
        return data as DropPayload[];
      }
    } catch { }
    return [];
  },

  async getDrop(id: string): Promise<DropPayload> {
    // 1. Try Supabase
    try {
      const { data, error } = await supabase
        .from('drops')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') {
        throw new Error('Drop has expired or not found.');
      }

      if (data) {
        // Cache in localStorage for future access
        try {
          localStorage.setItem(`ephem-drop-${id}`, JSON.stringify(data));
        } catch { }
        return data as DropPayload;
      }
    } catch (err: any) {
      if (err?.message?.includes('expired')) throw err;
    }

    // 2. Try localStorage (works same browser)
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

    // 3. Try hash-embedded data
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
    const payload = drop as DropPayload;

    // 1. Save to Supabase DB (supports up to ~1GB per row if configured, definitely handles 100MB base64 easily in Postgres)
    try {
      const { error } = await supabase
        .from('drops')
        .insert(payload);
        
      if (error) {
        console.warn('Supabase drop creation error:', error);
      }
    } catch (err) {
      console.warn('Supabase drop creation notice:', err);
    }

    // 2. Save to localStorage (reliable local backup, up to 5MB)
    try {
      const jsonStr = JSON.stringify(payload);
      if (jsonStr.length < 5000000) {
        localStorage.setItem(`ephem-drop-${payload.id}`, jsonStr);
      }
    } catch { }

    // Update telemetry
    try {
      const current = await this.getStats();
      const currentBytes = current.bytesSent || 0;
      const currentTransfers = current.sentTransfers || 0;
      const newBytes = currentBytes + (payload.sizeBytes || 0);
      const newGB = Math.floor(newBytes / (1024 * 1024 * 1024));

      await supabase
        .from('telemetry_stats')
        .update({
          sentTransfers: currentTransfers + 1,
          bytesSent: newBytes,
          gigabytesSent: newGB
        })
        .eq('id', 'global');
    } catch { }

    return payload;
  },

  async consumeDrop(id: string): Promise<DropPayload | null> {
    try {
      // Fetch drop
      const { data: dropData } = await supabase
        .from('drops')
        .select('*')
        .eq('id', id)
        .single();
        
      if (dropData) {
        const drop = dropData as DropPayload;
        const consumed = (drop.transfersConsumed || 0) + 1;
        
        // If it reached max views or is expired, mark it burned/deleted
        if (consumed >= (drop.transfersMax || 1) || (drop.expiresAt && drop.expiresAt < Date.now())) {
          await supabase.from('drops').delete().eq('id', id);
        } else {
          await supabase.from('drops').update({ transfersConsumed: consumed }).eq('id', id);
        }

        // Update telemetry
        const current = await this.getStats();
        await supabase
          .from('telemetry_stats')
          .update({
            downloadedFiles: (current.downloadedFiles || 0) + 1,
          })
          .eq('id', 'global');

        return drop;
      }
    } catch { }
    return null;
  },

  async deleteDrop(id: string): Promise<void> {
    try {
      await supabase.from('drops').delete().eq('id', id);
    } catch { }
  },

  getDownloadUrl(id: string): string {
    // For direct raw download, we still return the local route if running locally,
    // but on a static site, this won't work well without the backend. 
    // We can fallback to the client-side download logic that reads the payload.
    return `/api/drops/${encodeURIComponent(id)}/download`;
  },
};