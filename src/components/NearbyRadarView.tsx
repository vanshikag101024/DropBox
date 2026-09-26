import React, { useState } from 'react';
import { motion } from 'motion/react';
import { NearbyDevice } from '../types';
import { useTheme } from '../context/ThemeContext';
import { setCustomDeviceName } from '../utils/nearbyService';

interface NearbyRadarViewProps {
  localDevice: NearbyDevice;
  nearbyDevices: NearbyDevice[];
  onSelectDevice?: (device: NearbyDevice) => void;
  sendingToDeviceId?: string | null;
  transferSuccessDeviceId?: string | null;
  successViewData?: string | null;
  isSendMode?: boolean;
  selectedFileSummary?: { name: string; sizeFormatted: string } | null;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getBlipCoordinates(dev: NearbyDevice, idx: number, total: number): { x: number; y: number } {
  const seed = hashString(dev.id);

  const sectorSpan = 360 / Math.max(total, 1);

  const maxJitter = Math.min(14, sectorSpan * 0.22);
  const jitter = ((seed % 100) / 100 - 0.5) * 2 * maxJitter;
  const baseAngle = idx * sectorSpan + 40;
  const angleDeg = (baseAngle + jitter + 360) % 360;
  const angleRad = (angleDeg * Math.PI) / 180;

  const minR = 58;
  const maxR = 74;
  const radius = minR + (seed % (maxR - minR + 1));

  const x = Math.round(Math.cos(angleRad) * radius);
  const y = Math.round(Math.sin(angleRad) * radius);

  return { x, y };
}

export const NearbyRadarView: React.FC<NearbyRadarViewProps> = ({
  localDevice,
  nearbyDevices,
  onSelectDevice,
  sendingToDeviceId,
  transferSuccessDeviceId,
  successViewData,
  isSendMode = false,
  selectedFileSummary,
}) => {
  const { accent } = useTheme();
  const [isEditingName, setIsEditingName] = useState(false);
  const [customName, setCustomName] = useState(localDevice.name);

  const otherDevices = nearbyDevices.filter(
    (d) => d.id !== localDevice.id
  );

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (customName.trim()) {
      setCustomDeviceName(customName.trim());
      localDevice.name = customName.trim();
      setIsEditingName(false);
    }
  };

