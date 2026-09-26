import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  query,
  where,
  increment,
  onSnapshot,
  Firestore,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { DropPayload, GlobalTelemetryStats } from '../types';

setLogLevel('silent');

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db: Firestore = firebaseConfig.firestoreDatabaseId  ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : getFirestore(app);

export const TELEMETRY_COLLECTION = 'telemetry-stats';
export const TELEMETRY_DOC_ID = 'global';

export const DROPS_COLLECTION = 'ephemeral-vault-drops';

export async function getTelemetryStatsFromFirestore(): Promise<GlobalTelemetryStats> {
  try {
    const docRef = doc(db, TELEMETRY_COLLECTION, TELEMETRY_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const downloadedFiles = Number(data.downloadedFiles) || 0;
      const sentTransfers = Number(data.sentTransfers) || 0;
      const bytesSent = Number(data.bytesSent) || 0;
      const ratingsCount = Number(data.ratingsCount) || 0;
      const ratingsSum = Number(data.ratingsSum) || 0;
      const rating = ratingsCount > 0 ? Number((ratingsSum / ratingsCount).toFixed(1)) : 5.0;
      const gigabytesSent = Number((bytesSent / (1024 * 1024 * 1024)).toFixed(4));

      return {
        downloadedFiles,
        sentTransfers,
        gigabytesSent,
        bytesSent,
        rating,
        ratingsCount,
      };
    } else {
      const initial = {
        downloadedFiles: 0,
        sentTransfers: 0,
        bytesSent: 0,
        ratingsCount: 0,
        ratingsSum: 0,
        rating: 5.0,
        updatedAt: Date.now(),
      };
      await setDoc(docRef, initial).catch(() => {});
      return {
        downloadedFiles: 0,
        sentTransfers: 0,
        gigabytesSent: 0,
        bytesSent: 0,
        rating: 5.0,
        ratingsCount: 0,
      };
    }
  } catch (err) {
    console.warn('Telemetry fetch notice:', err);
    return {
      downloadedFiles: 0,
      sentTransfers: 0,
      gigabytesSent: 0,
      bytesSent: 0,
      rating: 5.0,
      ratingsCount: 0,
    };
  }
}

export function subscribeToTelemetryStats(
  callback: (stats: GlobalTelemetryStats) => void
): () => void {
  const docRef = doc(db, TELEMETRY_COLLECTION, TELEMETRY_DOC_ID);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const downloadedFiles = Number(data.downloadedFiles) || 0;
        const sentTransfers = Number(data.sentTransfers) || 0;
        const bytesSent = Number(data.bytesSent) || 0;
        const ratingsCount = Number(data.ratingsCount) || 0;
        const ratingsSum = Number(data.ratingsSum) || 0;
        const rating = ratingsCount > 0 ? Number((ratingsSum / ratingsCount).toFixed(1)) : 5.0;
        const gigabytesSent = Number((bytesSent / (1024 * 1024 * 1024)).toFixed(4));
        callback({
          downloadedFiles,
        sentTransfers,
          gigabytesSent,
          bytesSent,
          rating,
          ratingsCount,
        });
      }
    },
    (err) => {
      console.warn('Telemetry subscription notice:', err);
    }
  );
}

