export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative w-12 h-12">
        {/* Outer ring */}
        <div className="absolute inset-0 border-2 border-smoke-400/30 rounded-full" />

        {/* Spinning arc with glow */}
        <svg className="w-12 h-12 animate-spin-slow" viewBox="0 0 48 48">
          <defs>
            <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#f9d873" />
              <stop offset="100%" stopColor="#f5c638" />
            </linearGradient>
          </defs>
          <circle
            cx="24"
            cy="24"
            r="21"
            fill="none"
            stroke="url(#spinnerGradient)"
            strokeWidth="2"
            strokeDasharray="80, 200"
            strokeLinecap="round"
          />
        </svg>

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-amber-300/60 animate-pulse-slow" />
        </div>
      </div>

      <p className="mt-5 text-sm text-smoke-100 tracking-wide">{message}</p>
    </div>
  );
}
