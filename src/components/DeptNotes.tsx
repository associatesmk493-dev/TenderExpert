/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import DictateButton from '@/components/DictateButton';

export type DeptNote = { at: string; stage: string; text: string; by: string };

const STEPS = ['Requested', 'Documents submitted', 'Feedback received', 'Changes made', 'Resubmitted', 'Approved', 'Other'];

export const toDeptNotes = (value: any): DeptNote[] =>
  Array.isArray(value) ? value.map((n: any) => ({ at: n.at || '', stage: n.stage || 'Other', text: n.text || '', by: n.by || '' })) : [];

// Running log of what happens with the department: we request, submit documents, they give feedback, we change, and so on.
export default function DeptNotes({ notes, onChange, author }: { notes: DeptNote[]; onChange: (notes: DeptNote[]) => void; author: string }) {
  const [stage, setStage] = useState(STEPS[0]);
  const [text, setText] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const add = () => {
    if (!text.trim()) return;
    onChange([...notes, { at: new Date(`${date || new Date().toISOString().slice(0, 10)}T10:00:00`).toISOString(), stage, text: text.trim(), by: author }]);
    setText('');
    setDate(new Date().toISOString().slice(0, 10));
  };
  const ordered = notes.map((note, index) => ({ note, index })).sort((a, b) => b.note.at.localeCompare(a.note.at));

  return (
    <div>
      <h3 className="font-bold">Department follow-up notes</h3>
      <p className="mb-3 text-xs text-muted-foreground">Stage-wise record of what we asked, what we submitted, what feedback the department gave and what we changed</p>
      <div className="rounded-xl bg-slate-50 p-3">
        <div className="grid gap-2 sm:grid-cols-[200px_160px]">
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>{STEPS.map((step) => <SelectItem key={step} value={step}>{step}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" className="bg-white" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Textarea className="mt-2 bg-white" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Sent revised BOQ; AE asked to change the blower make" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <DictateButton onText={(spoken) => setText((current) => (current ? `${current.trimEnd()} ${spoken}` : spoken))} />
          <Button type="button" size="sm" disabled={!text.trim()} onClick={add}>
            <Plus className="mr-1 h-4 w-4" />
            Add note
          </Button>
        </div>
      </div>
      {ordered.length > 0 && (
        <ul className="mt-3 space-y-2">
          {ordered.map(({ note, index }) => (
            <li key={index} className="flex gap-2 rounded-xl border bg-white p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{note.stage}</span> · {note.at ? new Date(note.at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : ''}
                  {note.by ? ` · ${note.by}` : ''}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{note.text}</p>
              </div>
              <Button type="button" size="icon" variant="ghost" className="shrink-0" aria-label="Delete note" onClick={() => onChange(notes.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
