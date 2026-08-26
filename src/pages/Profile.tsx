import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { notificationSupport, notificationsEnabled, setNotificationsEnabled } from '@/lib/reminderNotifications';
import { LogOut, Shield, Mail, Phone, Camera, Pencil, Check, X, Sun, Moon, Monitor, Cake, CalendarDays, BellRing, CalendarClock } from 'lucide-react';

const roleLabels: Record<string, string> = { ceo: 'Owner', manager: 'Manager', team_member: 'Team Member', admin: 'Owner' };

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

// Convert "yyyy-MM-dd" → { day, month, year } strings
function parseDateStr(val: string) {
  if (!val) return { day: '', month: '', year: '' };
  const [y, m, d] = val.split('-');
  return { day: String(parseInt(d, 10)), month: String(parseInt(m, 10)), year: y };
}

// Convert { day, month, year } → "yyyy-MM-dd" or ''
function buildDateStr(day: string, month: string, year: string) {
  if (!day || !month || !year) return '';
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

interface DateSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  maxYear?: number;
  minYear?: number;
}

const DateSelect = ({ label, value, onChange, maxYear, minYear }: DateSelectProps) => {
  const parsed = parseDateStr(value);
  const [day, setDay] = useState(parsed.day);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);

  useEffect(() => {
    const p = parseDateStr(value);
    setDay(p.day);
    setMonth(p.month);
    setYear(p.year);
  }, [value]);

  const currentYear = new Date().getFullYear();
  const max = maxYear ?? currentYear;
  const min = minYear ?? 1950;
  const totalDays = month && year ? daysInMonth(parseInt(month), parseInt(year)) : 31;
  const hasValue = day || month || year;

  const update = (d: string, m: string, y: string) => {
    setDay(d); setMonth(m); setYear(y);
    onChange(buildDateStr(d, m, y));
  };

  const clear = () => { setDay(''); setMonth(''); setYear(''); onChange(''); };

  const selectCls = "flex-1 h-11 rounded-xl border border-input bg-background px-3 pr-8 text-[14px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-[13px] text-muted-foreground">{label}</Label>
        {hasValue && (
          <button
            type="button"
            onClick={clear}
            className="text-[12px] text-destructive/70 hover:text-destructive font-medium flex items-center gap-1 transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <select value={day} onChange={e => update(e.target.value, month, year)} className={selectCls}>
          <option value="">Day</option>
          {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={month} onChange={e => update(day, e.target.value, year)} className={`${selectCls} flex-[1.6]`}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={i+1} value={i+1}>{m}</option>
          ))}
        </select>
        <select value={year} onChange={e => update(day, month, e.target.value)} className={`${selectCls} flex-[1.2]`}>
          <option value="">Year</option>
          {Array.from({ length: max - min + 1 }, (_, i) => max - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

const Profile = () => {
  const { profile, role, user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const nameParts = (profile?.full_name ?? '').split(' ');
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(nameParts[0] ?? '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [dob, setDob] = useState((profile as any)?.date_of_birth ?? '');
  const [doj, setDoj] = useState((profile as any)?.date_of_joining ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [pushEnabled, setPushEnabled] = useState(() => notificationsEnabled(user?.id));
  const [updatingNotifications, setUpdatingNotifications] = useState(false);

  useEffect(() => {
    setPushEnabled(notificationsEnabled(user?.id));
  }, [user?.id]);

  const toggleNotifications = async (enabled: boolean) => {
    if (!user) return;
    setUpdatingNotifications(true);
    const updated = await setNotificationsEnabled(user.id, enabled);
    setUpdatingNotifications(false);

    if (!updated) {
      toast({ title: 'Notifications could not be enabled', description: 'Allow notifications in your browser or device settings and try again.', variant: 'destructive' });
      return;
    }

    setPushEnabled(enabled);
    toast({ title: enabled ? 'Reminder notifications enabled' : 'Reminder notifications disabled', description: enabled ? 'Task and client follow-up reminders will appear up to one day before they are due.' : undefined });
  };

  const startEdit = () => {
    const parts = (profile?.full_name ?? '').split(' ');
    setFirstName(parts[0] ?? '');
    setLastName(parts.slice(1).join(' ') ?? '');
    setPhone(profile?.phone ?? '');
    setDob((profile as any)?.date_of_birth ?? '');
    setDoj((profile as any)?.date_of_joining ?? '');
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveProfile = async () => {
    if (!user || !profile) return;
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone.trim() || null, date_of_birth: dob || null, date_of_joining: doj || null } as any)
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated' });
      setEditing(false);
      window.location.reload();
    }
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 2MB allowed', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;

    await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
    setAvatarUrl(url);
    setUploading(false);
    toast({ title: 'Photo updated' });
  };

  const displayAvatar = avatarUrl || profile?.avatar_url;

  const fmtDate = (val: string | null | undefined) => {
    if (!val) return 'Not set';
    // parse as local date to avoid timezone shift
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="max-w-lg mx-auto lg:max-w-3xl animate-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-b-[2rem] px-5 pb-16 lg:pb-8 lg:rounded-2xl lg:mx-4 lg:mt-4" style={{ background: 'var(--gradient-header)', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, var(--blob-accent), transparent 70%)' }} />
        <div className="flex flex-col items-center relative">
          <div className="relative">
            {displayAvatar ? (
              <img src={displayAvatar} alt="Profile" className="h-20 w-20 rounded-[22px] object-cover shadow-lg" />
            ) : (
              <div className="h-20 w-20 rounded-[22px] bg-primary/15 flex items-center justify-center shadow-lg">
                <span className="text-3xl font-bold text-primary">{profile?.full_name?.charAt(0) ?? 'U'}</span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-md border-2 border-background"
            >
              <Camera className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>

          <h2 className="text-xl font-bold text-foreground mt-4">{profile?.full_name}</h2>
          <p className="text-[15px] text-muted-foreground mt-0.5">{user?.email}</p>
          {role && (
            <Badge className="mt-3 bg-primary/15 text-primary border-0 text-[13px] font-medium rounded-lg px-3 py-1">
              <Shield className="h-3 w-3 mr-1.5" />
              {roleLabels[role] ?? role}
            </Badge>
          )}
        </div>
      </div>

      <div className="px-4 -mt-10 lg:mt-4 space-y-4 pb-6 relative z-10">
        {/* Editable profile card */}
        <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-foreground">Personal Info</h3>
              {!editing ? (
                <Button variant="ghost" size="sm" onClick={startEdit} className="h-8 gap-1.5 text-[13px]">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              ) : (
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-8 gap-1 text-[13px] text-muted-foreground">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                  <Button size="sm" onClick={saveProfile} disabled={saving} className="h-8 gap-1 text-[13px]">
                    <Check className="h-3.5 w-3.5" /> Save
                  </Button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[13px] text-muted-foreground mb-1.5 block">First Name</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-[13px] text-muted-foreground mb-1.5 block">Last Name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                </div>
                <div>
                  <Label className="text-[13px] text-muted-foreground mb-1.5 block">Mobile Number</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="h-11 rounded-xl" />
                </div>
                <div>
                  <Label className="text-[13px] text-muted-foreground mb-1.5 block">Email</Label>
                  <Input value={user?.email ?? ''} disabled className="h-11 rounded-xl bg-muted/50" />
                </div>

                {/* Date of Birth — fast 3-dropdown picker */}
                <DateSelect
                  label="Date of Birth 🎂"
                  value={dob}
                  onChange={setDob}
                  maxYear={new Date().getFullYear() - 15}
                  minYear={1950}
                />

                {/* Date of Joining — fast 3-dropdown picker */}
                <DateSelect
                  label="Date of Joining 📅"
                  value={doj}
                  onChange={setDoj}
                  maxYear={new Date().getFullYear()}
                  minYear={2000}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-3 p-3 rounded-xl">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Email</p>
                    <p className="text-[15px] font-medium text-foreground">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Mobile</p>
                    <p className="text-[15px] font-medium text-foreground">{profile?.phone || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Cake className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Date of Birth</p>
                    <p className="text-[15px] font-medium text-foreground">{fmtDate((profile as any)?.date_of_birth)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground">Date of Joining</p>
                    <p className="text-[15px] font-medium text-foreground">{fmtDate((profile as any)?.date_of_joining)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center"><BellRing className="h-5 w-5 text-primary" /></div>
                <div><h3 className="text-[15px] font-semibold text-foreground">Push notifications</h3><p className="text-[13px] text-muted-foreground mt-1">Get task reminders and client follow-up alerts one day before they are due.</p></div>
              </div>
              <Switch checked={pushEnabled} disabled={updatingNotifications || !notificationSupport()} onCheckedChange={toggleNotifications} aria-label="Enable task and follow-up notifications" />
            </div>
            <div className="mt-4 rounded-xl bg-muted/50 px-3 py-2.5 flex items-center gap-2 text-[12px] text-muted-foreground"><CalendarClock className="h-4 w-4 shrink-0 text-primary" />{notificationSupport() ? 'Browser permission is required. Notifications also work in the installed app.' : 'Notifications are not supported by this browser.'}</div>
          </CardContent>
        </Card>

        {/* Theme Toggle */}
        <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
          <CardContent className="p-5">
            <h3 className="text-[15px] font-semibold text-foreground mb-3">Appearance</h3>
            <div className="flex gap-2">
              {([
                { value: 'light' as const, icon: Sun, label: 'Light' },
                { value: 'dark' as const, icon: Moon, label: 'Dark' },
                { value: 'system' as const, icon: Monitor, label: 'System' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all text-[13px] font-medium ${
                    theme === opt.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full h-12 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive font-medium" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Profile;
