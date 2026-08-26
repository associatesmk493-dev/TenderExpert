import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { Profile, AppRole, Showroom } from '@/types/crm';
import { Users, Shield, Plus, Building2, Trash2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const roleLabels: Record<string, string> = { ceo: 'CEO', manager: 'Manager', team_member: 'Team Member', admin: 'Admin' };

interface TeamMember extends Profile {
  role?: AppRole;
  showroom_name?: string;
}

const TeamManagement = () => {
  const { isAdmin, isViewOnly, user, role } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showrooms, setShowrooms] = useState<Showroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showroomName, setShowroomName] = useState('');
  const [showroomCity, setShowroomCity] = useState('');
  const [showAddShowroom, setShowAddShowroom] = useState(false);
  const fetchData = async () => {
    const [profilesRes, rolesRes, showroomsRes, membershipsRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
      supabase.from('showrooms').select('*'),
      supabase.from('showroom_members').select('*'),
    ]);

    const profiles = (profilesRes.data ?? []) as unknown as Profile[];
    const roles = (rolesRes.data ?? []) as unknown as { user_id: string; role: AppRole }[];
    const srooms = (showroomsRes.data ?? []) as unknown as Showroom[];
    const memberships = (membershipsRes.data ?? []) as unknown as { user_id: string; showroom_id: string }[];

    const enriched: TeamMember[] = profiles.map((p) => {
      const userRole = roles.find((r) => r.user_id === p.user_id);
      const membership = memberships.find((m) => m.user_id === p.user_id);
      const showroom = membership ? srooms.find((s) => s.id === membership.showroom_id) : undefined;
      return { ...p, role: userRole?.role, showroom_name: showroom?.name };
    });

    setMembers(enriched);
    setShowrooms(srooms);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  if (role && !isAdmin) return <Navigate to="/" replace />;

  const assignRole = async (userId: string, role: AppRole) => {
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('user_roles').insert({ user_id: userId, role } as any);
    toast({ title: `Role updated to ${roleLabels[role]}` });
    fetchData();
  };

  const assignShowroom = async (userId: string, showroomId: string) => {
    await supabase.from('showroom_members').delete().eq('user_id', userId);
    if (showroomId !== 'none') {
      await supabase.from('showroom_members').insert({ user_id: userId, showroom_id: showroomId } as any);
    }
    toast({ title: 'Location updated' });
    fetchData();
  };

  const addShowroom = async () => {
    if (!showroomName.trim()) return;
    const { error } = await supabase.from('showrooms').insert({ name: showroomName.trim(), city: showroomCity.trim() || null } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setShowroomName(''); setShowroomCity(''); setShowAddShowroom(false);
    toast({ title: 'Location added!' }); fetchData();
  };

  const deleteShowroom = async (id: string) => {
    await supabase.from('showrooms').delete().eq('id', id);
    toast({ title: 'Location removed' }); fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-10 w-10 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto lg:max-w-6xl animate-in">
      {/* Header */}
      <div
        className="relative rounded-b-[2rem] px-4 pb-6 lg:rounded-2xl lg:mx-4 lg:mt-4"
        style={{ background: 'var(--gradient-header)', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.75rem)' }}
      >
        <div className="absolute inset-0 rounded-b-[2rem] lg:rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, var(--blob-accent), transparent 70%)' }} />
        </div>
        <div className="relative">
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="text-muted-foreground text-[14px] mt-0.5">
            {members.length} members · {showrooms.length} locations
          </p>
        </div>
      </div>

      <div className="px-3 sm:px-4 mt-4 space-y-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}>
        <div className="space-y-4">
            {/* Showrooms */}
            <Card className="shadow-card border-0 rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-booking)' }}>
                      <Building2 className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-foreground">Locations</h3>
                  </div>
                  {!isViewOnly && (
                    <Dialog open={showAddShowroom} onOpenChange={setShowAddShowroom}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="rounded-xl h-8 gap-1 text-[13px]" style={{ background: 'var(--gradient-primary)' }}>
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-2xl sm:max-w-[480px] p-0 overflow-hidden">
                        <div className="px-6 pt-6 pb-4 border-b border-border/40" style={{ background: 'var(--gradient-header)' }}>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-booking)' }}>
                              <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <DialogHeader className="text-left space-y-0.5">
                              <DialogTitle className="text-[17px] font-semibold">Add New Location</DialogTitle>
                              <p className="text-[13px] text-muted-foreground">Create a new location for your team</p>
                            </DialogHeader>
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[12px] font-medium text-foreground uppercase tracking-wider">Location Name <span className="text-destructive">*</span></label>
                            <Input placeholder="e.g. TenderExpert Delhi Team" value={showroomName} onChange={(e) => setShowroomName(e.target.value)} className="h-11 rounded-xl" autoFocus />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[12px] font-medium text-foreground uppercase tracking-wider">City</label>
                            <Input placeholder="e.g. Mumbai" value={showroomCity} onChange={(e) => setShowroomCity(e.target.value)} className="h-11 rounded-xl" />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button variant="outline" onClick={() => setShowAddShowroom(false)} className="flex-1 h-11 rounded-xl">Cancel</Button>
                            <Button onClick={addShowroom} className="flex-1 h-11 rounded-xl text-white" style={{ background: 'var(--gradient-primary)' }} disabled={!showroomName.trim()}>Add Location</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                {showrooms.length === 0 ? (
                  <p className="text-[15px] text-muted-foreground text-center py-4">No locations yet</p>
                ) : (
                  <div className="space-y-2">
                    {showrooms.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3.5 bg-muted/50 rounded-xl">
                        <div>
                          <p className="font-medium text-[15px] text-foreground">{s.name}</p>
                          {s.city && <p className="text-[13px] text-muted-foreground">{s.city}</p>}
                        </div>
                        {!isViewOnly && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete location?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{s.name}". Team members assigned to this location will be unassigned. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteShowroom(s.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card className="shadow-card border-0 rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-calling)' }}>
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-foreground">Team ({members.length})</h3>
                </div>
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="bg-muted/30 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-[15px] font-bold text-primary">
                          {member.full_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-[15px] text-foreground">{member.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {member.role && (
                              <Badge className="text-[11px] rounded-md bg-primary/10 text-primary border-0 font-medium">
                                <Shield className="h-2.5 w-2.5 mr-1" />{roleLabels[member.role]}
                              </Badge>
                            )}
                            {member.showroom_name && (
                              <span className="text-[11px] text-muted-foreground">📍 {member.showroom_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {!isViewOnly && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wider">Role</p>
                            <Select value={member.role ?? ''} onValueChange={(v) => assignRole(member.user_id, v as AppRole)}>
                              <SelectTrigger className="h-9 text-[13px] rounded-xl border-border/60"><SelectValue placeholder="Assign" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ceo">CEO</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="team_member">Team Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wider">Location</p>
                            <Select
                              value={showrooms.find((s) => s.name === member.showroom_name)?.id ?? 'none'}
                              onValueChange={(v) => assignShowroom(member.user_id, v)}
                            >
                              <SelectTrigger className="h-9 text-[13px] rounded-xl border-border/60"><SelectValue placeholder="Assign" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {showrooms.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
};

export default TeamManagement;
