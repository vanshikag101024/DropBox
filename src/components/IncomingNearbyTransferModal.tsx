import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NearbyTransferOffer } from '../types';
import { useTheme } from '../context/ThemeContext';
import { respondToNearbyTransfer, triggerDirectDownload } from '../utils/nearbyService';

interface IncomingNearbyTransferModalProps {
  offer: NearbyTransferOffer | null;
  onClose: () => void;
  onShowToast: (msg: string) => void;
  onTransferCompleted?: () => void;
}

export const IncomingNearbyTransferModal: React.FC<IncomingNearbyTransferModalProps> = ({
  offer,
  onClose,
  onShowToast,
  onTransferCompleted,
}) => {
  const { accent } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const autoFinishTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (autoFinishTimerRef.current) {
        clearTimeout(autoFinishTimerRef.current);
      }
    };
  }, []);

  if (!offer) return null;

  const { file, fromDevice, message } = offer;

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleFinish = () => {
    if (autoFinishTimerRef.current) {
      clearTimeout(autoFinishTimerRef.current);
    }
    onClose();
    onTransferCompleted?.();
  };

  const handleDecline = async () => {
    try {
      await respondToNearbyTransfer(offer.transferId, 'declined', offer.toDeviceId, offer.fromDevice.id);
    } catch {}
    onShowToast(`Declined transfer from ${fromDevice.name}`);
    onClose();
  };

  const handleAccept = () => {
    if (isProcessing) return;
    setIsProcessing(true);

    let cur = 20;
    setProgress(cur);

    const interval = setInterval(() => {
      cur += 25;
      if (cur >= 100) {
        clearInterval(interval);
        setProgress(100);
        setIsCompleted(true);

        try {
          triggerDirectDownload({
            name: file.name,
            content: file.content,
            mimeType: file.mimeType,
          });
          respondToNearbyTransfer(offer.transferId, 'accepted', offer.toDeviceId, offer.fromDevice.id);
        } catch (err) {
          console.warn('Accept error:', err);
        }

        onClose();
        onTransferCompleted?.();
      } else {
        setProgress(cur);
      }
    }, 100);
  };

  const isImage = file.type?.includes('Image') || (file.content && file.content.startsWith('data:image/'));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-[2px]">
        <motion.div          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-[360px] bg-white rounded-2xl shadow-xl border border-slate-200 p-6 flex flex-col items-center justify-center font-sans text-center"
        >
          {isCompleted ? (
            <div className="py-4 flex flex-col items-center justify-center text-center font-sans w-full">
              <motion.div                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  damping: 14,
                  stiffness: 240,
                  delay: 0.05,
                }}
                className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md mb-4"
              >
                <span className="material-symbols-outlined text-[36px] font-bold select-none text-white">
                  check
                </span>              </motion.div>

              <motion.h3                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-sans mb-1"
              >
                Transfer Complete
              </motion.h3>

              <motion.p               
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="text-xs text-slate-500 font-sans leading-relaxed max-w-[240px]"
              >
                File saved to Downloads. Returning to home...
               </motion.p>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-4 text-left">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-sans tracking-tight">
                    Incoming File
                  </h3>                 
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    From <span className="font-semibold text-slate-800">{fromDevice.name}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>                </button>              </div>
              <div className="flex items-center gap-3 py-1">
                {isImage ? (
                  <img                    src={file.content}
                    alt={file.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
                  />
                ) : (
                  <div                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: accent }}
                  >
                    <span className="material-symbols-outlined text-[22px]">
                      {file.type?.includes('PDF') ? 'picture_as_pdf' : 'description'}
                    </span>                  </div>                )}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate font-sans">
                    {file.name}
                </h4>                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    {formatBytes(file.sizeBytes)}
                  </p>                </div>              </div>
              {message && message.trim() && (
                <p className="text-sm text-slate-600 font-hand font-bold italic px-1 -mt-1">
                  "{message.trim()}"
                </p>              )}

              {isProcessing ? (
                <div className="flex flex-col gap-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-medium font-sans">
                    <span className="text-slate-700">Receiving...</span>
                    <span className="text-slate-500">{progress}%</span>
                  </div>
                 <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full transition-all duration-150 rounded-full"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: accent,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                    type="button"
                    onClick={handleDecline}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors cursor-pointer text-center font-sans"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={handleAccept}
                    className="py-2.5 px-3 rounded-xl text-white font-semibold text-xs shadow-xs hover:opacity-95 transition-all cursor-pointer text-center font-sans"
                    style={{ backgroundColor: accent }}
                  >
                    Accept & Save
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
