import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBytes } from '../utils/crypto';

export interface FolderConfirmationModalProps {
  isOpen: boolean;
  folderName: string;
  files: File[];
  totalBytes: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const FolderConfirmationModal: React.FC<FolderConfirmationModalProps> = ({
  isOpen,
  folderName,
  files,
  totalBytes,
  onConfirm,
  onCancel,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'].includes(ext)) {
      return 'image';
    }
    if (['pdf'].includes(ext)) {
      return 'picture-as-pdf';
    }
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
      return 'audio-file';
    }
    if (['mp4', 'mov', 'webm', 'mkv'].includes(ext)) {
      return 'video-file';
    }
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
      return 'folder-zip';
    }
    if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'sh', 'html', 'css', 'sql'].includes(ext)) {
      return 'code';
    }
    return 'description';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div          id="folder-confirmation-backdrop"
          className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-14 px-4 bg-slate-950/20 backdrop-blur-[1.5px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onCancel();
            }
          }}
        >
          <motion.div  
            id="folder-confirmation-container"
            initial={{ opacity: 0, scale: 0.95, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -12 }}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            className="w-full max-w-[430px] bg-[#18181b] rounded-2xl shadow-[0-20px-50px-rgba(0,0,0,0.5)] border border-white/10 p-5 text-left select-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="folder-confirm-title"
          >

            <h3 id="folder-confirm-title"
              className="text-[17px] font-semibold text-white tracking-tight leading-snug"
            >
              Upload {files.length} file{files.length !== 1 ? 's' : ''} to this site?          </h3>            <p className="text-[13.5px] text-slate-300 mt-1.5 leading-normal">
              This will upload all file from{' '}          <span className="font-semibold text-white">"{folderName}"</span>. Only do this if you trust the site.
            </p>
            <div className="mt-3.5 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-[#bfa5f8]">folder</span>                  <span className="truncate max-w-[200px] text-slate-300 font-medium">{folderName}</span>                  <span>· {formatBytes(totalBytes)}</span>                </span>                <button                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-purple-300 hover:text-purple-200 transition-colors cursor-pointer flex items-center gap-0.5"
                >
                  {showDetails ? 'Hide files' : 'View files'}
                  <span className="material-symbols-outlined text-[14px]">
                    {showDetails ? 'expand-less' : 'expand-more'}
                  </span>                </button>              </div>
              {showDetails && (
                <motion.div                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2.5 max-h-36 overflow-y-auto space-y-1 pr-1 text-xs rounded-lg bg-black/30 p-2 border border-white/5"
                >
                  {files.map((file, idx) => {
                    const relativePath = file.webkitRelativePath || file.name ;
                   return (
                      <div  key={`${file.name}-${idx}`}
                        className="flex items-center justify-between gap-2 py-0.5 px-1 rounded hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">
                            {getFileIcon(file.name)}
                          </span>                          <span className="truncate text-slate-300 font-sans text-[11px]">
                            {relativePath}
                          </span>                        </div>                        <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                          {formatBytes(file.size)}
                        </span>                      </div>                    );
                  })}
                </motion.div>
              )}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button                id="btn-folder-confirm-upload"
                type="button"
                onClick={onConfirm}
                className="px-5 py-1.5 rounded-full bg-[#dcc7ff] hover:bg-[#d0b3ff] active:scale-95 text-[#1a1228] font-semibold text-[13.5px] transition-all shadow-xs cursor-pointer"
              >
                Upload
              </button>              <button                id="btn-folder-confirm-cancel"
                type="button"
                onClick={onCancel}
                className="px-5 py-1.5 rounded-full bg-[#272036] hover:bg-[#342b47] active:scale-95 text-white border-2 border-[#bfa5f8] font-semibold text-[13.5px] transition-all shadow-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>          </motion.div>
        </div>      )}
    </AnimatePresence>
  );
};