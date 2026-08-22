import { useState } from 'react';
import { X, Plus } from 'lucide-react';

const DEFAULT_SUGGESTIONS = [
  'Hardwood Floors',
  'Renovated Kitchen',
  'Backyard',
  'Garage',
  'Swimming Pool',
  'Move-in Ready',
  'Open Floor Plan',
  'Natural Light',
  'Fireplace',
  'Walk-in Closet',
];

export default function TagInput({
  tags,
  onChange,
  placeholder = 'Type a tag and press Enter',
  suggestions = DEFAULT_SUGGESTIONS,
}) {
  const [input, setInput] = useState('');

  const addTag = (value) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
  };

  const removeTag = (tag) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const submitInput = () => {
    addTag(input);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitInput();
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const availableSuggestions = suggestions.filter((s) => !tags.includes(s));

  return (
    <div className="space-y-2.5">
      <div className="border border-border/60 rounded-xl p-3 min-h-[48px] flex flex-wrap items-center gap-1.5 focus-within:border-primary/50 transition-colors">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-secondary text-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={submitInput}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
      {availableSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-0.5">Quick add:</span>
          {availableSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
            >
              <Plus className="w-3 h-3" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}