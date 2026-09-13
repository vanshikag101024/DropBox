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

export async function saveDropToFirestore(drop: DropPayload): Promise<void> {
  const docRef = doc(db, DROPS_COLLECTION, drop.id);
  await setDoc(docRef, {
    ...drop,
    savedAt: Date.now(),
  });
}

export async function getDropFromFirestore(id: string): Promise<DropPayload | null> {
  const docRef = doc(db, DROPS_COLLECTION, id);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data() as DropPayload;
  const now = Date.now();

  if (data.expiresAt && data.expiresAt <= now) {
    await deleteDoc(docRef).catch(() => {});
    return null;
  }

  if (data.expirationPolicy === 'never' && data.transfersConsumed >= data.transfersMax) {
    await deleteDoc(docRef).catch(() => {});
    return null;
  }

  return data;
}

export async function deleteDropFromFirestore(id: string): Promise<void> {
  const docRef = doc(db, DROPS_COLLECTION, id);
  await deleteDoc(docRef);
}

export async function consumeDropInFirestore(id: string): Promise<void> {
  const docRef = doc(db, DROPS_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;

  const data = snap.data() as DropPayload;
  const newCount = (data.transfersConsumed || 0) + 1;

  if (data.expirationPolicy === 'never' && newCount >= (data.transfersMax || 1)) {
    await deleteDoc(docRef);
  } else {
    await updateDoc(docRef, {
      transfersConsumed: increment(1),
    });
  }
}

export async function listActiveDropsFromFirestore(): Promise<DropPayload[]> {
  const colRef = collection(db, DROPS_COLLECTION);
  const snap = await getDocs(colRef);
  const now = Date.now();
  const activeDrops: DropPayload[] = [];

  for (const document of snap.docs) {
    const item = document.data() as DropPayload;
    if (item.expiresAt && item.expiresAt <= now) {
      deleteDoc(doc(db, DROPS_COLLECTION, item.id)).catch(() => {});
      continue;
    }
    if (item.expirationPolicy === 'never' && item.transfersConsumed >= item.transfersMax) {
      deleteDoc(doc(db, DROPS_COLLECTION, item.id)).catch(() => {});
      continue;
    }
    activeDrops.push(item);
  }

  return activeDrops;
}

export async function purgeExpiredDropsFromFirestore(): Promise<number> {
  try {
    const colRef = collection(db, DROPS_COLLECTION);
    const now = Date.now();
    const q = query(colRef, where('expiresAt', '<=', now));
    const snap = await getDocs(q);
    let purged = 0;
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
      purged++;
    }
    return purged;
  } catch (err) {
    console.warn('Firestore purge warning:', err);
    return 0;
  }
}