import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const { user, loading, updatePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase exchanges the recovery link's token for a session on load;
  // give that a moment to land before deciding whether the link is valid.
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
      navigate('/', { replace: true });
    } catch (err: any) {
      toast({ title: 'Could not update password', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-2xl font-bold">Reset link expired</h1>
        <p className="text-muted-foreground max-w-sm">This password reset link is invalid or has expired. Request a new one from the sign-in screen.</p>
        <Button onClick={() => navigate('/auth')}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1.5">
          <h1 className="text-3xl font-extrabold text-primary tracking-tight uppercase">Set a new password</h1>
          <p className="text-[15px] text-muted-foreground">Choose a new password for your account.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border/40 p-6" style={{ background: 'hsl(var(--card) / 0.7)' }}>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">New password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 rounded-xl bg-secondary/50 border-border/60 px-4 pr-11 text-[15px]"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Confirm new password</label>
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="h-12 rounded-xl bg-secondary/50 border-border/60 px-4 text-[15px]"
            />
          </div>
          <Button type="submit" className="w-full h-12 rounded-xl text-[15px] font-semibold" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
