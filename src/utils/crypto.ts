import JSZip from 'jszip';
import { DropFileItem } from '../types';

export async function computeSha256(data: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err: any) {

    return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  }
}

export function generateCryptoKey(): string {
  try {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getShareableVaultUrl(vaultId: string, key?: string): string {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `${origin}${pathname}#vault=${encodeURIComponent(vaultId)}${key ? `&key=${encodeURIComponent(key)}` : ''}`;
}

export function getDirectRawUrl(vaultId: string): string {
  const origin = window.location.origin;
  return `${origin}/raw/${encodeURIComponent(vaultId)}`;
}

export function downloadPayloadFile(filename: string, content: string, mimeType?: string): void {

  if (content.startsWith('data:')) {
    try {
      const parts = content.split(',');
      const detectedMime = parts[0].match(/:(.*?);/)?.[1] || mimeType || 'application/octet-stream';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
    const blob = new Blob([u8arr], { type: detectedMime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
    link.download = filename;
    document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    } catch (e) {
      console.warn('Data URL blob decode fallback', e);
    }
  }

  const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadTextAsFile(filename: string, content: string): void {
  downloadPayloadFile(filename, content);
}

export async function downloadFilesAsZip(zipFilename: string, files: DropFileItem[]): Promise<void> {
  const zip = new JSZip();
  for (const f of files) {
    if (f.content.startsWith('data:')) {
      const parts = f.content.split(',');
      const b64Data = parts[1];
      zip.file(f.name, b64Data, { base64: true });
    } else {
      zip.file(f.name, f.content);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFilename.toLowerCase().endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
