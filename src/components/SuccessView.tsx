import React from 'react';
import { motion } from 'motion/react'; 

interface SuccessViewProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  title = 'Transfer Complete',
  subtitle = 'File transferred successfully. Returning to home...',
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`w-full max-w-md mx-auto py-10 sm:py-16 flex flex-col items-center justify-center text-center font-sans ${className}`}
    >

      <motion.div
        initial={{ scale: 0.35, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          damping: 14,
          stiffness: 240,
          delay: 0.05,
        }}
        className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md mb-5"
      >
        <span className="material-symbols-outlined text-[36px] font-bold select-none text-white">
          check
        </span>      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-sans mb-2"
      >
        {title}
      </motion.h3>

      <motion.p        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="text-sm sm:text-base text-slate-500 font-sans leading-relaxed max-w-sm"
      >
        {subtitle}
      </motion.p>
    </motion.div>
  );
};