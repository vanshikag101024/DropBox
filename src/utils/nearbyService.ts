import { NearbyDevice, NearbyTransferOffer } from '../types';

const COLORS = [
  '#f97316',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#eab308',
];

export function getLocalDevice(): NearbyDevice {
  const storedId = sessionStorage.getItem('ephem-nearby-device-id');
  const storedName = localStorage.getItem('ephem-nearby-device-name');
  const storedColor = sessionStorage.getItem('ephem-nearby-device-color');

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let type: NearbyDevice['type'] = 'laptop';
  let os = 'Unknown OS';
  let defaultName = 'Computer';

  if (/iPad|Tablet/i.test(ua)) {
    type = 'tablet';
    os = 'iPadOS';
    defaultName = 'iPad';
  } else if (/iPhone|iPod/i.test(ua)) {
    type = 'mobile';
    os = 'iOS';
    defaultName = 'iPhone';
  } else if (/Android/i.test(ua)) {
    type = 'mobile';
    os = 'Android';
    defaultName = 'Android Phone';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    type = 'laptop';
    os = 'macOS';
    defaultName = 'MacBook';
  } else if (/Windows/i.test(ua)) {
    type = 'desktop';
    os = 'Windows';
    defaultName = 'Windows PC';
  } else if (/Linux/i.test(ua)) {
    type = 'desktop';
    os = 'Linux';
    defaultName = 'Linux PC';
  }

  let browser = 'Browser';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  const id =
    storedId ||
    `dev-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36).slice(-4)}`;
  if (!storedId) {
    sessionStorage.setItem('ephem-nearby-device-id', id);
  }

  const avatarColor =
    storedColor || COLORS[Math.floor(Math.random() * COLORS.length)];
  if (!storedColor) {
    sessionStorage.setItem('ephem-nearby-device-color', avatarColor);
  }

  const tabSuffix = id.slice(-3).toUpperCase();
  const name = storedName || `${defaultName} (${tabSuffix})`;

  return {
    id,
    name,
    type,
    browser,
    os,
    avatarColor,
    lastSeen: Date.now(),
    isCurrentDevice: true,
  };
}

export function setCustomDeviceName(name: string): void {
  localStorage.setItem('ephem-nearby-device-name', name.trim());
}

let localMeshChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    localMeshChannel = new BroadcastChannel('ephemeravault-nearby-mesh');
  }
} catch {}

export async function announcePresence(
  device: NearbyDevice,
isReceiving: boolean = false
): Promise<NearbyDevice[]> {
  const payload: NearbyDevice = {
    ...device,
    isReceiving: Boolean(isReceiving),
  };

  try {
    localMeshChannel?.postMessage({ type: 'presence-ping', device: payload });
  } catch {}

  try {
    const res = await fetch('/api/nearby/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return (data.devices || []).map((d: NearbyDevice) => ({
        ...d,
        isCurrentDevice: d.id === device.id,
      }));
    }
  } catch (err) {
    console.debug('Nearby announce ping failed:', err);
  }
  return [];
}

export function broadcastLocalReceivingState(deviceId: string, isReceiving: boolean): void {
  try {
    localMeshChannel?.postMessage({
      type: 'presence-status',
      deviceId,
      isReceiving: Boolean(isReceiving),
    });
  } catch {}
}

export async function updateRemoteReceivingState(deviceId: string, isReceiving: boolean): Promise<void> {
  try {
    await fetch('/api/nearby/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deviceId, isReceiving: Boolean(isReceiving) }),
    });
  } catch (err) {
    console.debug('Nearby status update failed:', err);
  }
}

export function subscribeToLocalMesh(
  onDeviceDiscovered: (device: NearbyDevice) => void,
  onDeviceLeft: (deviceId: string) => void,
  onDeviceStatusChanged: (deviceId: string, isReceiving: boolean) => void,
  getCurrentState: () => { device: NearbyDevice; isReceiving: boolean }
): () => void {
  if (!localMeshChannel) return () => {};

  const handleMessage = (event: MessageEvent) => {
    try {
      const data = event.data;
      if (!data) return;
      const current = getCurrentState();

      if (data.type === 'presence-ping' && data.device) {
        if (data.device.id !== current.device.id) {
          onDeviceDiscovered(data.device);
          localMeshChannel?.postMessage({
            type: 'presence-pong',
            device: {
              ...current.device,
              isReceiving: current.isReceiving,
            },
          });
        }
      } else if (data.type === 'presence-pong' && data.device) {
        if (data.device.id !== current.device.id) {
          onDeviceDiscovered(data.device);
        }
      } else if (data.type === 'presence-status' && data.deviceId) {
        if (data.deviceId !== current.device.id) {
          onDeviceStatusChanged(data.deviceId, Boolean(data.isReceiving));
        }
      } else if (data.type === 'presence-leave' && data.deviceId) {
        onDeviceLeft(data.deviceId);
      }
    } catch {}
  };

  localMeshChannel.addEventListener('message', handleMessage);

  const initial = getCurrentState();
  localMeshChannel.postMessage({
    type: 'presence-ping',
    device: {
      ...initial.device,
      isReceiving: initial.isReceiving,
    },
  });

  return () => {
    localMeshChannel?.removeEventListener('message', handleMessage);
  };
}

export async function leavePresence(deviceId: string): Promise<void> {
  try {
    localMeshChannel?.postMessage({ type: 'presence-leave', deviceId });
  } catch {}

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/nearby/leave', JSON.stringify({ id: deviceId }));
    } else {
      await fetch('/api/nearby/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deviceId }),
        keepalive: true,
      });
    }
  } catch {}
}

export async function sendNearbyTransferOffer(
  fromDevice: NearbyDevice,
  toDeviceId: string,
  file: {
    name: string;
    sizeBytes: number;
    type: string;
    mimeType?: string;
    content: string;
  },
  message?: string
): Promise<{ success: boolean; transferId: string; error?: string }> {
  const transferId = `nb-tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  try {
    const res = await fetch('/api/nearby/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferId,
        fromDevice,
        toDeviceId,
        file,
        message,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, transferId, error: err.error || 'Failed to send transfer offer' };
    }
    return { success: true, transferId };
  } catch (e: any) {
    console.error('Failed to send transfer offer:', e);
    return { success: false, transferId, error: e.message || 'Network error' };
  }
}

export async function pollIncomingNearbyOffers(
  deviceId: string
): Promise<NearbyTransferOffer[]> {
  try {
    const res = await fetch(`/api/nearby/inbox/deviceId=${encodeURIComponent(deviceId)}`);
    if (res.ok) {
      const data = await res.json();
      return data.offers || [];
    }
  } catch {}
  return [];
}

export async function respondToNearbyTransfer(
  transferId: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  try {
    await fetch(`/api/nearby/transfer/${encodeURIComponent(transferId)}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  } catch (err) {
    console.warn('Respond to nearby transfer failed:', err);
  }
}

export function triggerDirectDownload(file: { name: string; content: string; mimeType?: string }): void {
  try {
    const { name, content, mimeType } = file;
    let objectUrl = '';

    if (content.startsWith('data:')) {
      objectUrl = content;
    } else {
      const blob = new Blob([content], { type: mimeType || 'application/octet-stream' });
      objectUrl = URL.createObjectURL(blob);
    }

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = name || 'file';
    link.target = '-blank';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        if (objectUrl && !objectUrl.startsWith('data:')) {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {}
    }, 500);
  } catch (err) {
    console.error('File download failed:', err);
  }
}