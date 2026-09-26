import React, { useState } from 'react';
import { DropPayload, DropFileItem } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  downloadPayloadFile,
  downloadFilesAsZip,
  formatBytes,
  getShareableVaultUrl,
} from '../utils/crypto';

interface SharedDropViewProps {
  drop: DropPayload | null;
  onConsumeTransfer: (dropId: string) => void;
  onBurnDrop: (dropId: string) => void;
  onShowToast: (msg: string) => void;
  onBackToTransfer: () => void;
}

export const SharedDropView: React.FC<SharedDropViewProps> = ({
  drop,
  onConsumeTransfer,
  onBurnDrop,
  onShowToast,
  onBackToTransfer,
}) => {
  const { accent, accentBorder, accentTint, accentHover } = useTheme();
  const [showQr, setShowQr] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [previewFile, setPreviewFile] = useState<DropFileItem | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  if (!drop) {
    return (
    <div className="w-full max-w-md mx-auto px-4 py-16 text-center relative z-10">
       <div          className="bg-white rounded-3xl p-8 border shadow-xs space-y-4"
          style={{ borderColor: accentBorder }}
        >
          <h2 className="text-lg font-semibold font-sans tracking-tight" style={{ color: accent }}>
            No Drop Selected
          </h2>          <p className="text-[13.5px] text-stone-500 max-w-sm mx-auto leading-relaxed">
            No transfer is currently open, or the file has expired and been shredded.
          </p>          <div className="pt-2">
            <button              onClick={onBackToTransfer}
              className="px-5 py-2.5 rounded-full text-white text-[13px] font-sans font-semibold transition-transform active:scale-98 cursor-pointer inline-flex items-center gap-2 shadow-xs"
              style={{ backgroundColor: accent }}
            >
              <span className="material-symbols-outlined text-[17px]">add</span>              <span>Create Transfer</span>            </button>          </div>        </div>      </div>    );
  }

  const files: DropFileItem[] =
    drop.files && drop.files.length > 0
      ? drop.files      : [
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
  const shareUrl = getShareableVaultUrl(drop.id, drop.key);

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
        return 'picture-as-pdf';
      case 'audio':
        return 'graphic-eq';
      case 'video':
        return 'movie';
      case 'text':
        return 'code';
      default:
        return 'draft';
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    onShowToast('Share link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContent(true);
    onShowToast('Content copied to clipboard');
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const handleDownloadSingle = (file: DropFileItem) => {
    downloadPayloadFile(file.name, file.content, file.mimeType);
    onConsumeTransfer(drop.id);
    onShowToast(`Downloaded ${file.name}`);
  };

  const handleDownloadAll = async () => {
    if (isMultiFile) {
      setIsZipping(true);
      try {
        const zipName = `${drop.name.replace(/[^a-zA-Z0-9--]/g, '-') || 'transfer'}.zip`;
        await downloadFilesAsZip(zipName, files);
        onConsumeTransfer(drop.id);
        onShowToast(`Downloaded all ${files.length} files as ZIP`);
      } catch (err: any) {
        onShowToast('Error creating ZIP file');
      } finally {
        setIsZipping(false);
      }
    } else {
      handleDownloadSingle(files[0]);
    }
  };

  const singleFile = files[0];
  const singleCategory = getFileCategory(singleFile);
  const singleRawSrc = singleFile.content.startsWith('data:')
    ? singleFile.content
    : `/api/drops/${drop.id}/raw`;

  return (
    <>
      <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-4 sm:py-6 relative z-10 flex flex-col gap-3.5">
        
        <div className="flex items-center justify-between gap-2">
          <button            onClick={onBackToTransfer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-sans font-medium border transition-all cursor-pointer hover:shadow-xs group"
            style={{
              backgroundColor: accentTint,
              color: accent,
            borderColor: accentBorder,
            }}
        >
            <span className="material-symbols-outlined text-[16px] transition-transform group-hover:-translate-x-0.5">
              arrow-back
            </span>            <span>Back</span>          </button>
          <div            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-sans border bg-white/80 backdrop-blur-xs text-stone-600"
            style={{ borderColor: accentBorder }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accent }} />
            <span className="material-symbols-outlined text-[14px] opacity-70">schedule</span>            <span>
              {drop.expirationPolicy === 'never'
                ? 'Single-Access'
                : `Expires ${drop.expiresInText}`}
            </span>          </div>        </div>
        <div          id="shared-drop-card"
          className="w-full bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-colors"
          style={{ borderColor: accentBorder }}
        >
          
          <div            className="p-4 sm:p-5 border-b flex items-start justify-between gap-3 bg-white"
            style={{ borderColor: accentBorder }}
          >
            <div className="min-w-0 space-y-1 flex-1">
              <h1                className="text-base sm:text-lg font-bold font-sans tracking-tight truncate select-all"
                style={{ color: accent }}
              >
                {drop.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-stone-500">
                <span                  className="px-2 py-0.5 rounded-md font-semibold text-[11px]"
                  style={{ backgroundColor: accentTint, color: accent }}
                >
                {isMultiFile ? `${files.length} Files` : singleFile.type || 'File'}
                </span>                <span>•</span>                <span className="font-sans text-stone-600">
                  {formatBytes(totalSizeBytes)}
                </span>                <span>•</span>
                <span className="inline-flex items-center gap-0.5 text-[11px]" style={{ color: accent }}>
                  <span className="material-symbols-outlined text-[13px]">verified-user</span>                  <span>AES-256</span>                </span>              </div>            </div>

            <button
              onClick={() => {
                if (confirm('Permanently shred and delete this transfer drop/')) {
                onBurnDrop(drop.id);
                }
              }}
              className="p-1.5 rounded-full text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
              title="Permanently delete transfer"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>            </button>          </div>
          {isMultiFile ? (
            
            <div className="p-3 sm:p-4 bg-stone-50/40">
              <div className="text-[11.5px] font-sans font-medium text-stone-500 mb-2 px-1 flex items-center justify-between">
                <span>Included Files ({files.length})</span>                <span>Total {formatBytes(totalSizeBytes)}</span>              </div>
              <div                className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5"
                style={{ scrollbarWidth: 'thin' }}
              >
                {files.map((file, idx) => {
                  const cat = getFileCategory(file);
                  const isImg = cat === 'image';

                  return (
                    <div                      key={file.id || idx}
                      className="group flex items-center justify-between gap-2.5 p-2 rounded-xl bg-white border hover:border-stone-300 transition-all shadow-2xs"
                      style={{ borderColor: accentBorder }}
                    >
                      
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {isImg ? (
                          <div                            onClick={() => setPreviewFile(file)}
                            className="w-9 h-9 rounded-lg overflow-hidden border shrink-0 bg-stone-100 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ borderColor: accentBorder }}
                          >
                            <img                              src={file.content}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          </div>                        ) : (
                        <div                            className="w-9 h-9 rounded-lg border shrink-0 flex items-center justify-center"
                            style={{
                              backgroundColor: accentTint,
                        color: accent,
                              borderColor: accentBorder,
                            }}
                          >
                            <span className="material-symbols-outlined text-[19px]">
                            {getFileIcon(cat)}
                            </span>                          </div>                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-stone-800 truncate" title={file.name}>
                            {file.name}
                          </p>                          <p className="text-[11px] text-stone-400 font-sans">
                            {formatBytes(file.sizeBytes || 0)}
                        </p>                        </div>                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isImg && (
                          <button                            onClick={() => setPreviewFile(file)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Preview image"
                          >
                            <span className="material-symbols-outlined text-[17px]">visibility</span>                          </button>                        )}
                        <button                          onClick={() => handleDownloadSingle(file)}
                          className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-stone-100"
                          style={{ color: accent }}
                          title={`Download ${file.name}`}
                        >
                          <span className="material-symbols-outlined text-[17px]">download</span>                        </button>                      </div>                    </div>
                  );
                })}
              </div>            </div>          ) : (
            
            <div className="p-3 sm:p-4 bg-stone-50/40 border-b flex flex-col items-center justify-center" style={{ borderColor: accentBorder }}>
              {singleCategory === 'image' ? (
                <div                  className="w-full rounded-xl p-2.5 flex flex-col items-center justify-center relative group"
                  style={{
                    backgroundColor: accentTint,
                    borderColor: accentBorder,
                  }}
                >
                  <img                    src={singleRawSrc
                  }
                    alt={singleFile.name}
                    referrerPolicy="no-referrer"
                    onClick={() => setPreviewFile(singleFile)}
                    className="max-h-44 sm:max-h-48 w-auto max-w-full object-contain rounded-lg shadow-2xs cursor-pointer hover:opacity-95 transition-opacity"
                  />

                  <button                    onClick={() => setPreviewFile(singleFile)}
                    className="absolute bottom-4 right-4 px-2.5 py-1 rounded-full bg-white/90 hover:bg-white backdrop-blur-md border shadow-xs text-[11px] font-medium inline-flex items-center gap-1 transition-all cursor-pointer"
                    style={{ color: accent, borderColor: accentBorder }}
                    title="View full size"
                  >
                    <span>Full size</span>                    <span className="material-symbols-outlined text-[13px]">zoom-in</span>                  </button>                </div>              ) : singleCategory === 'pdf' ? (
                <div className="w-full py-4 flex items-center justify-between gap-3 px-3 rounded-xl bg-white border" style={{ borderColor: accentBorder }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div                      className="w-10 h-10 rounded-lg flex items-center justify-center border shrink-0"
                    style={{ backgroundColor: accentTint, color: accent, borderColor: accentBorder }}
                    >
                    <span className="material-symbols-outlined text-[22px]">picture-as-pdf</span>
                    </div>                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-stone-900 truncate">{singleFile.name}</p>                      <p className="text-[11px] text-stone-500 font-sans">{formatBytes(singleFile.sizeBytes)}</p>                    </div>                  </div>                  <a                    href={singleRawSrc}
                    target="-blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-full text-[12px] font-medium border inline-flex items-center gap-1 hover:shadow-xs transition-all shrink-0"
                    style={{ color: accent, borderColor: accentBorder, backgroundColor: accentTint }}
                  >
                    <span>Open</span>                    <span className="material-symbols-outlined text-[13px]">launch</span>                  </a>                </div>              ) : singleCategory === 'audio' ? (
                <div className="w-full py-3 px-2 flex flex-col items-center gap-2">
                  <audio controls src={singleRawSrc} className="w-full h-9" />
                </div>              ) : singleCategory === 'video' ? (
                <div className="w-full rounded-xl overflow-hidden bg-black flex justify-center max-h-48">
                  <video controls src={singleRawSrc} className="max-h-48 w-auto" />
                </div>              ) : (
                
                <div className="w-full max-h-36 overflow-y-auto p-3 bg-white rounded-xl border font-sans text-[12px] text-stone-800 select-text" style={{ borderColor: accentBorder }}>
                  <pre className="whitespace-pre-wrap leading-relaxed">{singleFile.content.slice(0, 1000)}</pre>                  {singleFile.content.length > 1000 && (
                    <span className="text-[10.5px] text-stone-400 block pt-1 font-sans italic">
                      ... (remaining content available upon download)
                    </span>                  )}
                </div>              )}
            </div>          )}

          <div className="p-3.5 sm:p-4 bg-white flex items-center gap-2">
            
            <button              id="download-btn"
              onClick={handleDownloadAll}
              disabled={isZipping}
              className="flex-1 h-10 px-4 rounded-full text-white text-[13px] font-sans font-semibold inline-flex items-center justify-center gap-1.5 transition-all hover:shadow-md active:scale-98 cursor-pointer disabled:opacity-75"
              style={{ backgroundColor: accent }}
            >
              <span className="material-symbols-outlined text-[17px]">
                {isMultiFile ? 'folder-zip' : 'download'}
            </span>              <span>
                {isZipping
                  ? 'Packaging ZIP...'
                  : isMultiFile
                  ? `Download All (${files.length})`
                  : `Download (${formatBytes(totalSizeBytes)})`}
            </span>            </button>
            {!isMultiFile && singleCategory === 'text' && (
              <button                onClick={() => handleCopyContent(singleFile.content)}
                className="h-10 px-3.5 rounded-full text-[12.5px] font-sans font-medium inline-flex items-center gap-1 border transition-all hover:shadow-xs active:scale-98 cursor-pointer"
                style={{
                  backgroundColor: accentTint,
                  color: accent,
                  borderColor: accentBorder,
                }}
                title="Copy text content"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copiedContent ? 'done' : 'content-copy'}
                </span>                <span>{copiedContent ? 'Copied' : 'Copy'}</span>              </button>            )}

            <button              id="copy-link-btn"
              onClick={handleCopyLink}
              className="h-10 px-3.5 sm:px-4 rounded-full text-[12.5px] font-sans font-semibold inline-flex items-center gap-1.5 border transition-all hover:shadow-xs active:scale-98 cursor-pointer"
              style={{
                backgroundColor: accentTint,
                color: accent,
                borderColor: accentBorder,
              }}
              title="Copy share link"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copiedLink ? 'done' : 'link'}
              </span>              <span>{copiedLink ? 'Copied' : 'Share'}</span>            </button>
            <button              onClick={() => setShowQr(!showQr)}
              className="h-10 w-10 rounded-full inline-flex items-center justify-center border transition-all hover:shadow-xs active:scale-98 cursor-pointer shrink-0"
              style={{
                backgroundColor: showQr ? accent : accentTint,
                color: showQr ? '#ffffff' : accent,
                borderColor: showQr ? accent : accentBorder,
              }}
              title="Scan QR code on mobile"
            >
            <span className="material-symbols-outlined text-[18px]">qr-code-2</span>            </button>
          </div>
          {showQr && (
            <div              className="p-3.5 border-t flex items-center gap-3.5 animate-in fade-in duration-150"
              style={{
                borderColor: accentBorder,
                backgroundColor: accentTint,
              }}
            >
              <div                className="w-18 h-18 bg-white p-1 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs"
                style={{ borderColor: accentBorder }}
              >
                <img                  src={`https://api.qrserver.com/v1/create-qr-code//size=140x140&data=${encodeURIComponent(shareUrl)}`}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-[12.5px] font-semibold font-sans" style={{ color: accent }}>
                  Scan on mobile device
                </div>                <p className="text-[11px] text-stone-600 font-sans leading-tight">
                  Camera scan will open & decrypt this transfer directly.
                </p>                <div                  className="text-[10.5px] font-sans truncate select-all px-2 py-1 rounded bg-white border"
                  style={{ color: accent, borderColor: accentBorder }}
                >
                  {shareUrl}
                </div>              </div>            </div>          )}
        </div>      </div>

      {previewFile && (
        <div          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewFile(null)
          }
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-150"
        >
          
          <div            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl flex items-center justify-between text-white mb-3 px-2"
          >
            <div className="min-w-0">
              <p className="text-[14px] font-semibold font-sans truncate">{previewFile.name}</p>              <p className="text-[11px] text-stone-400 font-sans">{formatBytes(previewFile.sizeBytes)}</p>            </div>            <div className="flex items-center gap-2">
              <button                onClick={() => handleDownloadSingle(previewFile)}
                className="px-3 py-1.5 rounded-full text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-xs"
                style={{ backgroundColor: accent }}
              >
                <span className="material-symbols-outlined text-[15px]">download</span>                <span>Download</span>              </button>              <button                onClick={() => setPreviewFile(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>              </button>            </div>          </div>
          <div            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[82vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black/40 p-2"
          >
            <img              src={previewFile.content}
              alt={previewFile.name}
              className="max-w-full max-h-[78vh] object-contain rounded-xl"
            />
          </div>        </div>      )}
    </>
  );
};