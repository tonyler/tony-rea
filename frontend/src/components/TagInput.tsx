import { useState, useRef, useEffect } from 'react';

interface TagInputProps {
  availableTags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TagInput({
  availableTags,
  selectedTags,
  onChange,
  disabled = false,
  placeholder = 'Search or add tags...',
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredTags = availableTags.filter(
    (tag) =>
      tag.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedTags.some((s) => s.toLowerCase() === tag.toLowerCase())
  );

  const handleAddTag = (tag: string) => {
    if (!selectedTags.some((s) => s.toLowerCase() === tag.toLowerCase())) {
      onChange([...selectedTags, tag]);
    }
    setInputValue('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tag: string) => {
    onChange(selectedTags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      // If there's an exact match in filtered, use it
      const exactMatch = filteredTags.find(
        (t) => t.toLowerCase() === inputValue.toLowerCase()
      );
      if (exactMatch) {
        handleAddTag(exactMatch);
      } else if (inputValue.trim()) {
        // Add as new tag
        handleAddTag(inputValue.trim());
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      handleRemoveTag(selectedTags[selectedTags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex flex-wrap gap-2 p-2 bg-void-300/50 border border-smoke-400/30 rounded-lg min-h-[42px] cursor-text ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-400/20 text-amber-300 text-sm rounded-md"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag);
                }}
                className="hover:text-amber-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={selectedTags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-cream-100 text-sm placeholder:text-smoke-200"
        />
      </div>

      {showDropdown && (inputValue || filteredTags.length > 0) && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-void-300 border border-smoke-400/30 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredTags.length > 0 ? (
            filteredTags.slice(0, 20).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddTag(tag)}
                className="w-full text-left px-3 py-2 text-sm text-cream-100 hover:bg-amber-400/10 transition-colors"
              >
                {tag}
              </button>
            ))
          ) : inputValue.trim() ? (
            <button
              type="button"
              onClick={() => handleAddTag(inputValue.trim())}
              className="w-full text-left px-3 py-2 text-sm text-amber-300 hover:bg-amber-400/10 transition-colors"
            >
              Add "{inputValue.trim()}" as new tag
            </button>
          ) : null}
        </div>
      )}

      <p className="mt-1 text-xs text-smoke-200">
        Type to search existing tags or add new ones. Press Enter to add.
      </p>
    </div>
  );
}
