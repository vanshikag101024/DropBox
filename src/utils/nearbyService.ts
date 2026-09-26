import { NearbyDevice, NearbyTransferOffer } from '../types';
import { supabase } from '../services/supabase';

const COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308'
];

export function getlocalDevice(): NearbyDevice {
  const storedId = sessionStorage.getItem('ephem-nearby-device-id');
  const storedName = localStorage.getItem('ephem-nearby-device-name');
  const storedColor = sessionStorage.getItem('ephem-nearby-device-color');

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let type: NearbyDevice['type'] = 'laptop';
  let os = 'Unknown OS';
  let defaultName = 'Computer';

  if (/iPad|Tablet/i.test(ua)) { type = 'tablet'; os = 'iPadOS'; defaultName = 'iPad'; }
  else if (/iPhone|iPod/i.test(ua)) { type = 'mobile'; os = 'iOS'; defaultName = 'iPhone'; }
  else if (/Android/i.test(ua)) { type = 'mobile'; os = 'Android'; defaultName = 'Android Phone'; }
  else if (/Macintosh|Mac OS X/i.test(ua)) { type = 'laptop'; os = 'macOS'; defaultName = 'MacBook'; }
  else if (/Windows/i.test(ua)) { type = 'desktop'; os = 'Windows'; defaultName = 'Windows PC'; }
  else if (/Linux/i.test(ua)) { type = 'desktop'; os = 'Linux'; defaultName = 'Linux PC'; }

  let browser = 'Browser';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  const id = storedId || `dev-${Math.random().toString(36).substring(2, 9)}`;
  if (!storedId) sessionStorage.setItem('ephem-nearby-device-id', id);

  const avatarColor = storedColor || COLORS[Math.floor(Math.random() * COLORS.length)];
  if (!storedColor) sessionStorage.setItem('ephem-nearby-device-color', avatarColor);

  const name = storedName || `${defaultName} (${id.slice(-3).toUpperCase()})`;

  return { id, name, type, browser, os, avatarColor, lastSeen: Date.now(), isCurrentDevice: true };
}

export function setCustomDeviceName(name: string): void {
  localStorage.setItem('ephem-nearby-device-name', name.trim());
}

let meshChannel: ReturnType<typeof supabase.channel> | null = null;
let activeDevices = new Map<string, NearbyDevice>();

export function subscribeToLocalMesh(
  onDeviceDiscovered: (device: NearbyDevice) => void,
  onDeviceLeft: (deviceId: string) => void,
  onDeviceStatusChanged: (deviceId: string, isReceiving: boolean) => void,
  getCurrentState: () => { device: NearbyDevice; isReceiving: boolean }
): () => void {
  
  if (!meshChannel) {
    meshChannel = supabase.channel('nearby-mesh', {
      config: { presence: { key: getCurrentState().device.id } }
    });
  }

  meshChannel
    .on('presence', { event: 'sync' }, () => {
      const state = meshChannel!.presenceState();
      const currentActiveIds = new Set<string>();

      for (const key in state) {
        if (key === getCurrentState().device.id) continue;
        const presences = state[key] as any[];
        if (presences && presences.length > 0) {
          const deviceData = presences[0].device as NearbyDevice;
          if (deviceData) {
            currentActiveIds.add(deviceData.id);
            const isNew = !activeDevices.has(deviceData.id);
            const oldStatus = activeDevices.get(deviceData.id)?.isReceiving;
            
            activeDevices.set(deviceData.id, deviceData);
            
            if (isNew) {
              onDeviceDiscovered(deviceData);
            } else if (oldStatus !== deviceData.isReceiving) {
              onDeviceStatusChanged(deviceData.id, Boolean(deviceData.isReceiving));
            }
          }
        }
      }

      // Check for leaves
      for (const [id] of activeDevices) {
        if (!currentActiveIds.has(id)) {
          activeDevices.delete(id);
          onDeviceLeft(id);
        }
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const state = getCurrentState();
        await meshChannel!.track({
          device: { ...state.device, isReceiving: state.isReceiving }
        });
      }
    });

  return () => {
    meshChannel?.unsubscribe();
    meshChannel = null;
    activeDevices.clear();
  };
}

export async function announcePresence(device: NearbyDevice, isReceiving: boolean = false): Promise<NearbyDevice[]> {
  if (meshChannel && meshChannel.state === 'joined') {
    await meshChannel.track({
      device: { ...device, isReceiving }
    });
  }
  return Array.from(activeDevices.values());
}

export async function updateRemoteReceivingState(deviceId: string, isReceiving: boolean): Promise<void> {
  if (meshChannel && meshChannel.state === 'joined') {
    const me = getlocalDevice();
    await meshChannel.track({
      device: { ...me, isReceiving }
    });
  }
}

export async function leavePresence(deviceId: string): Promise<void> {
  if (meshChannel) {
    await meshChannel.untrack();
  }
}

export async function sendNearbyTransferOffer(
  fromDevice: NearbyDevice,
  toDeviceId: string,
  file: { name: string; sizeBytes: number; type: string; mimeType?: string; content: string; },
  message?: string
): Promise<{ success: boolean; transferId: string; error?: string }> {
  const transferId = `nb-tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const offer: NearbyTransferOffer = {
    transferId, fromDevice, toDeviceId, file, message, timestamp: Date.now(),
  };

  if (meshChannel) {
    const res = await meshChannel.send({
      type: 'broadcast',
      event: `offer-${toDeviceId}`,
      payload: offer
    });
    if (res === 'ok') return { success: true, transferId };
  }
  return { success: false, transferId, error: 'Could not send offer.' };
}

export function subscribeToIncomingOffers(
  localDeviceId: string,
  onOffer: (offer: NearbyTransferOffer) => void
): () => void {
  if (!meshChannel) {
    meshChannel = supabase.channel('nearby-mesh');
    meshChannel.subscribe();
  }

  const handler = meshChannel.on('broadcast', { event: `offer-${localDeviceId}` }, (payload) => {
    onOffer(payload.payload as NearbyTransferOffer);
  });

  return () => {}; // Channel is managed globally
}

export async function respondToNearbyTransfer(
  transferId: string,
  status: 'accepted' | 'declined',
  toDeviceId?: string,
  fromDeviceId?: string
): Promise<void> {
  if (meshChannel && fromDeviceId) {
    await meshChannel.send({
      type: 'broadcast',
      event: `response-${fromDeviceId}`,
      payload: { transferId, status, toDeviceId, fromDeviceId }
    });
  }
}

export function subscribeToTransferResponses(
  localDeviceId: string,
  onResponse: (transferId: string, status: 'accepted'|'declined', toDeviceId: string) => void
): () => void {
  if (!meshChannel) {
    meshChannel = supabase.channel('nearby-mesh');
    meshChannel.subscribe();
  }

  meshChannel.on('broadcast', { event: `response-${localDeviceId}` }, (payload) => {
    const data = payload.payload;
    if (data.transferId && data.status && data.toDeviceId) {
      onResponse(data.transferId, data.status, data.toDeviceId);
    }
  });

  return () => {};
}

export function triggerDirectDownload(file: { name: string; content: string; mimeType?: string }): void {
  try {
    const { name, content, mimeType } = file;
    let objectUrl = content.startsWith('data:') ? content : URL.createObjectURL(new Blob([content], { type: mimeType || 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = objectUrl; link.download = name || 'file'; link.target = '-blank';
    document.body.appendChild(link); link.click();
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
      if (!objectUrl.startsWith('data:')) URL.revokeObjectURL(objectUrl);
    }, 500);
  } catch (err) { console.error('Download failed:', err); }
}