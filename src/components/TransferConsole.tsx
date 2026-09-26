import React, { useState, useRef, useId, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ExpirationPolicy,
  DropPayload,
  DropFileItem,
  GlobalTelemetryStats,
  NearbyDevice,
  nearbyTransferResponse,
} from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  computeSha256,
  formatBytes,
  generateCryptoKey,
  getShareableVaultUrl,
  getDirectRawUrl,
  downloadPayloadFile,
  downloadFilesAsZip,
} from '../utils/crypto';
import { dropApi } from '../services/dropApi';
import { NearbyRadarView } from './NearbyRadarView';
import { sendNearbyTransferOffer } from '../utils/nearbyService';
import { FolderConfirmationModal } from './FolderConfirmationModal';
import { SuccessView } from './SuccessView';
import { GlobalTelemetry } from './GlobalTelemetry';

async function readDirectoryEntries(dirEntry: any, outFiles: File[]): Promise<void> {
  const reader = dirEntry.createReader();
  const readAllEntries = (): Promise<any[]> => {
    return new Promise((resolve) => {
      const all: any[] = [];
      const readBatch = () => {
        reader.readEntries(
          (entries: any[]) => {
            if (!entries || entries.length === 0) {
              resolve(all);
            } else {
              all.push(...entries);
              readBatch();
            }
          },
          () => resolve(all)
        );
      };
      readBatch();
    });
  };

  const entries = await readAllEntries();
  for (const entry of entries) {
    if (entry.isFile) {
      await new Promise<void>((res) => {
        entry.file(
          (file: File) => {
            outFiles.push(file);
            res();
          },
          () => res()
        );
      });
    } else if (entry.isDirectory) {
      await readDirectoryEntries(entry, outFiles);
    }
  }
}

interface TransferConsoleProps {
  onCreateDrop: (newDrop: DropPayload) => void;
  onViewDrop: (drop: DropPayload) => void;
  onShowToast: (msg: string) => void;
  initialMode?: 'send' | 'receive';
  stats?: GlobalTelemetryStats;
  localDevice: NearbyDevice;
  nearbyDevices: NearbyDevice[];
  nearbyTransferResponse?: nearbyTransferResponse | null;
  receiverSuccessEvent?: { id: string; title: string; subtitle: string } | null;
  onPromptRate?: () => void;
  onReceivingStateChange?: (isReceiving: boolean) => void;
  onReturnToHome?: () => void;
}

