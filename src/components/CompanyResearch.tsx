import { useEffect, useState } from 'react';
import { Microscope, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import DictateButton from '@/components/DictateButton';

export const RESEARCH_TEMPLATE = 'Net worth / turnover:\nKey information:\nProducts to pitch:\nOther research:\n';

// Free-text research about the company (net worth, key facts, what to pitch) kept on the lead for future reference.
export default function CompanyResearch({ value, onSave }: { value: string | null | undefined; onSave: (text: string) => Promise<void> | void }) {
  const [text, setText] = useState(value || '');
  const [editing, setEditing] = useState(false);
  useEffect(() => setText(value || ''), [value]);

  const save = async () => {
    await onSave(text.trim());
    setEditing(false);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-bold">
              <Microscope className="h-4 w-4" />
              Company research
            </h2>
            <p className="text-xs text-muted-foreground">Net worth, key information, products to pitch — notes for future reference</p>
          </div>
          {!editing && (
            <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => { if (!text.trim()) setText(RESEARCH_TEMPLATE); setEditing(true); }}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {value ? 'Edit' : 'Add research'}
            </Button>
          )}
        </div>

        {!editing && (value ? (
          <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm">{value}</p>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 py-5 text-center text-sm text-muted-foreground">No research added yet.</p>
        ))}

        {editing && (
          <div className="mt-3 space-y-2">
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DictateButton onText={(spoken) => setText((current) => (current ? `${current.trimEnd()} ${spoken}` : spoken))} />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => { setText(value || ''); setEditing(false); }}>Cancel</Button>
                <Button type="button" size="sm" onClick={save}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
