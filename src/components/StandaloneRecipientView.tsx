import React, { useState } from 'react';
import { DropPayload } from '../types';
import { useTheme } from '../context/ThemeContext';
import { downloadPayloadFile, formatBytes, getDirectRawUrl } from '../utils/crypto';

interface StandaloneRecipientViewProps {
  drop: DropPayload | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  onConsumeTransfer: (dropId: string) => void;
  onShowToast: (msg: string) => void;
  onOpenAppMode: () => void;
}

export const StandaloneRecipientView: React.FC<StandaloneRecipientViewProps> = ({
  drop,
  isLoading = false,
  errorMessage = null,
  onConsumeTransfer,
  onShowToast,
  onOpenAppMode,
}) => {
  const { accent, accentBorder, accentTint, accentHover } = useTheme();
  const [copiedText, setCopiedText] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50/50 text-stone-900 px-4">
        <div          className="flex flex-col items-center gap-4 bg-white p-8 rounded-3xl border shadow-[0-8px-30px-0-rgba(0,0,0,0.03)] text-center max-w-sm w-full"
          style={{ borderColor: accentBorder }}
        >
          <div            className="w-9 h-9 border-3 rounded-full animate-spin"
            style={{ borderColor: accentTint, borderTopColor: accent }}
          />
          <h2 className="text-base font-semibold text-stone-900">Opening Transfer...</h2>          <p className="text-[13px] text-stone-500">Decrypting secure payload.</p>
        </div>      </div>    );
  }

  if (errorMessage || !drop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50/50 text-stone-900 px-4">
        <div          className="flex flex-col items-center gap-4 bg-white p-8 rounded-3xl border shadow-[0-8px-30px-0-rgba(0,0,0,0.03)] text-center max-w-md w-full"
          style={{ borderColor: accentBorder }}
        >
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[26px]">lock_clock</span>          </div>          <h2 className="text-lg font-bold text-stone-900">Transfer Expired or Shredded</h2>
          <p className="text-[13.5px] text-stone-500 leading-relaxed">
            {errorMessage || 'This shared file has expired or was removed by its sender.'}
          </p>
          <button            onClick={onOpenAppMode}
            className="mt-2 px-5 py-2.5 rounded-full text-white text-[13px] font-sans font-medium transition-colors shadow-xs cursor-pointer"
            style={{ backgroundColor: accent }}
          >
            Create New Transfer
          </button>        </div>      </div>    );
  }

  const isImage =
    drop.type.toLowerCase().includes('image') ||
    (drop.mimeType && drop.mimeType.startsWith('image/')) ||
    drop.content.startsWith('data:image/') ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(drop.name);

  const isPdf =
    drop.type.toLowerCase().includes('pdf') ||
    (drop.mimeType && drop.mimeType.includes('pdf')) ||
    drop.content.startsWith('data:application/pdf') ||
    /\.pdf$/i.test(drop.name);

  const isAudio =
    drop.type.toLowerCase().includes('audio') ||
    (drop.mimeType && drop.mimeType.startsWith('audio/')) ||
    drop.content.startsWith('data:audio/') ||
    /\.(mp3|wav|ogg|m4a)$/i.test(drop.name);

  const isVideo =
    drop.type.toLowerCase().includes('video') ||
    (drop.mimeType && drop.mimeType.startsWith('video/')) ||
    drop.content.startsWith('data:video/') ||
    /\.(mp4|webm|mov)$/i.test(drop.name);

  const rawUrl = getDirectRawUrl(drop.id);
  const rawResourceSrc = drop.content.startsWith('data:') ? drop.content : rawUrl;

  const handleDownload = () => {
    downloadPayloadFile(drop.name, drop.content, drop.mimeType);
    onConsumeTransfer(drop.id);
    onShowToast(`Downloaded ${drop.name}`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(drop.content);
    setCopiedText(true);
    onShowToast('Content copied to clipboard');
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50/40 text-stone-900 font-sans antialiased">

      <header        className="w-full bg-white border-b px-4 sm:px-8 py-3.5 flex items-center justify-between"
        style={{ borderColor: accentBorder }}
      >
        <div className="flex items-center gap-2.5">
          <div            className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs"
            style={{ backgroundColor: accent }}
          >
            SM
          </div>          <span className="text-[14.5px] font-semibold" style={{ color: accent }}>
            ShareMe
          </span>        </div>

        <button          onClick={onOpenAppMode}
          className="text-[12.5px] hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
          style={{ color: accent }}
        >
          <span>Send a file</span>          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>        </button>      </header>
    <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        <div          className="w-full bg-white rounded-3xl border shadow-[0-8px-30px-0-rgba(0,0,0,0.03)] overflow-hidden flex flex-col"
          style={{ borderColor: accentBorder }}
        >

          {isImage ? (
            <div              className="p-5 pb-3 bg-stone-50/50 border-b flex flex-col items-center"
              style={{ borderColor: accentBorder }}
            >
              <div                className="relative group max-w-full flex items-center justify-center bg-white p-2 rounded-2xl border shadow-xs"
                style={{ borderColor: accentBorder }}
              >
                <img                  src={rawResourceSrc}
                  alt={drop.name}
                  className="max-h-56 sm:max-h-64 w-auto max-w-full object-contain rounded-xl"
                />
              </div>              <a href={rawUrl}
                target="-blank"
                rel="noopener noreferrer"
                className="mt-2.5 text-[12px] hover:underline font-sans inline-flex items-center gap-1"
                style={{ color: accent }}
              >
                <span>Open original full size</span>                <span className="material-symbols-outlined text-[13px]">launch</span>              </a>            </div>          ) : isPdf ? (
            <div              className="h-60 bg-stone-50/50 border-b flex flex-col items-center justify-center p-6 text-center gap-2"
              style={{ borderColor: accentBorder }}
            >
              <div                className="w-12 h-12 rounded-2xl flex items-center justify-center border"
                style={{ backgroundColor: accentTint, color: accent, borderColor: accentBorder }}
              >
                <span className="material-symbols-outlined text-[24px]">picture_as_pdf</span>              </div>              <span className="text-[14px] font-medium text-stone-900">{drop.name}</span>   <a  href={rawUrl}
                target="-blank"
                rel="noopener noreferrer"
                className="text-[12px] hover:underline font-sans inline-flex items-center gap-1"
                style={{ color: accent }}
              >
                <span>Open in PDF viewer</span>                <span className="material-symbols-outlined text-[13px]">launch</span>              </a>            </div>          ) : isAudio ? (
            <div              className="p-6 bg-stone-50/50 border-b flex flex-col items-center gap-3"
              style={{ borderColor: accentBorder }}
            >
              <div                className="w-12 h-12 rounded-2xl flex items-center justify-center border"
                style={{ backgroundColor: accentTint, color: accent, borderColor: accentBorder }}
              >
                <span className="material-symbols-outlined text-[24px]">graphic_eq</span>              </div>              <audio controls src={rawResourceSrc} className="w-full max-w-xs" />
            </div>         ) : isVideo ? (
  <div className="bg-[#1a0509] border-b flex justify-center" style={{ borderColor: accentBorder }}>
    <video controls src={rawResourceSrc} className="max-h-60 w-full" />
  </div>
) : (
            <div className="border-b bg-stone-50/30" style={{ borderColor: accentBorder }}>
              <div className="max-h-56 overflow-y-auto p-4 font-sans text-[12.5px] leading-relaxed text-stone-900 select-text">
                <pre className="whitespace-pre-wrap font-sans">{drop.content.slice(0, 1500)}</pre>
                {drop.content.length > 1500 && (
                  <div className="text-[11px] text-stone-500 pt-2 font-sans italic">
                    ... (full content available upon download)
                  </div>                )}
              </div>            </div>          )}

          <div className="p-5 sm:p-6 flex flex-col gap-4">
            <div>
              <h1                className="text-[16px] sm:text-[17px] font-semibold font-sans truncate select-all"
                style={{ color: accent }}
              >
                {drop.name}
              </h1>              <p className="text-[12.5px] text-stone-500 font-sans mt-0.5">
                {formatBytes(drop.sizeBytes || 1024)} • {isImage ? 'Image' : isPdf ? 'PDF' : isAudio ? 'Audio' : isVideo ? 'Video' : 'Text'}
              </p>            </div>
            <div className="flex items-center gap-2 pt-1">
              <button                onClick={handleDownload}
                className="flex-1 h-10 px-5 rounded-full text-white text-[13px] font-sans font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                style={{ backgroundColor: accent }}
              >
                <span className="material-symbols-outlined text-[17px]">download</span>                <span>Download</span>              </button>
              {!isImage && !isPdf && (
                <button                  onClick={handleCopy}
                  className="h-10 px-4 rounded-full text-[13px] font-sans font-medium inline-flex items-center gap-1.5 border transition-colors cursor-pointer"
                  style={{ backgroundColor: accentTint, color: accent, borderColor: accentBorder }}
                  title="Copy text"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copiedText ? 'done' : 'content_copy'}
                  </span>                  <span>{copiedText ? 'Copied' : 'Copy'}</span>                </button>              )}

              <a                href={rawUrl}
                target="-blank"
                rel="noopener noreferrer"
                className="h-10 px-4 rounded-full text-[13px] font-sans font-medium inline-flex items-center gap-1.5 border transition-colors cursor-pointer"
                style={{ backgroundColor: accentTint, color: accent, borderColor: accentBorder }}
                title="Open raw file in separate tab"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                <span>Open</span>              </a>
            </div>          </div>        </div>      </main>
      <footer className="w-full py-4 text-center text-[12px] text-stone-500">
        End-to-end encrypted • Ephemeral transit
      </footer>    </div>  );
};