export async function recordSentTransferInFirestore(sizeBytes: number): Promise<void> {
  try {
    const docRef = doc(db, TELEMETRY_COLLECTION, TELEMETRY_DOC_ID);
    await setDoc(
      docRef,
      {
        sentTransfers: increment(1),
        bytesSent: increment(Math.max(0, sizeBytes)),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Telemetry record transfer error:', err);
  }
}

export async function recordDownloadedFileInFirestore(): Promise<void> {
  try {
    const docRef = doc(db, TELEMETRY_COLLECTION, TELEMETRY_DOC_ID);
    await setDoc(
      docRef,
      {
        downloadedFiles: increment(1),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Telemetry record download error:', err);
  }
}

export async function recordRatingInFirestore(ratingValue: number): Promise<GlobalTelemetryStats | null> {
  try {
    const docRef = doc(db, TELEMETRY_COLLECTION, TELEMETRY_DOC_ID);
    const snap = await getDoc(docRef);
    const current = snap.exists() ? snap.data() : {};
    const newCount = (Number(current.ratingsCount) || 0) + 1;
    const newSum = (Number(current.ratingsSum) || 0) + ratingValue;
    const newAvg = Number((newSum / newCount).toFixed(1));

    await setDoc(
      docRef,
      {
        ratingsCount: newCount,
        ratingsSum: newSum,
        rating: newAvg,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    const bytesSent = Number(current.bytesSent) || 0;
    return {
    downloadedFiles: Number(current.downloadedFiles) || 0,
      sentTransfers: Number(current.sentTransfers) || 0,
      gigabytesSent: Number((bytesSent / (1024 * 1024 * 1024)).toFixed(4)),
      bytesSent,
      rating: newAvg,
      ratingsCount: newCount,
    };
  } catch (err) {
    console.warn('Telemetry record rating error:', err);
    return null;
  }
}

const CHUNK_SIZE = 600000;

export async function saveDropToFirestore(drop: DropPayload): Promise<void> {
  try {
    const content = drop.content || '';
    const docRef = doc(db, DROPS_COLLECTION, drop.id);

    if (content.length > CHUNK_SIZE) {
      const chunksCount = Math.ceil(content.length / CHUNK_SIZE);
      const metaPayload = {
        ...drop,
        content: '',
        isChunked: true,
        chunksCount,
        savedAt: Date.now(),
      };
      await setDoc(docRef, metaPayload);

      for (let i = 0; i < chunksCount; i++) {
        const chunkStr = content.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkRef = doc(db, `${DROPS_COLLECTION}_chunks`, `${drop.id}_chunk_${i}`);
        await setDoc(chunkRef, {
          dropId: drop.id,
          index: i,
          data: chunkStr,
        });
      }
    } else {
      await setDoc(docRef, {
        ...drop,
        isChunked: false,
        savedAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn('saveDropToFirestore warning:', err);
  }
}

export async function getDropFromFirestore(id: string): Promise<DropPayload | null> {
  try {
    const docRef = doc(db, DROPS_COLLECTION, id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return null;
    }

    const data = snap.data() as any;
    const now = Date.now();

    if (data.expiresAt && data.expiresAt > 0 && data.expiresAt <= now) {
      await deleteDropFromFirestore(id).catch(() => {});
      return null;
    }

    if (data.expirationPolicy === 'never' && data.transfersConsumed >= data.transfersMax) {
      await deleteDropFromFirestore(id).catch(() => {});
      return null;
    }

    if (data.isChunked && data.chunksCount > 0) {
      const chunkPromises = [];
      for (let i = 0; i < data.chunksCount; i++) {
        const chunkRef = doc(db, `${DROPS_COLLECTION}_chunks`, `${id}_chunk_${i}`);
        chunkPromises.push(getDoc(chunkRef));
      }
      const chunkSnaps = await Promise.all(chunkPromises);
      let fullContent = '';
      for (const chunkSnap of chunkSnaps) {
        if (chunkSnap.exists()) {
          fullContent += chunkSnap.data().data || '';
        }
      }
      return {
        ...data,
        content: fullContent,
      } as DropPayload;
    }

    return data as DropPayload;
  } catch (err) {
    console.warn('getDropFromFirestore error:', err);
    return null;
  }
}

export async function deleteDropFromFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, DROPS_COLLECTION, id);
    const snap = await getDoc(docRef).catch(() => null);
    if (snap && snap.exists()) {
      const data = snap.data();
      if (data.isChunked && data.chunksCount) {
        for (let i = 0; i < data.chunksCount; i++) {
          deleteDoc(doc(db, `${DROPS_COLLECTION}_chunks`, `${id}_chunk_${i}`)).catch(() => {});
        }
      }
    }
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('deleteDropFromFirestore warning:', err);
  }
}

export async function consumeDropInFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, DROPS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const data = snap.data() as DropPayload;
    const newCount = (data.transfersConsumed || 0) + 1;

    if (data.expirationPolicy === 'never' && newCount >= (data.transfersMax || 1)) {
      await deleteDropFromFirestore(id);
    } else {
      await updateDoc(docRef, {
        transfersConsumed: increment(1),
      });
    }
  } catch (err) {
    console.warn('consumeDropInFirestore warning:', err);
  }
}

export async function listActiveDropsFromFirestore(): Promise<DropPayload[]> {
  try {
    const colRef = collection(db, DROPS_COLLECTION);
    const snap = await getDocs(colRef);
    const now = Date.now();
    const activeDrops: DropPayload[] = [];

    for (const document of snap.docs) {
      const item = document.data() as DropPayload;
      if (item.expiresAt && item.expiresAt > 0 && item.expiresAt <= now) {
        deleteDropFromFirestore(item.id).catch(() => {});
        continue;
      }
      if (item.expirationPolicy === 'never' && item.transfersConsumed >= item.transfersMax) {
        deleteDropFromFirestore(item.id).catch(() => {});
        continue;
      }
      activeDrops.push(item);
    }

    return activeDrops;
  } catch (err) {
    console.warn('listActiveDropsFromFirestore warning:', err);
    return [];
  }
}

export async function purgeExpiredDropsFromFirestore(): Promise<number> {
  try {
    const colRef = collection(db, DROPS_COLLECTION);
    const now = Date.now();
    const q = query(colRef, where('expiresAt', '<=', now));
    const snap = await getDocs(q);
    let purged = 0;
    for (const d of snap.docs) {
      if (d.data().expiresAt > 0) {
        await deleteDropFromFirestore(d.id);
        purged++;
      }
    }
    return purged;
  } catch (err) {
    console.warn('Firestore purge warning:', err);
    return 0;
  }
}

export const NEARBY_COLLECTION = 'ephemeral-vault-nearby';
export const OFFERS_COLLECTION = 'ephemeral-vault-offers';

export async function announcePresenceInCloud(device: any, isReceiving: boolean = false): Promise<any[]> {
  try {
    const docRef = doc(db, NEARBY_COLLECTION, device.id);
    await setDoc(
      docRef,
      {
        ...device,
        isReceiving: Boolean(isReceiving),
        lastSeen: Date.now(),
      },
      { merge: true }
    );

    const colRef = collection(db, NEARBY_COLLECTION);
    const snap = await getDocs(colRef);
    const now = Date.now();
    const active: any[] = [];
    for (const d of snap.docs) {
      const devData = d.data();
      if (now - devData.lastSeen <= 45000) {
        if (devData.id !== device.id) {
          active.push(devData);
        }
      } else {
        deleteDoc(d.ref).catch(() => {});
      }
    }
    return active;
  } catch (err) {
    console.warn('Cloud presence notice:', err);
    return [];
  }
}

export function subscribeToCloudPresence(
  localDeviceId: string,
  onUpdate: (devices: any[]) => void
): () => void {
  const colRef = collection(db, NEARBY_COLLECTION);
  return onSnapshot(
    colRef,
    (snap) => {
      const now = Date.now();
      const active: any[] = [];
      for (const d of snap.docs) {
        const devData = d.data();
        if (devData.id !== localDeviceId && now - devData.lastSeen <= 45000) {
          active.push(devData);
        }
      }
      onUpdate(active);
    },
    (err) => {
      console.warn('Cloud presence subscription warning:', err);
    }
  );
}

export function subscribeToCloudOffers(
  localDeviceId: string,
  onOffer: (offer: any) => void
): () => void {
  const colRef = collection(db, OFFERS_COLLECTION);
  const q = query(colRef, where('toDeviceId', '==', localDeviceId));
  return onSnapshot(
    q,
    (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'added') {
          const offer = change.doc.data();
          onOffer(offer);
          deleteDoc(change.doc.ref).catch(() => {});
        }
      }
    },
    (err) => {
      console.warn('Cloud offers subscription warning:', err);
    }
  );
}

export async function sendCloudTransferOffer(offerPayload: any): Promise<boolean> {
  try {
    const offerId = offerPayload.transferId || `tx-${Date.now()}`;
    const docRef = doc(db, OFFERS_COLLECTION, offerId);
    await setDoc(docRef, {
      ...offerPayload,
      timestamp: Date.now(),
    });
    return true;
  } catch (err) {
    console.warn('Send cloud transfer offer error:', err);
    return false;
  }
}