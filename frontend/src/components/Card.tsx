interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  interactive?: boolean;
  glow?: boolean;
}

export default function Card({
  children,
  className = '',
  elevated = false,
  interactive = false,
  glow = false,
}: CardProps) {
  const baseClass = interactive ? 'card-interactive' : elevated ? 'card-elevated' : 'card';
  const glowClass = glow ? 'hover:shadow-glow' : '';

  return (
    <div className={`${baseClass} ${glowClass} ${className}`}>
      {children}
    </div>
  );
}
