interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'yellow' | 'blue' | 'pink' | 'green';
}

export default function Card({ children, className = '', variant = 'default' }: CardProps) {
  const tapeColors = {
    default: 'bg-accent-yellow/30 border-accent-orange/50',
    yellow: 'bg-accent-yellow/40 border-accent-orange/60',
    blue: 'bg-accent-blue/30 border-accent-blue/50',
    pink: 'bg-accent-pink/30 border-accent-pink/50',
    green: 'bg-accent-green/30 border-accent-green/50',
  };

  return (
    <div className={`card ${className}`}>
      {/* Decorative tape - override default tape from CSS */}
      <div className={`absolute top-0 left-20 w-16 h-6 ${tapeColors[variant]} transform -rotate-3 rounded-sm`}
           style={{ top: '-3px' }}></div>
      {children}
    </div>
  );
}
