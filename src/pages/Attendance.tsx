import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, subDays, addDays, isToday } from 'date-fns';
import type { Profile } from '@/types/crm';

interface AttendanceRecord {
  id: string;
  user_id: string;
  check_in_time: string;
  check_out_time: string | null;
  date: string;
}

const Attendance = () => {
  const { isAdmin, user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      if (isAdmin) {
        // Admin: see all team attendance
        const [attendanceRes, profilesRes] = await Promise.all([
          supabase.from('attendance_logs').select('*').eq('date', dateStr).order('check_in_time', { ascending: true }),
          supabase.from('profiles').select('*'),
        ]);
        if (attendanceRes.data) setRecords(attendanceRes.data as unknown as AttendanceRecord[]);
        if (profilesRes.data) setProfiles(profilesRes.data as unknown as Profile[]);
      } else {
        // Team member: see only own attendance
        const attendanceRes = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('date', dateStr)
          .eq('user_id', user?.id ?? '')
          .order('check_in_time', { ascending: true });
        if (attendanceRes.data) setRecords(attendanceRes.data as unknown as AttendanceRecord[]);
        setProfiles([]);
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedDate, isAdmin, user?.id]);

  const checkedInUserIds = new Set(records.map((r) => r.user_id));
  const presentCount = checkedInUserIds.size;
  const absentCount = profiles.length - presentCount;

  const goBack = () => setSelectedDate((d) => subDays(d, 1));
  const goForward = () => {
    if (!isToday(selectedDate)) setSelectedDate((d) => addDays(d, 1));
  };

  // Team member's own record for the selected date
  const myRecord = records.find((r) => r.user_id === user?.id);

  const isLate = (checkIn: string) => {
    const d = new Date(checkIn);
    const minutes = d.getHours() * 60 + d.getMinutes();
    return minutes > 9 * 60 + 59; // after 9:59 AM
  };

  return (
    <div className="max-w-lg mx-auto lg:max-w-6xl animate-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-b-[2rem] px-5 pb-10 lg:pb-6 lg:rounded-2xl lg:mx-4 lg:mt-4" style={{ background: 'var(--gradient-header)', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, var(--blob-accent), transparent 70%)' }} />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/15 flex items-center justify-center border border-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Attendance</h1>
            <p className="text-muted-foreground text-[13px]">
              {isAdmin ? 'Team check-in records' : 'Your check-in history'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-5 lg:mt-4 space-y-4 pb-6 relative z-10">
        {/* Date Selector */}
        <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={goBack}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <p className="text-[15px] font-semibold text-foreground">
                  {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE')}
                </p>
                <p className="text-[13px] text-muted-foreground">{format(selectedDate, 'dd MMM yyyy')}</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={goForward} disabled={isToday(selectedDate)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {isAdmin ? (
          <>
            {/* Summary - Admin only */}
            <div className="grid grid-cols-2 gap-2.5">
              <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
                <CardContent className="p-4 text-center">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-foreground tracking-tight">{presentCount}</p>
                  <p className="text-[13px] text-muted-foreground font-medium">Present</p>
                </CardContent>
              </Card>
              <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
                <CardContent className="p-4 text-center">
                  <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <p className="text-2xl font-bold text-foreground tracking-tight">{absentCount}</p>
                  <p className="text-[13px] text-muted-foreground font-medium">Absent</p>
                </CardContent>
              </Card>
            </div>

            {/* Team List - Admin only */}
            <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-foreground">Team Members</h3>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-8 w-8 rounded-xl border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profiles.map((p) => {
                      const record = records.find((r) => r.user_id === p.user_id);
                      const isPresent = !!record;
                      return (
                        <div key={p.id} className="flex items-center justify-between p-3.5 bg-muted/40 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-[15px] font-bold ${isPresent ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {p.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold text-foreground">{p.full_name}</p>
                              {isPresent && record ? (
                                <p className="text-[13px] text-primary font-medium">
                                  ✅ {format(new Date(record.check_in_time), 'hh:mm a')}
                                  {record.check_out_time && ` → ${format(new Date(record.check_out_time), 'hh:mm a')}`}
                                </p>
                              ) : (
                                <p className="text-[13px] text-muted-foreground">Not checked in</p>
                              )}
                            </div>
                          </div>
                          <Badge className={`border-0 rounded-lg text-[11px] font-semibold ${isPresent ? (record && isLate(record.check_in_time) ? 'bg-amber-500/15 text-amber-600' : 'bg-primary/10 text-primary') : 'bg-destructive/10 text-destructive'}`}>
                            {isPresent ? (record && isLate(record.check_in_time) ? 'Late' : 'Present') : 'Absent'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          /* Team Member View - Own attendance only */
          <Card className="border border-border/20 rounded-2xl bg-card/60 glass-subtle">
            <CardContent className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 rounded-xl border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : myRecord ? (
                <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-xl">
                  <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[16px] font-semibold text-foreground">
                        {myRecord.check_out_time ? "Day complete 🎉" : "You're checked in!"}
                      </p>
                      {isLate(myRecord.check_in_time) && (
                        <Badge className="border-0 rounded-md text-[10px] font-semibold bg-destructive/10 text-destructive px-1.5 py-0">Late</Badge>
                      )}
                    </div>
                    <p className="text-[14px] text-primary font-medium">
                      In: {format(new Date(myRecord.check_in_time), 'hh:mm a')}
                      {myRecord.check_out_time && ` · Out: ${format(new Date(myRecord.check_out_time), 'hh:mm a')}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold text-foreground">Not checked in</p>
                    <p className="text-[14px] text-muted-foreground">
                      {isToday(selectedDate) ? 'Check in from the Dashboard' : 'No record for this day'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Attendance;
