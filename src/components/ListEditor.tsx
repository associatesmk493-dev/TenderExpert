import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// A simple add/remove list of text lines (offices, parties, status updates).
export default function ListEditor({
  label,
  hint,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const rows = items.length ? items : [''];
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {hint && <span className="ml-2 text-[11px] text-muted-foreground/70">{hint}</span>}
        </div>
        <Button type="button" size="icon" variant="outline" className="h-7 w-7" title={`Add ${label.toLowerCase()}`} aria-label={`Add ${label}`} onClick={() => onChange([...rows, ''])}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((value, index) => (
          <div key={index} className="flex gap-2">
            <Input value={value} placeholder={placeholder} onChange={(e) => onChange(rows.map((entry, i) => (i === index ? e.target.value : entry)))} />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0"
              aria-label={`Remove ${label} ${index + 1}`}
              onClick={() => onChange(rows.length === 1 ? [''] : rows.filter((_, i) => i !== index))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