export function formatStatWithSpaces(value: number): string {
  const rounded = Math.floor(value);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export const TransferConsole: React.FC<TransferConsoleProps> = ({
  onCreateDrop,
  onViewDrop,
  onShowToast,
  initialMode = 'send',
  stats,
  localDevice,
  nearbyDevices,
  nearbyTransferResponse,
  receiverSuccessEvent,
  onPromptRate,
  onReceivingStateChange,
  onReturnToHome,
}) => {
  const { accent, accentHover, accentTint } = useTheme();
  const descriptorInputId = useId();

  const [consoleMode, setConsoleMode] = useState<'send' | 'receive'>(initialMode);
  const [transferMethod, setTransferMethod] = useState<'link' | 'nearby'>('link');
  const [receiveMethod, setReceiveMethod] = useState<'code' | 'nearby'>('code');

  useEffect(() => {
    setConsoleMode(initialMode);
    if (initialMode === 'send') {
      setReceiveMethod('code');
    }
  }, [initialMode]);

  useEffect(() => {
    const isLiveReceiving = consoleMode === 'receive' && receiveMethod === 'nearby';
    onReceivingStateChange?.(isLiveReceiving);
    return () => {
      onReceivingStateChange?.(false);
    };
  }, [consoleMode, receiveMethod, onReceivingStateChange]);

  const [sendingToDeviceId, setSendingToDeviceId] = useState<string | null>(null);
  const [transferSuccessDeviceId, setTransferSuccessDeviceId] = useState<string | null>(null);
  const [transferStatusMessage, setTransferStatusMessage] = useState<string | null>(null);
  const [successViewData, setSuccessViewData] = useState<{ title: string; subtitle: string } | null>(null);
  const handledResponseTransferIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!receiverSuccessEvent) return;
    setSuccessViewData({
      title: receiverSuccessEvent.title,
      subtitle: receiverSuccessEvent.subtitle,
    });
  }, [receiverSuccessEvent]);

  useEffect(() => {
    if (!successViewData) return;

    const timer = setTimeout(() => {
      setSuccessViewData(null);
      setSelectedFiles([]);
      setBufferText('');
      setGeneratedLink(null);
      setLatestCreatedDrop(null);
      setRetrievedDrop(null);
      setReceiveInput('');
      setIsPasteActive(false);
      setConsoleMode('send');
      setTransferMethod('link');
      setReceiveMethod('code');
      onReturnToHome?.();
      onPromptRate?.();
    }, 1800);

    return () => clearTimeout(timer);
  }, [successViewData, onReturnToHome, onPromptRate]);

  const [activeInputType, setActiveInputType] = useState<'file' | 'text'>('file');
  const [payloadDescriptor, setPayloadDescriptor] = useState('');
  const [bufferText, setBufferText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<DropFileItem[]>([]);
  const [expirationPolicy, setExpirationPolicy] = useState<ExpirationPolicy>('1d');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [latestCreatedDrop, setLatestCreatedDrop] = useState<DropPayload | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [pendingFolderConfirmation, setPendingFolderConfirmation] = useState<{
    folderName: string;
    files: File[];
    totalBytes: number;
  } | null>(null);

  const [isPasteActive, setIsPasteActive] = useState(false);
  const [receiveInput, setReceiveInput] = useState('');
  const [isSearchingReceive, setIsSearchingReceive] = useState(false);
  const [retrievedDrop, setRetrievedDrop] = useState<DropPayload | null>(null);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const receiveInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPasteActive) {
      const timer = setTimeout(() => {
        receiveInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isPasteActive]);

  const payloadBytes =
    activeInputType === 'text'
      ? new Blob([bufferText]).size
      : selectedFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (consoleMode === 'send') {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      let isAnyDirectory = false;
      const collectedFiles: File[] = [];
      let detectedFolderName = '';

      const promises: Promise<void>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
        if (entry) {
          if (entry.isDirectory) {
            isAnyDirectory = true;
            if (!detectedFolderName) detectedFolderName = entry.name;
            promises.push(readDirectoryEntries(entry, collectedFiles));
          } else if (entry.isFile) {
            const file = item.getAsFile();
            if (file) collectedFiles.push(file);
          }
        } else {
          const file = item.getAsFile();
          if (file) collectedFiles.push(file);
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      if (isAnyDirectory && collectedFiles.length > 0) {
        const totalBytes = collectedFiles.reduce((acc, f) => acc + f.size, 0);
        setPendingFolderConfirmation({
          folderName: detectedFolderName || 'Dropped folder',
          files: collectedFiles,
          totalBytes,
        });
        return;
      }
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      const firstWithPath = files.find((f: File) => f.webkitRelativePath);
      if (firstWithPath && files.length > 1) {
        const folderName = firstWithPath.webkitRelativePath.split('/')[0];
        const totalBytes = files.reduce((acc: number, f: File) => acc + f.size, 0);
        setPendingFolderConfirmation({
          folderName,
          files,
          totalBytes,
        });
        return;
      }
      setActiveInputType('file');
      processFiles(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      const firstWithPath = files.find((f: File) => f.webkitRelativePath);
      if (firstWithPath && files.length > 1) {
        const folderName = firstWithPath.webkitRelativePath.split('/')[0];
        const totalBytes = files.reduce((acc: number, f: File) => acc + f.size, 0);
        setPendingFolderConfirmation({
          folderName,
          files,
          totalBytes,
        });
        e.target.value = '';
        return;
      }
      setActiveInputType('file');
      processFiles(files);
      e.target.value = '';
    }
  };

  const handleOpenFolderPicker = () => {
    folderInputRef.current?.click();
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      let folderName = 'folder';
      const firstWithPath = files.find((f: File) => f.webkitRelativePath);
      if (firstWithPath) {
        const parts = firstWithPath.webkitRelativePath.split('/');
        if (parts.length > 1) {
          folderName = parts[0];
        }
      }
      const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
      setPendingFolderConfirmation({
        folderName,
        files,
        totalBytes,
      });
      e.target.value = '';
    }
  };

  const processFiles = (files: File[]) => {
    const newItems: DropFileItem[] = [];
    let pending = files.length;

    files.forEach((file) => {
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(file.name);
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(file.name);
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
      const isText =
        file.type.startsWith('text/') ||
        /\.(txt|sh|bash|json|js|ts|tsx|jsx|py|env|md|markdown|yml|yaml|html|css|sql|rs|go|c|cpp|h)$/i.test(file.name);

      let docType = 'Binary Archive';
      if (isImage) docType = 'Image';
      else if (isPdf) docType = 'PDF Document';
      else if (isAudio) docType = 'Audio';
      else if (isVideo) docType = 'Video';
      else if (isText) docType = 'Code / Text';

      const fallbackMime = isImage
        ? 'image/png'
        : isPdf
        ? 'application/pdf'
        : isAudio
        ? 'audio/mpeg'
        : isVideo
        ? 'video/mp4'
        : isText
        ? 'text/plain'
        : 'application/octet-stream';

      const mime = file.type || fallbackMime;

      const reader = new FileReader();
      reader.onload = () => {
        const content = typeof reader.result === 'string' ? reader.result : '';
        newItems.push({
          id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          sizeBytes: file.size,
          type: docType,
          mimeType: mime,
          content,
        });

        pending--;
        if (pending === 0) {
          setSelectedFiles((prev) => [...prev, ...newItems]);
          onShowToast(`Added ${files.length} file(s)`);
        }
      };
      if (isText && !isPdf && !isImage) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const handleRemoveFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  useEffect(() => {
    if (!nearbyTransferResponse || !sendingToDeviceId) return;

    if (
      nearbyTransferResponse.transferId &&
      handledResponseTransferIdRef.current === nearbyTransferResponse.transferId
    ) {
      return;
    }

    if (nearbyTransferResponse.status === 'accepted') {
      handledResponseTransferIdRef.current = nearbyTransferResponse.transferId || 'accepted';
      setSendingToDeviceId(null);
      setTransferSuccessDeviceId(null);
      setTransferStatusMessage(null);

      setSuccessViewData({
        title: 'Transfer Complete',
        subtitle: 'File delivered to recipient. Returning to home...',
      });
    } else if (nearbyTransferResponse.status === 'declined') {
      handledResponseTransferIdRef.current = nearbyTransferResponse.transferId || 'declined';
      setSendingToDeviceId(null);
      setTransferStatusMessage('Transfer declined by recipient.');
      onShowToast('Transfer declined by recipient.');
      const timer = setTimeout(() => {
        setTransferStatusMessage(null);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [nearbyTransferResponse, sendingToDeviceId, onShowToast, onPromptRate, onReturnToHome]);

  const handleSendToNearbyDevice = async (targetDevice: NearbyDevice) => {
    const hasContent = activeInputType === 'text' ? bufferText.trim().length > 0 : selectedFiles.length > 0;
    if (!hasContent) {
      onShowToast('Please select a file or enter a note to send.');
      fileInputRef.current?.click();
      return;
    }

    const primaryFile =
      activeInputType === 'text'
        ? {
            name: 'secret-note.txt',
            sizeBytes: new Blob([bufferText]).size,
            type: 'Text Note',
            mimeType: 'text/plain',
            content: bufferText,
          }
        : {
            name: selectedFiles[0].name,
            sizeBytes: selectedFiles[0].sizeBytes,
            type: selectedFiles[0].type || 'file',
            mimeType: selectedFiles[0].mimeType || 'application/octet-stream',
            content: selectedFiles[0].content,
          };

    handledResponseTransferIdRef.current = null;
    setTransferSuccessDeviceId(null);
    setSendingToDeviceId(targetDevice.id);
    setTransferStatusMessage(`Sending transfer offer to ${targetDevice.name}...`);

    const res = await sendNearbyTransferOffer(
      localDevice,
      targetDevice.id,
      primaryFile,
      payloadDescriptor.trim() || undefined
    );

    if (res.success) {
      setTransferStatusMessage(`Waiting for ${targetDevice.name} to accept...`);
      onShowToast(`Sent transfer offer to ${targetDevice.name}`);
    } else {
      setSendingToDeviceId(null);
      setTransferStatusMessage(null);
      onShowToast(`Failed to send: ${res.error || 'Connection error'}`);
    }
  };

  const handleCreateShareLink = async () => {
    const hasContent = activeInputType === 'text' ? bufferText.trim().length > 0 : selectedFiles.length > 0;
    if (!hasContent) {
      onShowToast(activeInputType === 'text' ? 'Please enter your note or code.' : 'Please add at least one file.');
      return;
    }

    setIsGenerating(true);

    const primaryContent =
      activeInputType === 'text'
        ? bufferText
        : selectedFiles[0]?.content || '';

    const name = payloadDescriptor.trim()
      ? payloadDescriptor.trim()
      : activeInputType === 'text'
      ? 'Untitled note'
      : selectedFiles.length === 1
      ? selectedFiles[0].name
      : `${selectedFiles.length} files (${selectedFiles[0].name} +${selectedFiles.length - 1})`;

    const rawSha256 = await computeSha256(primaryContent);
    const key = generateCryptoKey();
    const shortNum = Math.floor(1000 + Math.random() * 9000);
    const suffix = ['q', 'x', 'a', 'z', 'w', 'k'][Math.floor(Math.random() * 6)];
    const dropId = `EPHEM-${shortNum}-${suffix}`;

    let expiresInText = '23h 59m';
    let expiresAt = Date.now() + 24 * 3600 * 1000;
    if (expirationPolicy === '1h') {
      expiresInText = '59m 59s';
      expiresAt = Date.now() + 3600 * 1000;
    } else if (expirationPolicy === '7d') {
      expiresInText = '6d 23h';
      expiresAt = Date.now() + 7 * 24 * 3600 * 1000;
    } else if (expirationPolicy === 'never') {
      expiresInText = 'Single access (burn on read)';
      expiresAt = 0;
    }

    const mimeType =
      activeInputType === 'text'
        ? 'text/plain;charset=utf-8'
        : selectedFiles[0]?.mimeType || 'application/octet-stream';

    let typeLabel = 'Text / Raw';
    if (activeInputType === 'text') {
      if (name.endsWith('.sh')) typeLabel = 'Bash Script';
      else if (name.endsWith('.json')) typeLabel = 'JSON';
      else if (name.endsWith('.md')) typeLabel = 'Markdown';
      else if (name.endsWith('.env')) typeLabel = 'ENV Config';
    } else {
      typeLabel = selectedFiles.length > 1 ? 'Multi-file Archive' : selectedFiles[0]?.type || 'File';
    }

    const newDrop: DropPayload = {
      id: dropId,
      key,
      name,
      type: typeLabel,
      mimeType,
      sizeBytes: payloadBytes,
      content: primaryContent,
      files: activeInputType === 'text' ? undefined : selectedFiles,
      createdTimeAgo: 'Just now',
      createdAt: Date.now(),
      expiresInText,
      expiresAt,
      expirationPolicy,
      cipher: 'AES-256-GCM',
      sha256: rawSha256,
      version: 'v1.0.0',
      verified: true,
      description: '',
      enclaveAttestation: 'AWS Nitro Enclave v4',
      pcr0: 'Verified against KMS Hardware Authority',
      publicKeyOrigin: 'Vault-Transit-Ephemeral-Client',
      transfersConsumed: 0,
      transfersMax: expirationPolicy === 'never' ? 1 : 25,
      host: 'transfer-edge.internal',
      status: 'active',
    };

    onCreateDrop(newDrop);
    setLatestCreatedDrop(newDrop);

    const shareUrl = getShareableVaultUrl(dropId, key, newDrop);
    setGeneratedLink(shareUrl);
    setIsGenerating(false);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
      onShowToast('Transfer link ready and copied!');
    } else {
      onShowToast('Transfer link ready!');
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    onShowToast('Link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleResetSend = () => {
    setSelectedFiles([]);
    setBufferText('');
    setPayloadDescriptor('');
    setGeneratedLink(null);
    setLatestCreatedDrop(null);
  };

  const handleRetrieveDrop = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = receiveInput.trim();
    if (!query) {
      onShowToast('Please enter a transfer code or URL.');
      return;
    }

    setIsSearchingReceive(true);
    setReceiveError(null);
    setRetrievedDrop(null);

    let targetId = query;
    if (query.includes('#vault=')) {
      const match = query.match(/vault=([^&]+)/);
      if (match) targetId = decodeURIComponent(match[1]);
    } else if (query.includes('/')) {
      const parts = query.split('/');
      targetId = parts[parts.length - 1].split('?')[0].split('#')[0];
    }

    try {
      const drop = await dropApi.getDrop(targetId);
      setRetrievedDrop(drop);
      onShowToast(`Found transfer: ${drop.name}`);
    } catch {
      setReceiveError('Transfer not found or has expired / reached its single-burn limit.');
    } finally {
      setIsSearchingReceive(false);
    }
  };

  const handleDownloadRetrieved = async (drop: DropPayload) => {
    if (drop.files && drop.files.length > 1) {
      setIsZipping(true);
      await downloadFilesAsZip(`${drop.name}.zip`, drop.files);
      setIsZipping(false);
    } else {
      downloadPayloadFile(drop.name, drop.content, drop.mimeType);
    }
    await dropApi.consumeDrop(drop.id);

    setSuccessViewData({
      title: 'Transfer Complete',
      subtitle: 'File saved to Downloads. Returning to home...',
    });
  };

  const hasContentReady =
    activeInputType === 'text'
      ? bufferText.trim().length > 0
      : selectedFiles.length > 0;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
      className={`w-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col items-center relative z-10 transition-all duration-300 ${
        hasContentReady || generatedLink ? 'pt-1 sm:pt-2 pb-8' : 'py-6 sm:py-10'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />

      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 z-50 bg-sky-500/15 backdrop-blur-md border-4 border-dashed border-sky-500 flex flex-col items-center justify-center p-8 text-center pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full bg-white shadow-2xl flex items-center justify-center text-sky-600 mb-4 animate-bounce">
              <span className="material-symbols-outlined text-[36px]">upload</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              Drop files here to start transfer
            </h2>
            <p className="text-slate-600 text-sm">
              Single or multiple files, folders, or archives
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!hasContentReady && !generatedLink && !successViewData && (
        <div className="text-center max-w-2xl mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl lg:text-[54px] font-hand font-bold tracking-tight text-slate-900 mb-2 leading-tight"
          >
            {consoleMode === 'send'
              ? 'Simple and reliable file transfers'
              : 'Retrieve your shared transfer'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed"
          >
            {consoleMode === 'send'
              ? 'A simple and free way to securely share files and folders with zero friction.'
              : 'Enter a transfer code or URL below to securely download your files.'}
          </motion.p>
        </div>
      )}

      {successViewData ? (
        <div className="w-full flex flex-col items-center justify-center py-6 sm:py-10">
          <SuccessView
            title={successViewData.title}
            subtitle={successViewData.subtitle}
          />
        </div>
      ) : (
        <>
          {/* Mode toggle (Send / Receive) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/80 mb-6">
            <button
              id="toggle-mode-send"
              onClick={() => {
                setConsoleMode('send');
                setRetrievedDrop(null);
                setReceiveError(null);
              }}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[14px] font-semibold transition-all cursor-pointer ${
                consoleMode === 'send'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                arrow_upward
              </span>
              <span>Send</span>
            </button>

            <button
              id="toggle-mode-receive"
              onClick={() => {
                setConsoleMode('receive');
                setReceiveMethod('code');
              }}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[14px] font-semibold transition-all cursor-pointer ${
                consoleMode === 'receive'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                arrow_downward
              </span>
              <span>Receive</span>
            </button>
          </div>

          {consoleMode === 'send' && (
            <div className="w-full flex flex-col items-center">
              {!hasContentReady && !generatedLink && (
                <div className="relative w-full max-w-[310px] pt-1">
                  <motion.div
                    animate={{ y: [-16, 16, -16] }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    id="upload-select-container"
                    className="relative w-full bg-white rounded-xl sm:rounded-2xl px-4 pt-3.5 pb-4 sm:px-4.5 sm:pt-3.5 sm:pb-4 shadow-xl border border-slate-100 flex flex-col items-center text-center transition-all duration-300"
                    style={{
                      boxShadow:
                        '0 14px 30px -10px rgba(0, 0, 0, 0.07), 0 0 0 1px rgba(0, 0, 0, 0.03)',
                      borderColor: isDragging ? accent : undefined,
                    }}
                  >
                    <div
                      className="absolute -top-1.5 left-[calc(50%-58px)] -translate-x-1/2 w-3.5 h-3.5 bg-white rotate-45 border-l border-t border-slate-200 z-20"
                      style={{
                        borderColor: isDragging ? accent : undefined,
                      }}
                    />

                    <div
                      id="dropzone-text-area"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full cursor-pointer group pt-0.5 pb-0 flex flex-col items-center select-none"
                    >
                      <h2 className="text-[15px] sm:text-[16px] font-normal text-slate-800 group-hover:text-slate-950 transition-colors tracking-tight leading-snug font-sans">
                        Click or drag-and-drop
                        <br />
                        your files here
                      </h2>
                    </div>

                    <div className="w-full flex items-center gap-2.5 my-2 sm:my-2.5">
                      <div className="flex-1 h-px bg-slate-200/80" />
                      <span className="text-[10px] sm:text-[10.5px] font-bold text-slate-400 uppercase tracking-widest select-none">
                        OR
                      </span>
                      <div className="flex-1 h-px bg-slate-200/80" />
                    </div>

                    <div className="grid grid-cols-3 gap-1 w-full">
                      <button
                        id="btn-option-file"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onMouseEnter={() => setHoveredIcon('file')}
                        onMouseLeave={() => setHoveredIcon(null)}
                        className="group flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg bg-transparent active:scale-95 transition-all cursor-pointer select-none"
                        title="Upload file"
                      >
                        <div
                          className="w-8 h-8 flex items-center justify-center transition-colors duration-200"
                          style={{ color: hoveredIcon === 'file' ? accent : '#94a3b8' }}
                        >
                          <svg
                            className="w-6 h-6"
                            viewBox="0 0 28 28"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M16 3H7a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h7" />
                            <path d="M16 3l6 6v5" />
                            <path d="M16 3v6h6" />
                            <circle cx="20" cy="20" r="4.5" fill="white" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="20" y1="18" x2="20" y2="22" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="18" y1="20" x2="22" y2="20" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        </div>
                        <span
                          className="text-[11px] font-medium transition-colors duration-200 mt-0.5"
                          style={{ color: hoveredIcon === 'file' ? accent : '#64748b' }}
                        >
                          File
                        </span>
                      </button>

                      <button
                        id="btn-option-folders"
                        type="button"
                        onClick={handleOpenFolderPicker}
                        onMouseEnter={() => setHoveredIcon('folders')}
                        onMouseLeave={() => setHoveredIcon(null)}
                        className="group flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg bg-transparent active:scale-95 transition-all cursor-pointer select-none"
                        title="Upload folders"
                      >
                        <div
                          className="w-8 h-8 flex items-center justify-center transition-colors duration-200"
                          style={{ color: hoveredIcon === 'folders' ? accent : '#94a3b8' }}
                        >
                          <svg
                            className="w-6 h-6"
                            viewBox="0 0 28 28"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 8a3 3 0 0 1 3-3h5.5a2.5 2.5 0 0 1 1.8.8l1.4 1.4a2 2 0 0 0 1.4.6h7.3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8z" />
                            <line x1="14" y1="12" x2="14" y2="18" stroke="currentColor" strokeWidth="1.5" />
                            <line x1="11" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        </div>
                        <span
                          className="text-[11px] font-medium transition-colors duration-200 mt-0.5"
                          style={{ color: hoveredIcon === 'folders' ? accent : '#64748b' }}
                        >
                          Folders
                        </span>
                      </button>

                      <button
                        id="btn-option-secret"
                        type="button"
                        onClick={() => {
                          setActiveInputType('text');
                          setBufferText('// Paste secret note, credentials, or keys here\n');
                        }}
                        onMouseEnter={() => setHoveredIcon('secret')}
                        onMouseLeave={() => setHoveredIcon(null)}
                        className="group flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg bg-transparent active:scale-95 transition-all cursor-pointer select-none"
                        title="Secret note"
                      >
                        <div
                          className="w-8 h-8 flex items-center justify-center transition-colors duration-200"
                          style={{ color: hoveredIcon === 'secret' ? accent : '#94a3b8' }}
                        >
                          <svg
                            className="w-6 h-6"
                            viewBox="0 0 28 28"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="5" y="4" width="18" height="20" rx="3" />
                            <path d="M9 9h10" />
                            <path d="M9 13h10" />
                            <path d="M9 17h6" />
                          </svg>
                        </div>
                        <span
                          className="text-[11px] font-medium transition-colors duration-200 mt-0.5"
                          style={{ color: hoveredIcon === 'secret' ? accent : '#64748b' }}
                        >
                          Secret
                        </span>
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {hasContentReady && !generatedLink && (
                <div className="relative w-full max-w-3xl lg:max-w-4xl bg-white rounded-2xl p-5 sm:p-6 lg:p-7 shadow-xl border border-slate-200/80 transition-all">
                  <div className="absolute -top-1.5 left-[calc(50%-58px)] -translate-x-1/2 w-3.5 h-3.5 bg-white rotate-45 border-l border-t border-slate-200 z-20" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 items-start">
                    <div className="flex flex-col gap-4">
                      {activeInputType === 'file' ? (
                        selectedFiles.length === 1 ? (
                          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {selectedFiles[0].mimeType?.startsWith('image/') ||
                              selectedFiles[0].content?.startsWith('data:image/') ? (
                                <img
                                  src={selectedFiles[0].content}
                                  alt={selectedFiles[0].name}
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-white shadow-2xs"
                                />
                              ) : (
                                <div
                                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                                  style={{ backgroundColor: accent }}
                                >
                                  <span className="material-symbols-outlined text-[24px]">
                                    {selectedFiles[0].type?.includes('PDF')
                                      ? 'picture_as_pdf'
                                      : selectedFiles[0].type?.includes('Video')
                                      ? 'movie'
                                      : selectedFiles[0].type?.includes('Audio')
                                      ? 'audiotrack'
                                      : 'description'}
                                  </span>
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-semibold text-slate-900 truncate">
                                  {selectedFiles[0].name}
                                </h4>
                                <p className="text-xs text-slate-500 font-sans mt-0.5">
                                  {formatBytes(selectedFiles[0].sizeBytes)} • {selectedFiles[0].type || 'file'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[13px]">add</span>
                                <span>Add more</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleResetSend}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Remove file"
                              >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[18px]"
                                  style={{ backgroundColor: accent }}
                                >
                                  <span className="material-symbols-outlined text-[18px]">folder_zip</span>
                                </div>
                                <div>
                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                                    {selectedFiles.length} files selected
                                  </h4>
                                  <span className="text-[11px] text-slate-500 font-sans">
                                    Total: {formatBytes(payloadBytes)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[13px]">add</span>
                                  <span>Add more</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleResetSend}
                                  className="text-xs font-medium text-slate-400 hover:text-red-600 cursor-pointer px-2 py-1"
                                >
                                  Clear all
                                </button>
                              </div>
                            </div>

                            <div
                              className="max-h-44 overflow-y-auto space-y-1.5 pr-1"
                              style={{ scrollbarWidth: 'thin' }}
                            >
                              {selectedFiles.map((f) => (
                                <div
                                  key={f.id}
                                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="material-symbols-outlined text-[18px] text-slate-500 shrink-0">
                                      {f.type?.includes('Image')
                                        ? 'image'
                                        : f.type?.includes('PDF')
                                        ? 'picture_as_pdf'
                                        : 'draft'}
                                    </span>
                                    <span className="truncate font-medium text-slate-800">{f.name}</span>
                                    <span className="text-[11px] text-slate-400 font-sans shrink-0">
                                      {formatBytes(f.sizeBytes)}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => handleRemoveFile(f.id, e)}
                                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-200/50 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">close</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between pb-1">
                            <span className="text-xs font-semibold text-slate-700">Secret Note or Code</span>
                            <button
                              type="button"
                              onClick={handleResetSend}
                              className="text-xs text-slate-400 hover:text-red-500 cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                          <textarea
                            value={bufferText}
                            onChange={(e) => setBufferText(e.target.value)}
                            rows={5}
                            placeholder="Enter secret text, passwords, or code snippets..."
                            className="w-full p-3 rounded-xl border border-slate-200 font-sans text-xs text-slate-900 focus:outline-none focus:ring-2 resize-none bg-slate-50/50"
                          />
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor={descriptorInputId}
                          className="block text-xs font-semibold text-slate-700 mb-1 font-sans"
                        >
                          Add a message for recipient (optional)
                        </label>
                        <div className="relative">
                          <input
                            id={descriptorInputId}
                            type="text"
                            value={payloadDescriptor}
                            onChange={(e) => setPayloadDescriptor(e.target.value)}
                            placeholder="e.g. Please review by Friday, password in Slack..."
                            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:text-slate-400 bg-slate-50/40 font-sans"
                          />
                          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[17px] pointer-events-none">
                            chat
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 pt-0.5 relative z-10">
                        <label className="block text-xs font-semibold text-slate-700 font-sans">
                          Choose how to send
                        </label>
                        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
                          <button
                            type="button"
                            id="btn-method-link"
                            onClick={() => setTransferMethod('link')}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer font-sans ${
                              transferMethod === 'link'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[17px]">link</span>
                            <span>Share with Link</span>
                          </button>
                          <button
                            type="button"
                            id="btn-method-nearby"
                            onClick={() => setTransferMethod('nearby')}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer font-sans ${
                              transferMethod === 'nearby'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[17px]">radar</span>
                            <span>Nearby Share</span>
                          </button>
                        </div>
                      </div>

                      {transferMethod === 'nearby' && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-[19px] text-slate-500 shrink-0 mt-0.5">
                            wifi_tethering
                          </span>
                          <div className="leading-relaxed font-sans">
                            <span className="font-semibold text-slate-800 block">
                              Fast Local Sharing
                            </span>
                            Tap any detected receiver on the radar to send directly over your local network.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-4 border-t md:border-t-0 md:border-l border-slate-200/80 pt-4 md:pt-0 md:pl-6 lg:pl-7">
                      {transferMethod === 'link' ? (
                        <div className="flex flex-col gap-4 justify-between h-full">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5 font-sans">
                              Transfer Expiration & Privacy
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {(
                                [
                                  { id: '1h', label: '1 Hour' },
                                  { id: '1d', label: '1 Day' },
                                  { id: '7d', label: '7 Days' },
                                  { id: 'never', label: 'Single Access' },
                                ] as const
                              ).map((pill) => {
                                const isSelected = expirationPolicy === pill.id;
                                return (
                                  <button
                                    key={pill.id}
                                    type="button"
                                    onClick={() => setExpirationPolicy(pill.id)}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center font-sans ${
                                      isSelected
                                        ? 'text-white shadow-xs'
                                        : 'text-slate-600 bg-slate-100 hover:bg-slate-200/70 border border-slate-200/60'
                                    }`}
                                    style={{
                                      backgroundColor: isSelected ? accent : undefined,
                                    }}
                                  >
                                    {pill.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
                            <span className="material-symbols-outlined text-[18px] text-slate-500 shrink-0 mt-0.5">
                              lock
                            </span>
                            <div className="leading-relaxed font-sans">
                              <span className="font-semibold text-slate-800 block">End-to-End Encrypted</span>
                              Links expire automatically. Payloads are purged after expiration or single access.
                            </div>
                          </div>

                          <div className="pt-2">
                            <button
                              id="btn-submit-transfer"
                              type="button"
                              disabled={isGenerating}
                              onClick={handleCreateShareLink}
                              className="w-full py-3.5 rounded-xl text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer font-sans"
                              style={{ backgroundColor: accent }}
                            >
                              <span className="material-symbols-outlined text-[20px]">link</span>
                              <span>{isGenerating ? 'Encrypting & Generating Link...' : 'Create Share Link'}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center w-full">
                          <NearbyRadarView
                            localDevice={localDevice}
                            nearbyDevices={nearbyDevices.filter(d => d.isReceiving)}
                            onSelectDevice={handleSendToNearbyDevice}
                            sendingToDeviceId={sendingToDeviceId}
                            transferSuccessDeviceId={transferSuccessDeviceId}
                            successViewData={transferStatusMessage}
                            isSendMode={true}
                            selectedFileSummary={null}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {generatedLink && latestCreatedDrop && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative w-full max-w-2xl lg:max-w-3xl bg-white rounded-2xl p-6 sm:p-7 shadow-xl border border-slate-200/80 flex flex-col items-center gap-5 text-center"
                >
                  <div className="absolute -top-1.5 left-[calc(50%-58px)] -translate-x-1/2 w-3.5 h-3.5 bg-white rotate-45 border-l border-t border-slate-200 z-20" />
                  <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[32px]">check</span>
                  </div>

                  <div>
                    <h3 className="text-2xl sm:text-3xl font-hand font-bold text-slate-900 mb-1">
                      Your files are ready to share!
                    </h3>
                    <p className="text-xs text-slate-500">
                      {latestCreatedDrop.name} • {formatBytes(latestCreatedDrop.sizeBytes)} • Expires in {latestCreatedDrop.expiresInText}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium">Transfer Code:</span>
                    <span className="text-sm font-sans font-bold text-slate-900 tracking-wider">
                      {latestCreatedDrop.id.replace('EPHEM-', '')}
                    </span>
                  </div>

                  <div className="w-full flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-sans select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      id="btn-copy-transfer-link"
                      onClick={handleCopyLink}
                      className="px-5 py-2.5 rounded-xl text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer shrink-0"
                      style={{ backgroundColor: accent }}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {copiedLink ? 'done' : 'content_copy'}
                      </span>
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100 w-full text-left">
                    <div className="w-16 h-16 bg-white p-1 rounded-lg border border-slate-200 shrink-0">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=${accent.replace('#', '')}&data=${encodeURIComponent(generatedLink)}`}
                        alt="Scan with phone"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-900 block">Mobile Scan</span>
                      Recipient can scan this QR code with their phone camera to download directly.
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full pt-2">
                    <button
                      type="button"
                      onClick={() => onViewDrop(latestCreatedDrop)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSend}
                      className="flex-1 py-2.5 rounded-xl text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                      style={{ backgroundColor: accentHover }}
                    >
                      Send another file
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {consoleMode === 'receive' && (
            <div className="w-full flex flex-col items-center">
              {receiveMethod === 'nearby' ? (
                <div className="relative w-full max-w-2xl lg:max-w-3xl bg-white rounded-2xl p-6 sm:p-7 shadow-xl border border-slate-200/80 flex flex-col items-center">
                  <div className="absolute -top-1.5 left-[calc(50%+58px)] -translate-x-1/2 w-3.5 h-3.5 bg-white rotate-45 border-l border-t border-slate-200 z-20" />
                  <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px]" style={{ color: accent }}>
                        radar
                      </span>
                      <span className="text-sm font-bold text-slate-800">Nearby Scanner</span>
                    </div>
                    <button
                      type="button"
                      id="btn-receive-back-code"
                      onClick={() => setReceiveMethod('code')}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                      <span>Enter code or link</span>
                    </button>
                  </div>
                  <NearbyRadarView
                    localDevice={localDevice}
                    nearbyDevices={nearbyDevices}
                    isSendMode={false}
                  />
                </div>
              ) : (
                <div className="relative w-full max-w-[310px] sm:max-w-[325px] pt-1">
                  <motion.div
                    layout
                    animate={!isPasteActive && !retrievedDrop ? { y: [-16, 16, -16] } : { y: 0 }}
                    transition={
                      !isPasteActive && !retrievedDrop
                        ? {
                            y: {
                              duration: 1.8,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            },
                            layout: { type: 'spring', damping: 28, stiffness: 350 },
                          }
                        : { type: 'spring', damping: 28, stiffness: 350 }
                    }
                    id="receive-select-container"
                    className="relative w-full bg-white rounded-xl sm:rounded-2xl px-3.5 pt-3.5 pb-4 sm:px-4 sm:pt-3.5 sm:pb-4 shadow-xl border border-slate-100 flex flex-col items-center text-center transition-all duration-300"
                    style={{
                      boxShadow: '0 14px 30px -10px rgba(0, 0, 0, 0.07), 0 0 0 1px rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <div className="absolute -top-1.5 left-[calc(50%+58px)] -translate-x-1/2 w-3.5 h-3.5 bg-white rotate-45 border-l border-t border-slate-200 z-20" />

                    <div className="w-full pt-0.5 pb-0 flex flex-col items-center select-none">
                      <h2 className="text-[15.5px] sm:text-[16.5px] font-normal text-slate-800 tracking-tight leading-snug font-sans">
                        Enter transfer code
                        <br />
                        or paste link here
                      </h2>
                    </div>
                    <div className="w-full flex items-center gap-2.5 my-2.5">
                      <div className="flex-1 h-px bg-slate-200/80" />
                      <span className="text-[10px] sm:text-[10.5px] font-bold text-slate-400 uppercase tracking-widest select-none">
                        OR
                      </span>
                      <div className="flex-1 h-px bg-slate-200/80" />
                    </div>

                    <div className="w-full relative min-h-[52px] flex items-center justify-center">
                      <AnimatePresence mode="wait" initial={false}>
                        {!isPasteActive ? (
                          <motion.div
                            key="options-default"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center justify-center gap-12 w-full"
                          >
                            <button
                              id="btn-receive-live"
                              type="button"
                              onClick={() => {
                                setReceiveMethod('nearby');
                                onShowToast('Listening for nearby active transfers on live radar...');
                              }}
                              onMouseEnter={() => setHoveredIcon('receive-live')}
                              onMouseLeave={() => setHoveredIcon(null)}
                              className="group flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg bg-transparent active:scale-95 transition-all cursor-pointer select-none"
                              title="Live network scanner"
                            >
                              <div
                                className="w-8 h-8 flex items-center justify-center transition-colors duration-200"
                                style={{ color: hoveredIcon === 'receive-live' ? accent : '#94a3b8' }}
                              >
                                <svg
                                  className="w-6 h-6"
                                  viewBox="0 0 28 28"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="14" cy="14" r="2.5" fill="currentColor" />
                                  <path d="M9.5 9.5a6.5 6.5 0 0 0 0 9" />
                                  <path d="M18.5 9.5a6.5 6.5 0 0 1 0 9" />
                                  <path d="M6 6a11.5 11.5 0 0 0 0 16" />
                                  <path d="M22 6a11.5 11.5 0 0 1 0 16" />
                                </svg>
                              </div>
                              <span
                                className="text-[11px] font-medium transition-colors duration-200 mt-0.5"
                                style={{ color: hoveredIcon === 'receive-live' ? accent : '#64748b' }}
                              >
                                Live
                              </span>
                            </button>

                            <button
                              id="btn-receive-paste"
                              type="button"
                              onClick={async () => {
                                setIsPasteActive(true);
                                setReceiveError(null);
                                if (navigator.clipboard && navigator.clipboard.readText) {
                                  try {
                                    const text = await navigator.clipboard.readText();
                                    if (text && text.trim()) {
                                      setReceiveInput(text.trim());
                                      onShowToast('Pasted from clipboard');
                                    }
                                  } catch {}
                                }
                              }}
                              onMouseEnter={() => setHoveredIcon('receive-paste')}
                              onMouseLeave={() => setHoveredIcon(null)}
                              className="group flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg bg-transparent active:scale-95 transition-all cursor-pointer select-none"
                              title="Paste transfer code or link"
                            >
                              <div
                                className="w-8 h-8 flex items-center justify-center transition-colors duration-200"
                                style={{ color: hoveredIcon === 'receive-paste' ? accent : '#94a3b8' }}
                              >
                                <svg
                                  className="w-6 h-6"
                                  viewBox="0 0 28 28"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect x="5.5" y="7" width="17" height="17" rx="3" />
                                  <path d="M10.5 7V4.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V7" />
                                  <line x1="9.5" y1="12" x2="18.5" y2="12" />
                                  <line x1="9.5" y1="16" x2="15.5" y2="16" />
                                </svg>
                              </div>
                              <span
                                className="text-[11px] font-medium transition-colors duration-200 mt-0.5"
                                style={{ color: hoveredIcon === 'receive-paste' ? accent : '#64748b' }}
                              >
                                Paste
                              </span>
                            </button>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="options-paste-active"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="w-full flex items-center gap-1.5"
                          >
                            <div
                              className="w-7 h-7 shrink-0 flex items-center justify-center transition-colors select-none"
                              style={{ color: accent }}
                              title="Paste link or code"
                            >
                              <svg
                                className="w-5 h-5"
                                viewBox="0 0 28 28"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="5.5" y="7" width="17" height="17" rx="3" />
                                <path d="M10.5 7V4.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V7" />
                                <line x1="9.5" y1="12" x2="18.5" y2="12" />
                                <line x1="9.5" y1="16" x2="15.5" y2="16" />
                              </svg>
                            </div>
                            <motion.form
                              initial={{ opacity: 0, x: -6, scale: 0.98 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              transition={{ duration: 0.2 }}
                              onSubmit={handleRetrieveDrop}
                              className="flex-1 flex items-center gap-1.5 min-w-0"
                            >
                              <div className="relative flex-1 min-w-0">
                                <input
                                  ref={receiveInputRef}
                                  type="text"
                                  value={receiveInput}
                                  onChange={(e) => setReceiveInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      setIsPasteActive(false);
                                      setReceiveInput('');
                                    }
                                  }}
                                  placeholder="Code or link"
                                  className={`w-full h-8 pl-2.5 ${receiveInput ? 'pr-2.5' : 'pr-11'} py-0 rounded-lg border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-1.5 focus:border-transparent transition-all placeholder:text-slate-400 bg-slate-50/70 font-sans`}
                                  autoFocus
                                />
                                {!receiveInput && (
                                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (navigator.clipboard && navigator.clipboard.readText) {
                                          try {
                                            const text = await navigator.clipboard.readText();
                                            if (text) {
                                              setReceiveInput(text.trim());
                                              onShowToast('Pasted from clipboard');
                                            }
                                          } catch {}
                                        }
                                      }}
                                      className="text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-medium transition-colors cursor-pointer"
                                      title="Paste from clipboard"
                                    >
                                      Paste
                                    </button>
                                  </div>
                                )}
                              </div>
                              <button
                                type="submit"
                                disabled={isSearchingReceive || !receiveInput.trim()}
                                className="h-8 px-2.5 rounded-lg text-white font-medium text-xs flex items-center justify-center gap-1 shadow-xs shrink-0 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                                style={{ backgroundColor: accent }}
                              >
                                <span className="material-symbols-outlined text-[14px]">download</span>
                                <span>{isSearchingReceive ? '...' : 'Get'}</span>
                              </button>
                            </motion.form>

                            <button
                              id="btn-close-paste"
                              type="button"
                              onClick={() => {
                                setIsPasteActive(false);
                                setReceiveInput('');
                                setReceiveError(null);
                                setRetrievedDrop(null);
                              }}
                              className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Cancel and return"
                            >
                              <span className="material-symbols-outlined text-[15px]">close</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {receiveError && (
                      <div className="w-full mt-2.5 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 text-left">
                        <span className="material-symbols-outlined text-[15px] shrink-0 text-red-600">
                          error
                        </span>
                        <span className="truncate">{receiveError}</span>
                      </div>
                    )}

                    {retrievedDrop && (
                      <div className="w-full mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5 text-left animate-in fade-in">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {retrievedDrop.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 truncate">
                              {formatBytes(retrievedDrop.sizeBytes)} • {retrievedDrop.type}
                            </p>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                            style={{ backgroundColor: accent }}
                          >
                            Verified
                          </span>
                        </div>

                        {retrievedDrop.files && retrievedDrop.files.length > 1 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-slate-600">
                              Contains {retrievedDrop.files.length} files:
                            </span>
                            <div className="max-h-24 overflow-y-auto space-y-1">
                              {retrievedDrop.files.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-white border border-slate-200"
                                >
                                  <span className="truncate max-w-[200px] text-slate-800">{file.name}</span>
                                  <span className="text-slate-400 font-sans text-[9px]">{formatBytes(file.sizeBytes)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadRetrieved(retrievedDrop)}
                            disabled={isZipping}
                            className="flex-1 py-2 rounded-xl text-white font-semibold text-xs flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                            style={{ backgroundColor: accent }}
                          >
                            <span className="material-symbols-outlined text-[15px]">download</span>
                            <span>{isZipping ? 'Bundling...' : 'Download'}</span>
                          </button>
                          <a
                            href={getDirectRawUrl(retrievedDrop.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs text-center cursor-pointer"
                          >
                            Preview
                          </a>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <GlobalTelemetry
        stats={stats || {
          downloadedFiles: 0,
          sentTransfers: 0,
          gigabytesSent: 0,
          bytesSent: 0,
          rating: 5.0,
          ratingsCount: 0,
        }}
        onPromptRate={onPromptRate}
      />

      {pendingFolderConfirmation && (
        <FolderConfirmationModal
          isOpen={!!pendingFolderConfirmation}
          folderName={pendingFolderConfirmation.folderName}
          files={pendingFolderConfirmation.files}
          totalBytes={pendingFolderConfirmation.totalBytes}
          onConfirm={() => {
            setActiveInputType('file');
            processFiles(pendingFolderConfirmation.files);
            const count = pendingFolderConfirmation.files.length;
            const name = pendingFolderConfirmation.folderName;
            setPendingFolderConfirmation(null);
            onShowToast(`Uploaded ${count} file${count !== 1 ? 's' : ''} from "${name}"`);
          }}
          onCancel={() => {
            setPendingFolderConfirmation(null);
          }}
        />
      )}
    </div>
  );
};