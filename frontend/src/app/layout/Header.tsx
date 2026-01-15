export default function Header() {
  return (
    <header className="bg-paper-50 border-b-2 border-ink-100 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-4">
            <h1 className="text-5xl font-hand font-bold text-ink-200 sketch-underline">
              Tony & Rea
            </h1>
            <svg className="w-12 h-12 text-accent-yellow transform rotate-12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
          <p className="text-lg font-hand text-ink-100 transform -rotate-2">
            Your creative workspace ✨
          </p>
        </div>
      </div>

      {/* Decorative tape */}
      <div className="absolute top-2 right-20 w-16 h-6 bg-accent-yellow/30 transform rotate-45 border border-accent-orange/50"></div>
    </header>
  );
}
