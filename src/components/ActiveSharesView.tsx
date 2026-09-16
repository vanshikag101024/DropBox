import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DropPayload, DropFileItem } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
    downloadPayloadFile,
    downloadFilesAsZip,
    formatBytes,
    getShareableVaultUrl,
} from '../utils/crypto';

interface ActiveSharesViewProps {
    drops: DropPayload[];
    selectedDropId?: string | null;
    onSelectDrop?: (drop: DropPayload) => void;
    onBurnDrop: (dropId: string) => void;
    onShowToast: (msg: string) => void;
    onNavigateTransfer: () => void;
    onConsumeTransfer?: (dropId: string) => void;
}

export const ActiveSharesView: React.FC<ActiveSharesViewProps> = ({
    drops,
    selectedDropId,
    onSelectDrop,
    onBurnDrop,
    onShowToast,
    onNavigateTransfer,
    onConsumeTransfer,
}) => {
    const { accent, accentBorder, accentTint } = useTheme();

    const [expandedDropId, setExpandedDropId] = useState<string | null>(null);

    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const [copiedDropId, setCopiedDropId] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<DropFileItem | null>(null);
    const [zippingDropId, setZippingDropId] = useState<string | null>(null);

    useEffect(() => {
        if (expandedDropId && !drops.some((d) => d.id === expandedDropId)) {
            setExpandedDropId(null);
        }
    }, [drops, expandedDropId]);

    const toggleDrop = (drop: DropPayload) => {
        if (expandedDropId === drop.id) {
            setExpandedDropId(null);
        } else {
            setExpandedDropId(drop.id);
            onSelectDrop?.(drop);
        }
    };

    const formatLiveRemaining = (drop: DropPayload) => {
        if (drop.expirationPolicy === 'never') {
            const remainingDownloads = Math.max(0, (drop.transfersMax || 1) - (drop.transfersConsumed || 0));
            return `${remainingDownloads} download${remainingDownloads === 1 ? '' : 's'} left`;
        }

        if (!drop.expiresAt) {
            return `Expires in ${drop.expiresInText || '24h'}`;
        }

        const diffMs = drop.expiresAt - now;
        if (diffMs <= 0) {
            return 'Expired';
        }

        const totalSecs = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSecs / 86400);
        const hours = Math.floor((totalSecs % 86400) / 3600);
        const minutes = Math.floor((totalSecs % 3600) / 60);
        const seconds = totalSecs % 60;

        if (days > 0) {
            return `Expires in ${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
        if (hours > 0) {
            return `Expires in ${hours}h ${minutes}m ${seconds}s`;
        }
        if (minutes > 0) {
            return `Expires in ${minutes}m ${seconds}s`;
        }
        return `Expires in ${seconds}s`;
    };

    const getFileCategory = (f: DropFileItem) => {
        const name = f.name.toLowerCase();
        const mime = (f.mimeType || '').toLowerCase();
        const type = (f.type || '').toLowerCase();

        if (
            mime.startsWith('image/') ||
            type.includes('image') ||
            f.content.startsWith('data:image/') ||
            /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(name)
        ) {
            return 'image';
        }
        if (mime.includes('pdf') || type.includes('pdf') || /\.pdf$/i.test(name)) {
            return 'pdf';
        }
        if (mime.startsWith('audio/') || type.includes('audio') || /\.(mp3|wav|ogg|m4a)$/i.test(name)) {
            return 'audio';
        }
        if (mime.startsWith('video/') || type.includes('video') || /\.(mp4|webm|mov)$/i.test(name)) {
            return 'video';
        }
        if (
            mime.startsWith('text/') ||
            /\.(txt|sh|bash|json|js|ts|tsx|jsx|py|env|md|yml|yaml|html|css|sql|rs|go|c|cpp|h)$/i.test(name)
        ) {
            return 'text';
        }
        return 'archive';
    };

    const getFileIcon = (category: string) => {
        switch (category) {
            case 'image':
                return 'image';
            case 'pdf':
                return 'picture_as_pdf';
            case 'audio':
                return 'graphic_eq';
            case 'video':
                return 'movie';
            case 'text':
                return 'code';
            default:
                return 'draft';
        }
    };

    const handleCopyLink = (drop: DropPayload, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const url = getShareableVaultUrl(drop.id, drop.key);
        navigator.clipboard.writeText(url);
        setCopiedDropId(drop.id);
        onShowToast(`Link copied to clipboard`);
        setTimeout(() => setCopiedDropId(null), 2000);
    };

    const handleToggleQr = (dropId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setExpandedDropId((prev) => (prev === dropId ? null : dropId));
    };

    const handleDownloadSingle = (dropId: string, file: DropFileItem) => {
        downloadPayloadFile(file.name, file.content, file.mimeType);
        onConsumeTransfer?.(dropId);
        onShowToast(`Downloaded ${file.name}`);
    };

    const handleDownloadAll = async (drop: DropPayload, files: DropFileItem[]) => {
        if (files.length > 1) {
            setZippingDropId(drop.id);
            try {
                const zipName = `${drop.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'transfer'}.zip`;
                await downloadFilesAsZip(zipName, files);
                onConsumeTransfer?.(drop.id);
                onShowToast(`Downloaded all files as ZIP`);
            } catch (err) {
                console.error('Failed to create ZIP:', err);
                onShowToast('Error downloading files');
            } finally {
                setZippingDropId(null);
            }
        } else if (files.length === 1) {
            handleDownloadSingle(drop.id, files[0]);
        }
    };

    if (drops.length === 0) {
        return (
            <div className="w-full max-w-lg mx-auto px-4 py-20 text-center relative z-10">
                <div
                    className="bg-white rounded-3xl p-10 border shadow-sm space-y-4"
                    style={{ borderColor: accentBorder }}
                >
                    <div
                        className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border"
                        style={{ backgroundColor: accentTint, color: accent, borderColor: accentBorder }}
                    >
                        <span className="material-symbols-outlined text-[28px]">folder-off</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold font-hand text-stone-900">No Active Shares</h2>
                    <p className="text-[13.5px] text-stone-500 max-w-sm mx-auto leading-relaxed">
                        You don't have any active transfers right now.
                    </p>
                    <div className="pt-2">
                        <button
                            onClick={onNavigateTransfer}
                            className="px-5 py-2.5 rounded-full text-white text-[13px] font-sans font-semibold cursor-pointer inline-flex items-center gap-2 shadow-xs active:scale-98 transition-transform"
                            style={{ backgroundColor: accent }}
                        >
                            <span className="material-symbols-outlined text-[17px]">add</span>
                            <span>Create Transfer</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

  return (
    <>
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-3 relative z-10">
        <div className="flex items-center justify-between gap-4 pb-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl sm:text-4xl font-bold font-hand tracking-normal text-slate-900">
              Active Shares
            </h1>            <span              className="px-2.5 py-0.5 rounded-lg text-[12px] font-medium font-sans border"
              style={{
                backgroundColor: accentTint,
                color: accent,
                borderColor: accentBorder,
              }}
            >
            {drops.length} {drops.length === 1 ? 'file' : 'files'}
            </span>          </div>
          <button            id="btn-new-share"
            onClick={onNavigateTransfer}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-sans font-medium border transition-all cursor-pointer hover:shadow-xs active:scale-98"
            style={{
              backgroundColor: accentTint,
              color: accent,
              borderColor: accentBorder,
            }}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>            <span>New Transfer</span>          </button>        </div>

        <div className="space-y-2.5">
          {drops.map((drop) => {
            const isExpanded = expandedDropId === drop.id;
            const files: DropFileItem[] =
              drop.files && drop.files.length > 0
                ? drop.files                : [
                    {
                      id: drop.id,
                      name: drop.name,
                      sizeBytes: drop.sizeBytes || 1024,
                      type: drop.type,
                      mimeType: drop.mimeType,
                      content: drop.content,
                    },
                ];

            const isMultiFile = files.length > 1;
            const totalSizeBytes = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
            const singleFile = files[0];
            const singleCategory = singleFile ? getFileCategory(singleFile) : 'archive';
            const singleRawSrc = singleFile?.content.startsWith('data:')
              ? singleFile.content
              : `/api/drops/${drop.id}/raw`;

            const shareUrl = getShareableVaultUrl(drop.id, drop.key);
            const isCopied = copiedDropId === drop.id;
            const isZipping = zippingDropId === drop.id;

            return (
              <div                key={drop.id}
                id={`share-row-${drop.id}`}
                className={`transition-all overflow-hidden rounded-xs backdrop-blur-2xl bg-white/70 ring-1 ring-stone-200/80 shadow-sm shadow-stone-900/[0.03] hover:shadow-md hover:ring-stone-300 ${
                  isExpanded ? 'shadow-md ring-stone-300' : ''
                }`}
              >
                <div                  onClick={() => toggleDrop(drop)}
                  className="p-3 sm:p-3.5 flex items-center justify-between gap-3 sm:gap-4 cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xs overflow-hidden shrink-0 flex items-center justify-center bg-white/60 backdrop-blur-sm ring-1 ring-stone-200/80 shadow-2xs">
                      {singleCategory === 'image' && singleRawSrc ? (
                        <img                          src={singleRawSrc}
                          alt={drop.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div                          className="w-full h-full flex items-center justify-center"
                          style={{ backgroundColor: accentTint, color: accent }}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {isMultiFile ? 'folder' : getFileIcon(singleCategory)}
                          </span>                        </div>                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        className="text-[14px] sm:text-[14.5px] font-semibold text-stone-900 font-sans tracking-tight truncate select-text"
                        title={drop.name}
                      >
                        {drop.name}
                      </h2>

                      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-stone-500 font-sans mt-0.5">
                        <span className="font-sans text-stone-600">
                          {formatBytes(totalSizeBytes)}
                        </span>                        <span>•</span>                        <span className="tabular-nums font-medium text-stone-600">
                          {formatLiveRemaining(drop)}
                        </span>                      </div>                    </div>                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleCopyLink(drop, e)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white/60 transition-colors cursor-pointer"
                      title="Copy link"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        {isCopied ? 'done' : 'link'}
                    </span>                    </button>
                    <button                      onClick={(e) => handleToggleQr(drop.id, e)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        isExpanded
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                      }`}
                      title={isExpanded ? 'Collapse' : 'Show details & QR'}
                    >
                      <span className="material-symbols-outlined text-[17px]">qr-code-2</span>                    </button>

                    <button                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${drop.name}"?`)) {
                        onBurnDrop(drop.id);
                        }
                    }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50/80 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                    <div                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-stone-700' : ''
                    }`}
                    >
                      <span className="material-symbols-outlined text-[19px]">expand-more</span>                    </div>
                  </div>                </div>

                <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                      key={`expanded-${drop.id}`}
                    initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden border-t border-white/40"
                    >
                      <div className="p-3 sm:p-4 bg-transparent">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
                          <div className="w-full h-full bg-white/25 backdrop-blur-md rounded-xl p-3.5 sm:p-4 flex flex-col shadow-xs ring-1 ring-white/50">
                            <div className="flex items-center justify-between w-full mb-2.5 pb-2 border-b border-white/30">
                              <div className="flex items-center gap-1.5 text-stone-900 text-[13px] font-sans font-semibold min-w-0">
                                <span className="material-symbols-outlined text-[17px] shrink-0"
                                  style={{ color: accent }}
                                >
                                  {isMultiFile ? 'folder_zip' : getFileIcon(singleCategory)}
                                </span>                                <span className="truncate">
                                  {isMultiFile ? 'Package Contents' : 'File Preview'}
                                </span>                              </div>
                              <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-md ring-1 ring-white/60 shrink-0 bg-white/30 shadow-2xs"
                                style={{
                                  color: accent,
                                }}
                              >
                                {isMultiFile
                                  ? `${files.length} Files • ${formatBytes(totalSizeBytes)}`
                                  : `${singleFile?.name.split('.').pop()?.toUpperCase() || 'FILE'} • ${formatBytes(singleFile?.sizeBytes || 0)}`}
                              </span>                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center w-full">
                              {isMultiFile ? (
                                <div className="w-full h-44 sm:h-48 overflow-y-auto space-y-1.5 p-1 mb-2.5"
                                  style={{ scrollbarWidth: 'thin' }}
                                >
                                  {files.map((file, idx) => {
                                    const cat = getFileCategory(file);
                                    const isImg = cat === 'image';
                                    return (
                                      <div                                        key={file.id || idx}
                                        className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-white/25 backdrop-blur-sm ring-1 ring-white/50 shadow-2xs"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                          {isImg ? (
                                            <div                                              onClick={() => setPreviewFile(file)}
                                              className="w-7.5 h-7.5 rounded-lg overflow-hidden ring-1 ring-black/5 shrink-0 bg-stone-100 cursor-pointer"
                                            >
                                              <img src={file.content}
                                                alt={file.name}
                                                className="w-full h-full object-cover"
                                              />
                                            </div> ) : (
                                            <div className="w-7.5 h-7.5 rounded-lg shrink-0 flex items-center justify-center shadow-2xs"
                                              style={{
                                                backgroundColor: accentTint,
                                                color: accent,
                                              }}
                                            >
                                              <span className="material-symbols-outlined text-[15px]">
                                                {getFileIcon(cat)}
                                              </span>      </div> )}
                                          <div className="min-w-0 flex-1">
                                            <p className="text-[12px] font-sans font-medium text-stone-900 truncate">
                                              {file.name}
                                            </p>                                            <p className="text-[10px] text-stone-400 font-sans">
                                              {formatBytes(file.sizeBytes || 0)}
                                            </p>                                          </div>                                        </div>                                        <div className="flex items-center gap-1 shrink-0">
                                          {isImg && (
                                            <button                                              onClick={() => setPreviewFile(file)}
                                            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
                                              title="Preview image"
                                            >
                                              <span className="material-symbols-outlined text-[15px]">
                                                visibility
                                              </span>                                            </button>
                                          )}
                                          <button                                            onClick={() => handleDownloadSingle(drop.id, file)}
                                            className="p-1 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
                                            style={{ color: accent }}
                                            title={`Download ${file.name}`}
                                        >
                                            <span className="material-symbols-outlined text-[15px]">
                                              download
                                            </span>
                                          </button>                                        </div>                                      </div>                                    );
                                  })}
                                </div>   ) : singleCategory === 'image' ? (
                                <div className="w-full h-44 sm:h-48 rounded-lg bg-white/20 backdrop-blur-sm ring-1 ring-white/40 shadow-xs p-1 flex items-center justify-center relative group overflow-hidden mb-2.5">
                                  <img                                    src={singleRawSrc}
                                    alt={singleFile?.name}
                                    onClick={() => setPreviewFile(singleFile)}
                                    className="w-full h-full object-cover rounded-md cursor-pointer hover:scale-[1.01] transition-transform"
                                  />
                                  <button                                    onClick={() => setPreviewFile(singleFile)}
                                    className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-white/80 hover:bg-white ring-1 ring-white/80 shadow-xs text-[10.5px] font-sans font-medium inline-flex items-center gap-1 transition-all cursor-pointer text-stone-700"
                                  >
                                    <span>Full size</span>                                    <span className="material-symbols-outlined text-[12px]">
                                    zoom_in
                                    </span>      </button>    </div>      ) : singleCategory === 'pdf' ? (
                                <div className="w-full h-44 sm:h-48 rounded-lg bg-white/20 backdrop-blur-sm ring-1 ring-white/40 shadow-xs p-3 flex flex-col items-center justify-center gap-2.5 mb-2.5 text-center">
                                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                                    style={{
                                      backgroundColor: accentTint,
                                      color: accent,
                                    }}
                                  >
                                    <span className="material-symbols-outlined text-[22px]">
                                      picture_as_pdf
                                    </span>                                  </div>                                  <div className="min-w-0">
                                    <p className="text-[12.5px] font-sans font-semibold text-stone-900 truncate max-w-xs">
                                      {singleFile?.name}
                                    </p>
                                    <p className="text-[10.5px] text-stone-400 font-sans">
                                      {formatBytes(singleFile?.sizeBytes)}
                                    </p>                                  </div>                                  <a                                    href={singleRawSrc}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 rounded-md text-[11px] font-sans font-medium ring-1 ring-white/60 shadow-2xs inline-flex items-center gap-1 transition-all"
                                    style={{
                                    color: accent,
                                      backgroundColor: accentTint,
                                    }}
                                  >
                                    <span>Open PDF</span>
                                    <span className="material-symbols-outlined text-[12px]">
                                      launch
                                    </span>                                  </a>                                </div>                              ) : singleCategory === 'audio' ? (
                                <div className="w-full h-44 sm:h-48 rounded-lg bg-white/20 backdrop-blur-sm ring-1 ring-white/40 shadow-xs p-3 flex flex-col items-center justify-center gap-2.5 mb-2.5 text-center">
                                  <span   className="material-symbols-outlined text-[28px]"
                                    style={{ color: accent }}
                                  >
                                    audiotrack
                                  </span>                                  <p className="text-[12.5px] font-sans font-medium text-stone-800 truncate max-w-xs">
                                    {singleFile?.name}
                                  </p>                                  <audio controls src={singleRawSrc} className="w-full max-w-xs h-8" />
                                </div>                              ) : singleCategory === 'video' ? (
                                <div className="w-full h-44 sm:h-48 rounded-lg bg-black/80 backdrop-blur-md ring-1 ring-white/20 shadow-xs flex items-center justify-center overflow-hidden mb-2.5">
                                  <video controls src={singleRawSrc} className="w-full h-full object-contain" />
                                </div>                              ) : (
                                <div className="w-full h-44 sm:h-48 overflow-y-auto p-2.5 bg-white/25 backdrop-blur-sm rounded-lg ring-1 ring-white/40 shadow-xs font-sans text-[11px] text-stone-800 select-text mb-2.5">
                                  <pre className="whitespace-pre-wrap leading-relaxed">
                                    {singleFile?.content.slice(0, 1500)}
                                  </pre>
                                </div>
                              )}
                            </div>
                            <div className="w-full flex items-center gap-1.5 p-1.5 bg-white/25 backdrop-blur-sm rounded-lg ring-1 ring-white/40 shadow-2xs">
                              <div className="min-w-0 flex-1 px-2 text-left">
                                <p className="text-[11px] font-sans text-stone-600 truncate">
                                  {singleFile?.name || `${files.length} files`}
                                </p>                              </div>                              {singleCategory === 'image' && singleFile && (
                                <button                                  onClick={() => setPreviewFile(singleFile)}
                                  className="h-7 px-2.5 rounded-md text-[11px] font-sans font-medium text-stone-700 bg-white/70 hover:bg-white ring-1 ring-black/5 inline-flex items-center gap-1 shrink-0 cursor-pointer transition-all active:scale-95 shadow-2xs"
                                >
                                  <span className="material-symbols-outlined text-[12px]">zoom_in</span>                                  <span>Inspect</span>
                                </button>
                            )}
                              <button                                onClick={() =>
                                  singleFile
                                    ? handleDownloadSingle(drop.id, singleFile)
                                    : handleDownloadAll(drop, files)
                              }
                                className="h-7 px-2.5 rounded-md text-[11px] font-sans font-medium text-white inline-flex items-center gap-1 shrink-0 cursor-pointer transition-all active:scale-95 shadow-2xs"
                                style={{ backgroundColor: accent }}
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  download
                                </span>                                <span>Download</span>                              </button>
                            </div>                          </div>
                          <div className="w-full h-full bg-white/25 backdrop-blur-md rounded-xl p-3.5 sm:p-4 flex flex-col shadow-xs ring-1 ring-white/50">
                            <div className="flex items-center justify-between w-full mb-2.5 pb-2 border-b border-white/30">
                              <div className="flex items-center gap-1.5 text-stone-900 text-[13px] font-sans font-semibold">
                                <span                                  className="material-symbols-outlined text-[17px]"
                                  style={{ color: accent }}
                                >
                                  smartphone
                                </span>                                <span>Scan on Mobile</span>                              </div>                              <span                                className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-md ring-1 ring-white/60 bg-white/30 shadow-2xs"
                                style={{
                                  color: accent,
                                }
                                }
                              >
                                Direct download
                            </span>                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center w-full">
                              <div className="w-full h-44 sm:h-48 rounded-lg bg-white/35 backdrop-blur-sm ring-1 ring-white/60 shadow-xs p-2.5 flex items-center justify-center mb-2.5">
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=svg&data=${encodeURIComponent(
                                    shareUrl
                                  )}`}
                                  alt="Scan QR Code"
                                  className="w-full h-full max-h-[160px] sm:max-h-[170px] object-contain"
                                />
                              </div>                            </div>
                            <div className="w-full flex items-center gap-1.5 p-1.5 bg-white/25 backdrop-blur-sm rounded-lg ring-1 ring-white/40 shadow-2xs">
                            <div className="min-w-0 flex-1 px-2 text-left">
                                <p className="text-[11px] font-sans text-stone-600 truncate select-all">
                                  {shareUrl}
                                </p>                              </div>                              <button                                onClick={(e) => handleCopyLink(drop, e)}
                                className="h-7 px-2.5 rounded-md text-[11px] font-sans font-medium text-white inline-flex items-center gap-1 shrink-0 cursor-pointer transition-all active:scale-95 shadow-2xs"
                                style={{ backgroundColor: accent }}
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  {isCopied ? 'done' : 'content_copy'}
                                </span>                                <span>{isCopied ? 'Copied' : 'Copy'}</span>                              </button>                            </div>                          </div>                        </div>                      </div>

                      <div className="px-3.5 py-2 sm:px-4 bg-white/25 backdrop-blur-md border-t border-white/40 flex items-center justify-between gap-3">
                        <button                          onClick={() => handleDownloadAll(drop, files)}
                          disabled={isZipping}
                          className="h-8.5 px-3.5 rounded-xl text-white text-[12px] font-sans font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-all"
                          style={{ backgroundColor: accent }}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {isZipping ? 'progress_activity' : 'download'}
                          </span>                          <span>
                            {isZipping
                              ? 'Packaging...'
                            : isMultiFile
                              ? `Download All (${formatBytes(totalSizeBytes)})`
                            : `Download (${formatBytes(totalSizeBytes)})`}
                        </span>                        </button>
                        <div className="flex items-center gap-2">
                        <button                            onClick={(e) => handleCopyLink(drop, e)}
                            className="h-8.5 px-3 rounded-xl text-[12px] font-sans font-medium border inline-flex items-center gap-1 cursor-pointer hover:bg-stone-50 transition-colors"
                            style={{
                              borderColor: accentBorder,
                              color: isCopied ? accent : '#44403c',
                            }}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {isCopied ? 'done' : 'link'}
                            </span>                            <span>{isCopied ? 'Copied' : 'Share Link'}</span>
                          </button>
                        </div>                      </div>
                    </motion.div>
                )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {previewFile && (
        <div          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewFile(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-150"
        >
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl flex items-center justify-between text-white mb-3 px-2"
          >
            <div className="min-w-0">
              <p className="text-[14px] font-medium font-sans truncate">{previewFile.name}</p>              <p className="text-[11px] text-stone-400 font-sans">
                {formatBytes(previewFile.sizeBytes)}
              </p>            </div>            <div className="flex items-center gap-2">
              <button                onClick={() =>
                  handleDownloadSingle(
                    expandedDropId || drops[0]?.id || '',
                    previewFile
                  )
              }
                className="px-3 py-1.5 rounded-full text-white text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-transform"
                style={{ backgroundColor: accent }}
              >
                <span className="material-symbols-outlined text-[15px]">download</span>                <span>Download</span>              </button>
              <button                onClick={() => setPreviewFile(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>       
                  </button>
            </div>          
        </div>
              

          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[82vh] flex items-center justify-center overflow-hidden rounded-xl bg-black/40 p-2"
          >
            <img
              src={previewFile.content}
              alt={previewFile.name}
              className="max-w-full max-h-[78vh] object-contain rounded-lg"
            />
          </div>        </div>
      )}
    </>
  );
};
                    