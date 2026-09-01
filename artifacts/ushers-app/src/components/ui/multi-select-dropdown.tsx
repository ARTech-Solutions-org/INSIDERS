import React, { useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export function MultiSelectDropdown({
  options,
  value = [],
  onChange,
  placeholder = "Select...",
  allowCustom = false,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const [customInput, setCustomInput] = useState('');

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setCustomInput('');
  };

  const removeTag = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== tag));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex flex-wrap gap-2 items-center justify-between bg-background border border-input rounded-xl p-3 min-h-[56px] hover:border-ring focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-colors cursor-pointer w-full">
          <div className="flex flex-wrap gap-1 items-center flex-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground text-sm pl-1">{placeholder}</span>
            ) : (
              value.map(tag => (
                <Badge key={tag} variant="secondary" className="px-2 py-1 font-medium text-xs flex items-center gap-1">
                  {tag}
                  <span
                    className="ml-1 cursor-pointer hover:opacity-70"
                    onClick={(e) => removeTag(tag, e)}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <X className="w-3 h-3" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] bg-popover max-h-72 overflow-y-auto">
        {/* Custom language input */}
        {allowCustom && (
          <div className="flex items-center gap-1 px-2 py-2 border-b border-border">
            <input
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Type a language..."
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            />
            <button
              className="flex items-center justify-center w-6 h-6 rounded-md bg-primary text-primary-foreground hover:bg-primary/80 transition-colors shrink-0"
              onClick={e => { e.stopPropagation(); addCustom(); }}
              onPointerDown={e => e.stopPropagation()}
              type="button"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {options.map(opt => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={value.includes(opt)}
            onCheckedChange={(checked) => {
              if (checked) {
                onChange([...value, opt]);
              } else {
                onChange(value.filter(s => s !== opt));
              }
            }}
          >
            {opt}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
