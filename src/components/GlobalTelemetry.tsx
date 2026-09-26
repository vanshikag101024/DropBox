import React from 'react';
import { GlobalTelemetryStats } from '../types';
import { useTheme } from '../context/ThemeContext';

interface GlobalTelemetryProps {
  stats: GlobalTelemetryStats;
  onPromptRate?: () => void;
  className?: string;
}

export function formatStatWithSpaces(value: number): string {
  const rounded = Math.floor(value || 0);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatVolume(gb: number, bytes?: number): string {
  if (typeof bytes === 'number' && bytes > 0) {
    if (bytes >= 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1)} TB`;
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  }
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = gb * 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = mb * 1024;
  return `${Math.max(0, kb).toFixed(0)} KB`;
}

export const GlobalTelemetry: React.FC<GlobalTelemetryProps> = ({
  stats,
  onPromptRate,
  className = '',
}) => {
  const { accent } = useTheme();

  const ratingValue = (stats.rating || 5.0).toFixed(1);

  return (
    <section     
     id="global-telemetry-metrics"
      aria-label="Global real-time network telemetry"
      className={`w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 my-10 sm:my-14 ${className}`}
    >
      <div className="w-full border-y border-slate-200/70 py-6 sm:py-8 lg:py-9">

        <div className="flex items-center justify-between w-full">

          <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0">
            <span
              className="text-[clamp(1.15rem,2.35vw,2.25rem)] font-extrabold tracking-tight font-sans leading-none select-none tabular-nums whitespace-nowrap"
              style={{ color: accent || '#f97316' }}
            >
              {formatStatWithSpaces(stats.downloadedFiles)}
            </span>
            <span className="text-[clamp(0.72rem,1.02vw,0.95rem)] font-bold text-slate-900 tracking-tight font-sans mt-2 mb-0.5 whitespace-nowrap">
              Downloaded Files
            </span>
            <span className="text-[clamp(0.6rem,0.85vw,0.78rem)] text-slate-400 font-sans tracking-tight whitespace-nowrap">
              Encrypted drops retrieved
            </span>
          </div>

          <div className="h-10 sm:h-12 lg:h-14 w-[1px] bg-slate-200/75 shrink-0 mx-3 sm:mx-6 md:mx-10 lg:mx-14" />

          <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0">
            <span className="text-[clamp(1.15rem,2.35vw,2.25rem)] font-extrabold tracking-tight font-sans leading-none select-none tabular-nums text-slate-900 whitespace-nowrap">
              {formatStatWithSpaces(stats.sentTransfers)}
            </span>
            <span className="text-[clamp(0.72rem,1.02vw,0.95rem)] font-bold text-slate-900 tracking-tight font-sans mt-2 mb-0.5 whitespace-nowrap">
              Sent Transfers
            </span>
            <span className="text-[clamp(0.6rem,0.85vw,0.78rem)] text-slate-400 font-sans tracking-tight whitespace-nowrap">
              Peer & vault dispatches
            </span>
          </div>

          <div className="h-10 sm:h-12 lg:h-14 w-[1px] bg-slate-200/75 shrink-0 mx-3 sm:mx-6 md:mx-10 lg:mx-14" />

          <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0">
            <span
              className="text-[clamp(1.15rem,2.35vw,2.25rem)] font-extrabold tracking-tight font-sans leading-none select-none tabular-nums whitespace-nowrap"
              style={{ color: accent || '#f97316' }}
            >
              {formatVolume(stats.gigabytesSent, stats.bytesSent)}
            </span>
            <span className="text-[clamp(0.72rem,1.02vw,0.95rem)] font-bold text-slate-900 tracking-tight font-sans mt-2 mb-0.5 whitespace-nowrap">
                  
              Sent into Orbit
            </span>
            <span className="text-[clamp(0.6rem,0.85vw,0.78rem)] text-slate-400 font-sans tracking-tight whitespace-nowrap">
              Payload streamed securely
            </span>
          </div>

          <div className="h-10 sm:h-12 lg:h-14 w-[1px] bg-slate-200/75 shrink-0 mx-3 sm:mx-6 md:mx-10 lg:mx-14" />

          <div
            onClick={onPromptRate}
            className={`flex-1 flex flex-col items-center justify-center text-center min-w-0 ${
              onPromptRate ? 'cursor-pointer group' : ''
            }`}
            title={onPromptRate ? 'Click to rate your experience' : undefined}
          >
            <div className="text-[clamp(1.15rem,2.35vw,2.25rem)] font-extrabold tracking-tight font-sans leading-none select-none tabular-nums text-slate-900 flex items-center justify-center whitespace-nowrap">
              <span>{ratingValue}</span>
              <span className="text-[0.8em] leading-none mb-0.5 ml-1 text-slate-900">★</span>
            </div>
            <span className="text-[clamp(0.72rem,1.02vw,0.95rem)] font-bold text-slate-900 tracking-tight font-sans mt-2 mb-0.5 whitespace-nowrap group-hover:text-slate-700 transition-colors">
              User Rating
            </span>
            <span className="text-[clamp(0.6rem,0.85vw,0.78rem)] text-slate-400 font-sans tracking-tight whitespace-nowrap">
              {stats.ratingsCount ? `Based on ${formatStatWithSpaces(stats.ratingsCount)} reviews` : 'Verified community score'}
            </span>
          </div>

        </div>
      </div>
    </section>
  );
      };