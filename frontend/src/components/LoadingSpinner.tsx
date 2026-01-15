export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 animate-spin text-accent-orange" viewBox="0 0 50 50">
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray="80, 200"
            strokeLinecap="round"
          />
        </svg>
        <svg className="absolute inset-0 w-16 h-16 text-accent-yellow transform rotate-45" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" opacity="0.5" />
        </svg>
      </div>
      <p className="mt-4 font-hand text-xl text-ink-100 transform -rotate-1">{message}</p>
      <svg className="mt-2 w-24 h-2" viewBox="0 0 100 10">
        <path d="M 0,5 Q 25,0 50,5 T 100,5" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-blue" />
      </svg>
    </div>
  );
}
