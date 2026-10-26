/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Contact = { name: string; designation: string; phone: string; email: string; note: string };
const blank = (): Contact => ({ name: '', designation: '', phone: '', email: '', note: '' });
const toContacts = (value: any): Contact[] =>
  Array.isArray(value) ? value.map((c: any) => ({ name: c.name || '', designation: c.designation || '', phone: c.phone || '', email: c.email || '', note: c.note || '' })) : [];

// The people we deal with inside a company (up to several levels): name, designation and how to reach them.
export default function LeadContacts({ contacts, onSave }: { contacts: any; onSave: (contacts: Contact[]) => Promise<void> | void }) {
  const [rows, setRows] = useState<Contact[]>(toContacts(contacts));
  const [editing, setEditing] = useState(false);
  useEffect(() => setRows(toContacts(contacts)), [contacts]);

  const set = (index: number, patch: Partial<Contact>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const save = async () => {
    await onSave(rows.filter((row) => Object.values(row).some((value) => value.trim())).map((row) => ({ ...row, name: row.name.trim(), designation: row.designation.trim() })));
    setEditing(false);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-bold"><UsersRound className="h-4 w-4" />People in this company</h2>
            <p className="text-xs text-muted-foreground">Everyone we deal with, by designation — from the first contact up to the decision-maker</p>
          </div>
          {!editing && (
            <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => { if (!rows.length) setRows([blank()]); setEditing(true); }}>
              {rows.length ? <Pencil className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
              {rows.length ? 'Edit' : 'Add people'}
            </Button>
          )}
        </div>

        {!editing && !rows.length && <p className="rounded-xl bg-slate-50 py-5 text-center text-sm text-muted-foreground">No other contacts added yet.</p>}
        {!editing && rows.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map((row, index) => (
              <div key={index} className="min-w-0 rounded-xl border bg-white p-3 text-sm">
                <p className="truncate font-semibold">{row.name || 'Unnamed'}</p>
                {row.designation && <p className="truncate text-xs text-muted-foreground">{row.designation}</p>}
                <p className="mt-1 break-words text-xs">{[row.phone, row.email].filter(Boolean).join(' · ')}</p>
                {row.note && <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>}
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={index} className="rounded-xl border bg-white p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={row.name} placeholder="Name" onChange={(e) => set(index, { name: e.target.value })} />
                  <Input value={row.designation} placeholder="Designation, e.g. Branch Head / Director" onChange={(e) => set(index, { designation: e.target.value })} />
                  <Input type="tel" value={row.phone} placeholder="Phone" onChange={(e) => set(index, { phone: e.target.value })} />
                  <Input type="email" value={row.email} placeholder="Email" onChange={(e) => set(index, { email: e.target.value })} />
                </div>
                <div className="mt-2 flex gap-2">
                  <Input className="h-9 text-xs" value={row.note} placeholder="Note, e.g. approves orders above ₹5 L" onChange={(e) => set(index, { note: e.target.value })} />
                  <Button type="button" size="icon" variant="ghost" aria-label={`Remove person ${index + 1}`} onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setRows((current) => [...current, blank()])}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add another person
              </Button>
              <Button type="button" size="sm" onClick={save}>Save</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setRows(toContacts(contacts)); setEditing(false); }}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