  const getDeviceIcon = (type: NearbyDevice['type']) => {
    switch (type) {
      case 'mobile':
        return 'smartphone';
      case 'tablet':
        return 'tablet_mac';
      case 'laptop':
        return 'laptop_mac';
      case 'desktop':
      default:
        return 'desktop_windows';
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-3.5">

      <div className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-200/40 border border-slate-200/90 shadow-inner select-none z-0">

        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-slate-200/70 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-200/70 pointer-events-none" />

        <div          className="absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full border border-slate-200/90 pointer-events-none"
        />
        <div          className="absolute w-20 h-20 sm:w-22 sm:h-22 rounded-full border border-dashed border-slate-300/80 pointer-events-none"
        />

        <motion.div          animate={{ rotate: 360 }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full pointer-events-none origin-center"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, transparent 270deg, ${accent}15 320deg, ${accent}45 360deg)`,
          }}
        />

        <motion.div          animate={{ scale: [0.25, 1], opacity: [0.55, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border pointer-events-none"
          style={{ borderColor: accent }}
        />
        <motion.div          animate={{ scale: [0.25, 1], opacity: [0.55, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 1.25 }}
          className="absolute inset-0 rounded-full border pointer-events-none"
          style={{ borderColor: accent }}
        />

        {otherDevices.map((dev, idx) => {
          const { x, y } = getBlipCoordinates(dev, idx, otherDevices.length);
          const isSendingToThis = sendingToDeviceId === dev.id;

          return (
            <div              key={dev.id}
              id={`radar-blip-${dev.id}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
              }}
              onClick={() => onSelectDevice?.(dev)}
            >
              <motion.div                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                className="relative flex items-center justify-center p-1"
              >

                <span                  className="animate-ping absolute inline-flex h-4 w-4 rounded-full opacity-75"
                style={{ backgroundColor: isSendingToThis ? '#f59e0b' : dev.avatarColor || accent }}
                />

                <div                  className="relative w-3.5 h-3.5 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-transform group-hover:scale-130"
                style={{
                    backgroundColor: isSendingToThis ? '#f59e0b' : dev.avatarColor || accent,
                }}
                />

                <div className="absolute bottom-full mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-30 whitespace-nowrap">
                  <div className="bg-slate-900/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-md backdrop-blur-xs font-sans">
                    {dev.name}
                  </div>
                  <div className="w-1.5 h-1.5 bg-slate-900/90 rotate-45 -mt-0.5" />
                </div>
              </motion.div>
            </div>          );
        })}

        <div className="relative z-10 flex flex-col items-center">
          <div            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md relative"
            style={{ backgroundColor: accent }}
          >
            <span className="material-symbols-outlined text-[24px]">
              {getDeviceIcon(localDevice.type)}
            </span>          </div>        </div>      </div>
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium font-sans">This device:</span>          {isEditingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-1">
              <input                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="px-2 py-0.5 text-xs font-semibold rounded border border-slate-300 text-slate-900 focus:outline-none max-w-[120px]"
                autoFocus
            />
              <button                type="submit"
                className="text-[11px] px-2 py-0.5 rounded text-white font-medium cursor-pointer"
                style={{ backgroundColor: accent }}
              >
                Save
              </button>            </form>          ) : (
            <button              type="button"
              onClick={() => setIsEditingName(true)}
              className="group flex items-center gap-1 text-xs font-bold text-slate-800 hover:text-slate-950 transition-colors cursor-pointer"
              title="Click to rename device"
            >
              <span className="max-w-[130px] truncate">{localDevice.name}</span>
              <span className="material-symbols-outlined text-[13px] text-slate-400 group-hover:text-slate-600">
                edit
              </span>            </button>          )}
        </div>
        <span className="text-[11px] text-slate-400 font-medium font-sans flex items-center gap-1.5 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {isSendMode ? 'Scanning for nearby receivers' : 'Ready to receive files'}
        </span>      </div>
      {selectedFileSummary && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <span className="material-symbols-outlined text-[15px]" style={{ color: accent }}>
            attachment
          </span>          <span className="font-semibold truncate max-w-[180px]">
            {selectedFileSummary.name}
          </span>          <span className="text-slate-500 font-sans text-xs">
            ({selectedFileSummary.sizeFormatted})
          </span>        </div>      )}

      {successViewData && (
        <motion.div          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium font-sans ${
            transferSuccessDeviceId || successViewData.toLowerCase().includes('successful'
            )
              ? 'bg-slate-900 text-white font-semibold'
              : successViewData.toLowerCase().includes('decline')
              ? 'bg-rose-50 border border-rose-200 text-rose-800 font-semibold'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}
        >
          {transferSuccessDeviceId || successViewData.toLowerCase().includes('successful') ? (
            <span className="material-symbols-outlined text-[16px] text-white">
              check_circle
            </span>
          ) : successViewData.toLowerCase().includes('decline') ? (
            <span className="material-symbols-outlined text-[16px] text-rose-600">
              cancel
            </span>          ) : (
            <span className="material-symbols-outlined text-[16px] animate-spin">
            progress_activity
            </span>          )}
          <span>{successViewData}</span>        </motion.div>
      )}

      <div className="w-full">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
            {isSendMode ? `Nearby Receivers (${otherDevices.length})` : `Nearby Devices (${otherDevices.length})`}
          </span>        </div>

        {otherDevices.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center flex flex-col items-center gap-2">
            <span className="text-xs text-slate-600 font-medium font-sans">
              {isSendMode
                ? 'Scanning for active nearby receivers...'
                : 'Scanning for active receivers on the network...'}
            </span>            {isSendMode && (
              <span className="text-[11px] text-slate-400 font-sans max-w-sm">
                Recipients appear here when they open the "Receive" &gt; "Live" section on their device.
              </span>            )}
            <a              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer no-underline font-sans"
            >
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>              <span>Open in second window to test</span>            </a>          </div>
        ) : (
          <div className="space-y-2">
            {otherDevices.map((device) => {
              const isSending = sendingToDeviceId === device.id;
              const isDelivered = transferSuccessDeviceId === device.id;
              return (
                <div                  key={device.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isDelivered
                    ? 'border-slate-400 bg-slate-50 shadow-xs'
                      : isSending
                      ? 'border-amber-400 bg-amber-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: device.avatarColor || accent }}
                    >
                      <span className="material-symbols-outlined text-[19px]">
                        {getDeviceIcon(device.type)}
                      </span>                    </div>                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 truncate font-sans">
                          {device.name}
                        </h4>                        {device.isReceiving ? (
                          <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200 font-sans">
                            Ready
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-sans">
                            Active
                        </span>                        )}
                      </div>                      <p className="text-[10.5px] text-slate-400 truncate font-sans mt-0.5">
                        {device.os} • {device.browser}
                      </p>                    </div>                  </div>
                  {isSendMode ? (
                    <div className="shrink-0 ml-2">
                      {isDelivered ? (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold font-sans shadow-xs">
                          <span className="material-symbols-outlined text-[15px]">
                            check-circle
                          </span>                          <span>Delivered!</span>                        </div>                      ) : isSending ? (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-medium font-sans">
                          <span className="material-symbols-outlined text-[15px] animate-spin">
                            progress-activity
                          </span>                          <span>Sending</span>                        </div>                      ) : (
                        <button
                          type="button"
                          disabled={!!sendingToDeviceId || !!transferSuccessDeviceId}
                          onClick={() => onSelectDevice && onSelectDevice(device)
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs hover:shadow transition-all flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50 font-sans"
                          style={{ backgroundColor: accent }}
                        >
                          <span>Send</span>                          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>                        </button>
                          )}
                    </div>                  ) : (
                    <div className="shrink-0 ml-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                    </span>                    </div>                  )}
                </div>              );
            })}
          </div>        )}
      </div>
    </div>
  );
};