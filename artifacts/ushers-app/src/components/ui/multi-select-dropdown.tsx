import React from 'react';
import { ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export function MultiSelectDropdown({ options, value = [], onChange, placeholder = "Select..." }: { options: string[], value: string[], onChange: (v: string[]) => void, placeholder?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex flex-wrap gap-2 items-center justify-between bg-primary-foreground/5 border border-primary-foreground/20 rounded-xl p-3 min-h-[56px] focus-within:border-primary-foreground focus-within:ring-1 focus-within:ring-primary-foreground transition-colors cursor-pointer w-full">
          <div className="flex flex-wrap gap-1 items-center flex-1">
            {value.length === 0 ? (
              <span className="text-primary-foreground/50 text-sm pl-1">{placeholder}</span>
            ) : (
              value.map(tag => (
                <Badge key={tag} variant="secondary" className="bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 px-2 py-1 font-medium text-xs">
                  {tag}
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-primary-foreground/50 shrink-0" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] bg-popover max-h-60 overflow-y-auto">
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
