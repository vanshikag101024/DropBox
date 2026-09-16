import React from 'react';

export const Footer: React.FC = () => {
return (
    <footer    
      id="app-footer"
      className="w-full relative z-20 py-6 mt-auto transition-colors"
    >
      <div 
        className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="font-hand text-[30px] font-bold text-slate-900 tracking-tight leading-none select-none">
            dropbox
          </span>         
                <span className="text-slate-300 text-sm">/</span>        
              <span className="text-slate-500 text-[12.5px] font-sans">
            simple, private file sharing
          </span>       
           </div>
        <div className="text-slate-400 text-[12px] font-sans">
          all rights reserved by dropbox
        </div>      
     </div>    
</footer>
);
};