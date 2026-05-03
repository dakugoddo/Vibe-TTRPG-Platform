export const glassDark = {
    bg: 'bg-gradient-to-br from-[#061e2e] via-[#043330] to-[#091524]', // Dark cyan/blue gradient
    window: 'bg-[#151c2b]/65 backdrop-blur-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] rounded-2xl', // Lighter window in blueish tone and slightly more transparent
    header: 'bg-white/5 border-b border-white/10 p-4 rounded-t-2xl',
    titleText: 'text-white/90 font-medium tracking-wide',
    content: 'p-6 flex flex-col gap-5',
    blockBg: 'bg-[#151620]/80 border border-white/5 rounded-xl p-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]', // Darker blocks with inset shadow
    blockHeader: 'text-[10px] text-white/40 font-bold uppercase tracking-widest mb-4 flex justify-between items-center',
    input: 'bg-[#2e3145] border border-white/5 rounded-lg px-3 py-1.5 text-white/90 outline-none focus:bg-[#383c54] focus:border-white/30 transition-all font-sans hover:bg-[#34384e]', // Lighter interactive elements
};

export const glassLight = {
    bg: 'bg-gradient-to-br from-[#f8fafc] via-[#e2e8f0] to-[#cbd5e1]',
    window: 'bg-white/40 backdrop-blur-3xl border border-white/40 shadow-[0_15px_50px_rgba(0,0,0,0.1)] rounded-2xl',
    header: 'bg-white/40 border-b border-white/40 p-4 rounded-t-2xl',
    titleText: 'text-slate-800 font-medium tracking-tight',
    content: 'p-6 flex flex-col gap-6',
    blockBg: 'bg-white/30 border border-white/40 rounded-xl p-4 shadow-inner',
    blockHeader: 'text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4 flex justify-between items-center',
    input: 'bg-white/50 border border-white/40 rounded-lg px-3 py-1.5 text-slate-800 outline-none focus:bg-white/80 focus:border-indigo-500/50 transition-all font-mono',
};

// We will default to dark for now, but expose a way to toggle later
export const glass = glassDark;
