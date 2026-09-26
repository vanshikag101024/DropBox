import React, { useState } from 'react';

interface CliSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const CliSyncModal: React.FC<CliSyncModalProps> = ({ isOpen, onClose, onShowToast }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const commands = [
    {
    label: 'Install CLI Tool (macOS / Linux)',
      cmd: 'curl -fsSL https://shareme.internal/install.sh | sh',
    },
    {
      label: 'Push Ephemeral Secret via CLI',
      cmd: 'shareme push ./deploy-production-cluster.sh --ttl 1d --burn 25',
    },
    {
      label: 'Pull & Verify Enclave Payload',
      cmd: 'shareme pull EPHEM-SH-8812-Q --verify-attestation',
    },
    {
      label: 'Inspect Active Vault Buffer Status',
      cmd: 'shareme status --node us-east-01',
    },
  ];

  const handleCopy = (cmd: string, idx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(idx);
    onShowToast('Command copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div
      id="cli-sync-modal-backdrop"
      className="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div        id="cli-sync-modal-dialog"
        className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-[#c3c6d7]/50 space-y-5"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#ddd6fe]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-[#f5f3ff] flex items-center justify-center text-[#7c3aed]">
              <span className="material-symbols-outlined text-2xl">terminal</span>            </div>            <div>
              <h2 className="text-[18px] font-bold text-[#160d26] font-sans">
                Command-Line Interface (CLI Sync)
              </h2>              <p className="text-[12px] text-[#434655]">
                Direct POSIX terminal bindings for automated CI/CD and air-gapped workstations.
              </p>            </div>          </div>          <button            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737686] hover:bg-[#f5f3ff] hover:text-[#160d26] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>          </button>        </div>
        <div className="space-y-4">
          {commands.map((c, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="text-[12px] font-semibold text-[#434655] font-sans flex items-center justify-between">
                <span>{c.label}</span>                {copiedIndex === idx && (
                  <span className="text-[11px] font-sans text-[#7c3aed] font-bold">Copied!</span>                )}
              </div>              <div className="flex items-center gap-2 p-2.5 bg-[#160d26] rounded-lg text-[#faf8fc] font-sans text-[12px]">
                <span className="text-[#a78bfa] select-none font-bold">$</span>                <span className="flex-1 overflow-x-auto select-all text-[#ddd6fe]">{c.cmd}</span>                <button                  onClick={() => handleCopy(c.cmd, idx)}
                  className="p-1 text-[#737686] hover:text-white transition-colors"
                  title="Copy command"
                >
                  <span className="material-symbols-outlined text-[16px]">content-copy</span>
                </button>              </div>            </div>          ))}
        </div>
        <div className="pt-2 flex items-center justify-end text-[12px] border-t border-[#ddd6fe]/60">
          <button            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-[12px] font-medium hover:bg-[#6d28d9]"
          >
            Done
          </button>        </div>      </div>    </div>  );
};