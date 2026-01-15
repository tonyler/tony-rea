import { useState } from 'react';
import Button from './Button';

interface CopyButtonProps {
  text: string;
  label?: string;
}

export default function CopyButton({ text, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Button variant="secondary" onClick={handleCopy} className="relative group">
      {copied ? (
        <span className="flex items-center gap-2">
          ✓ Copied!
          <svg className="w-5 h-5 text-accent-green" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          📋 {label}
        </span>
      )}
    </Button>
  );
}
