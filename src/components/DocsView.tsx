import React from 'react';

export const DocsView: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 relative z-10">

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#131b2e] font-sans">
          Architecture & Security
        </h1>        <p className="text-[13px] text-[#737686] mt-1 font-sans max-w-2xl leading-normal">
          Ephemeral zero-knowledge transfer designed for sensitive configs, certificates, and secrets.
        </p>      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

        <div className="md:col-span-7 space-y-4">
          <div className="bg-white/65 backdrop-blur-xl rounded-2xl p-6 border border-white/80 shadow-[0-8px-32px-0-rgba(124,58,237,0.06),0-1px-3px-0-rgba(0,0,0,0.02)] space-y-3">
            <h2 className="text-[15px] font-semibold text-[#160d26]">
              Client-Side URL Hash Decryption
            </h2>            <p className="text-[13px] text-[#434655] leading-relaxed">
              Encryption occurs entirely inside your browser using the WebCrypto API with AES-256-GCM. The decryption key is appended solely to the URL hash:
            </p>

            <div className="p-3 bg-white/70 backdrop-blur-sm rounded-xl border border-white/80 font-sans text-[11px] text-[#160d26] break-all select-all shadow-xs">
              https:
            </div>            <p className="text-[11px] text-[#737686]">
              Content after the <code className="font-sans text-[#7c3aed]">#</code> is never transmitted to the host server in HTTP requests.
            </p>
          </div>
          <div className="bg-white/65 backdrop-blur-xl rounded-2xl p-6 border border-white/80 shadow-[0-8px-32px-0-rgba(124,58,237,0.06),0-1px-3px-0-rgba(0,0,0,0.02)] space-y-3">
            <h2 className="text-[15px] font-semibold text-[#160d26]">
              CLI Integration
            </h2>            <p className="text-[13px] text-[#434655]">
              Upload directly via terminal or pipeline script:
            </p>
            <div className="space-y-2 font-sans text-[11px]">
              <div className="p-3 bg-[#160d26] text-[#faf8fc] rounded-xl select-all shadow-xs">
                <span className="text-[#737686] block mb-1"># Upload via cURL</span>
                curl -X POST https:
              </div>
            </div>          </div>        </div>
        <div className="md:col-span-5 space-y-4">
          <div className="bg-white/65 backdrop-blur-xl rounded-2xl p-6 border border-white/80 shadow-[0_8px_32px_0_rgba(124,58,237,0.06),0_1px_3px_0_rgba(0,0,0,0.02)] space-y-3">
            <h3 className="text-[15px] font-semibold text-[#160d26]">
              System Guarantees
            </h3>
            <div className="space-y-2.5 text-[12px]">
              <div className="p-3 rounded-xl bg-white/60 border border-white/70 space-y-0.5 shadow-xs">
                <div className="font-semibold text-[#160d26]">Zero Disk Persistence</div>                <p className="text-[#737686]">
                  Buffers reside purely in volatile memory. No database records or disks store decrypted contents.
                </p>              </div>
              <div className="p-3 rounded-xl bg-white/60 border border-white/70 space-y-0.5 shadow-xs">
                <div className="font-semibold text-[#160d26]">Immediate Scrubbing</div>                <p className="text-[#737686]">
                  Memory is zeroized immediately upon hitting transfer quota or expiration TTL.
                </p>              </div>
              <div className="p-3 rounded-xl bg-white/60 border border-white/70 space-y-0.5 shadow-xs">
                <div className="font-semibold text-[#160d26]">Hardware Verification</div>                <p className="text-[#737686]">
                  SHA-256 digests ensure byte-for-byte integrity during client transmission.
                </p>
              </div>            </div>          </div>        </div>      </div>    </div>  );
};