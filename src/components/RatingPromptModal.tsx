import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface RatingPromptModalProps {
  isOpen: boolean;
  onRate: (rating: number) => void;
  onClose: () => void;
}

export const RatingPromptModal: React.FC<RatingPromptModalProps> = ({
  isOpen,
  onRate,
  onClose,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSelectStar = (rating: number) => {
    setSelectedRating(rating);
    setSubmitted(true);
    onRate(rating);
    setTimeout(() => {
      onClose();

      setTimeout(() => {
        setSubmitted(false);
        setSelectedRating(null);
        setHoverRating(null);
      }, 200);
    }, 900);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 select-none">
          <motion.div            
            id="rating-prompt-card"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="bg-white/95 backdrop-blur-md border border-slate-200/90 text-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-[0-14px-38px--8px-rgba(0,0,0,0.16),0-0-0-1px-rgba(0,0,0,0.04)] flex flex-col items-center gap-2.5 min-w-[270px]"
            role="dialog"
            aria-label="rate your transfer"
          >

            <div className="w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-500 text-[18px]">
                  star
                </span>                <span className="text-xs font-bold text-slate-800 tracking-tight font-sans">
                  {submitted ? 'thank you for your rating!' : 'rate your transfer'}
                </span>              </div>              {!submitted && (
                <button                  type="button"
                  onClick={onClose}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="dismiss"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>                </button>              )}
            </div>
            <div              className="flex items-center gap-1.5 py-0.5"
              onMouseLeave={() => setHoverRating(null)}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating !== null ? hoverRating : (selectedRating || 0)) >= star;
               return (
                  <button                    key={star}
                    type="button"
                    disabled={submitted}
                    onMouseEnter={() => !submitted && setHoverRating(star)}
                    onClick={() => handleSelectStar(star)}
                    className="p-1 text-slate-300 hover:scale-115 active:scale-95 transition-all duration-150 cursor-pointer disabled:cursor-default"
                    aria-label={`${star} star`}
                  >
                    <svg                      className={`w-6 h-6 transition-colors duration-150 ${
                        isFilled
                        ? 'fill-amber-400 stroke-amber-400 text-amber-400 drop-shadow-[0-2px-5px-rgba(251,191,36,0.35)]'
                          : 'fill-slate-50 stroke-slate-300 stroke-[1.5]'
                    }`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
               );
              })}
            </div>
            {submitted && (
              <motion.div                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 text-xs text-slate-900 font-bold bg-slate-100 px-3 py-1.5 rounded-full border border-slate-300 font-sans"
              >
                <span className="material-symbols-outlined text-[15px] text-slate-900 font-bold">check-circle</span>                
                <span className="text-slate-900 font-bold">saved! average rating updated.</span>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};