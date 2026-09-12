export type ExpirationPolicy = '1h' | '1d' | '7d' | 'never';

export interface DropFileItem {
  id: string;
  name: string;
  sizeBytes: number;
  type: string;
  mimeType?: string;
  content: string;
}

export interface DropPayload {
  id: string;
  key: string;
  name: string;
  type: string;
  mimeType?: string;
  sizeBytes: number;
  content: string;
  files?: DropFileItem[];
  createdTimeAgo: string;
  createdAt: number;
  expiresInText: string;
  expiresAt: number;
  expirationPolicy: ExpirationPolicy;
  cipher: string;
  sha256: string;
  version: string;
  verified: boolean;
  description: string;
  enclaveAttestation: string;
  pcr0: string;
  publicKeyOrigin: string;
  transfersConsumed: number;
  transfersMax: number;
  host: string;
  status: 'active' | 'burned' | 'expired';
}

export type ActiveTab = 'send' | 'receive' | 'active-shares' | 'transfer';

export interface GlobalTelemetryStats {
  downloadedFiles: number;
  sentTransfers: number;
  gigabytesSent: number;
  bytesSent?: number;
  rating: number;
  ratingsCount?: number;
}

export interface NearbyDevice {
  id: string;
  name: string;
  type: 'desktop' | 'laptop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  avatarColor: string;
  lastSeen: number;
  isCurrentDevice?: boolean;
  isReceiving?: boolean;
}

export interface NearbyTransferOffer {
  transferId: string;
  fromDevice: NearbyDevice;
  toDeviceId: string;
  file: {
    name: string;
    sizeBytes: number;
    type: string;
    mimeType?: string;
    content: string;
  };
  message?: string;
  timestamp: number;
}

export interface NearbyTransferResponse {
  transferId: string;
  toDeviceId: string;
  fromDeviceId: string;
  status: 'accepted' | 'declined';
  reason?: string;
}