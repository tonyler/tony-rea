export default function Header() {
  return (
    <header className="relative border-b border-smoke-400/20">
      {/* Subtle gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />

      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            {/* Logo mark - geometric amber shape */}
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-glow-sm">
                <span className="text-void-500 font-display font-black text-base tracking-tight">
                  T
                </span>
              </div>
              {/* Subtle glow behind logo */}
              <div className="absolute inset-0 rounded-lg bg-amber-400/20 blur-lg -z-10" />
            </div>

            <div className="flex flex-col">
              <h1 className="text-lg font-display font-bold text-cream-50 tracking-tight">
                Tony & Rea
              </h1>
              <span className="text-[10px] text-smoke-100 tracking-[0.2em] uppercase -mt-0.5">
                Internal Tools
              </span>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-jade-400 animate-pulse-slow" />
            <span className="text-xs text-smoke-100 tracking-wide">Active</span>
          </div>
        </div>
      </div>
    </header>
  );
}
