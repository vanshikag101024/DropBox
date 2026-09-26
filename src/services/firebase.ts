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

function isPermissionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.code || err);
  return msg.includes('permissions') || msg.includes('permission-denied');
}

export async function getTelemetryStatsFromFirestore(): Promise<GlobalTelemetryStats | null> {
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
    }
    return null;
  } catch (err) {
    if (!isPermissionError(err)) {
      console.debug('Telemetry fetch notice:', err);
    }
    return null;
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
      if (!isPermissionError(err)) {
        console.debug('Telemetry subscription notice:', err);
      }
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

const CHUNK_SIZE = 500000;

export async function saveDropToFirestore(drop: DropPayload): Promise<void> {
  try {
    const docRef = doc(db, DROPS_COLLECTION, drop.id);
    const jsonStr = JSON.stringify(drop);

    if (jsonStr.length > CHUNK_SIZE) {
      const chunksCount = Math.ceil(jsonStr.length / CHUNK_SIZE);
      const metaPayload = {
        id: drop.id,
        name: drop.name || 'Untitled',
        type: drop.type || 'File',
        sizeBytes: drop.sizeBytes || 0,
        expiresAt: drop.expiresAt || 0,
        expirationPolicy: drop.expirationPolicy || '1d',
        transfersConsumed: drop.transfersConsumed || 0,
        transfersMax: drop.transfersMax || 25,
        isJsonChunked: true,
        chunksCount,
        savedAt: Date.now(),
      };
      await setDoc(docRef, metaPayload);

      const BATCH_SIZE = 15;
      for (let i = 0; i < chunksCount; i += BATCH_SIZE) {
        const batchPromises = [];
        for (let j = i; j < Math.min(i + BATCH_SIZE, chunksCount); j++) {
          const chunkData = jsonStr.slice(j * CHUNK_SIZE, (j + 1) * CHUNK_SIZE);
          const chunkRef = doc(db, `${DROPS_COLLECTION}_chunks`, `${drop.id}_c_${j}`);
          batchPromises.push(setDoc(chunkRef, { dropId: drop.id, index: j, data: chunkData }));
        }
        await Promise.all(batchPromises);
      }
    } else {
      await setDoc(docRef, {
        ...drop,
        isJsonChunked: false,
        savedAt: Date.now(),
      });
    }
  } catch (err) {
    if (!isPermissionError(err)) {
      console.debug('saveDropToFirestore warning:', err);
    }
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

    if (data.isJsonChunked && data.chunksCount > 0) {
      const BATCH_SIZE = 20;
      let fullJson = '';
      for (let i = 0; i < data.chunksCount; i += BATCH_SIZE) {
        const batchPromises = [];
        for (let j = i; j < Math.min(i + BATCH_SIZE, data.chunksCount); j++) {
          const chunkRef = doc(db, `${DROPS_COLLECTION}_chunks`, `${id}_c_${j}`);
          batchPromises.push(getDoc(chunkRef));
        }
        const chunkSnaps = await Promise.all(batchPromises);
        for (const chunkSnap of chunkSnaps) {
          if (chunkSnap.exists()) {
            fullJson += chunkSnap.data().data || '';
          }
        }
      }
      if (fullJson) {
        const parsed = JSON.parse(fullJson) as DropPayload;
        parsed.transfersConsumed = data.transfersConsumed ?? parsed.transfersConsumed;
        return parsed;
      }
    }

    return data as DropPayload;
  } catch (err) {
    if (!isPermissionError(err)) {
      console.debug('getDropFromFirestore error:', err);
    }
    return null;
  }
}

export async function deleteDropFromFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, DROPS_COLLECTION, id);
    const snap = await getDoc(docRef).catch(() => null);
    if (snap && snap.exists()) {
      const data = snap.data();
      if (data.isJsonChunked && data.chunksCount) {
        for (let i = 0; i < data.chunksCount; i++) {
          deleteDoc(doc(db, `${DROPS_COLLECTION}_chunks`, `${id}_c_${i}`)).catch(() => {});
        }
      }
    }
    await deleteDoc(docRef);
  } catch (err) {
    if (!isPermissionError(err)) {
      console.debug('deleteDropFromFirestore warning:', err);
    }
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
    if (!isPermissionError(err)) {
      console.debug('consumeDropInFirestore warning:', err);
    }
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
    if (!isPermissionError(err)) {
      console.debug('listActiveDropsFromFirestore warning:', err);
    }
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
    if (!isPermissionError(err)) {
      console.debug('Firestore purge warning:', err);
    }
    return 0;
  }
}

export const NEARBY_COLLECTION = 'ephemeral-vault-nearby';
export const OFFERS_COLLECTION = 'ephemeral-vault-offers';
export const RESPONSES_COLLECTION = 'ephemeral-vault-responses';

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
    if (!isPermissionError(err)) {
      console.debug('Cloud presence notice:', err);
    }
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
      if (!isPermissionError(err)) {
        console.debug('Cloud presence subscription warning:', err);
      }
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
      if (!isPermissionError(err)) {
        console.debug('Cloud offers subscription warning:', err);
      }
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
    if (!isPermissionError(err)) {
      console.debug('Send cloud transfer offer error:', err);
    }
    return false;
  }
}

export async function sendCloudTransferResponse(responsePayload: any): Promise<boolean> {
  try {
    const id = responsePayload.transferId || `tx-res-${Date.now()}`;
    const docRef = doc(db, RESPONSES_COLLECTION, id);
    await setDoc(docRef, {
      ...responsePayload,
      timestamp: Date.now(),
    });
    return true;
  } catch (err) {
    if (!isPermissionError(err)) {
      console.debug('Send cloud transfer response error:', err);
    }
    return false;
  }
}

export function subscribeToCloudResponses(
  localDeviceId: string,
  onResponse: (response: any) => void
): () => void {
  const colRef = collection(db, RESPONSES_COLLECTION);
  const q = query(colRef, where('fromDeviceId', '==', localDeviceId));
  return onSnapshot(
    q,
    (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'added') {
          const resData = change.doc.data();
          onResponse(resData);
          deleteDoc(change.doc.ref).catch(() => {});
        }
      }
    },
    (err) => {
      if (!isPermissionError(err)) {
        console.debug('Cloud responses subscription warning:', err);
      }
    }
  );
}