import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Landmark, FileText, Search, Building2, BriefcaseBusiness, Presentation, ClipboardCheck, Target, Eye, EyeOff, Sparkles, Heart } from 'lucide-react';

const FloatingIcon = ({ Icon, style, className }: { Icon: React.ComponentType<any>; style: React.CSSProperties; className?: string }) => (
  <div className={`absolute opacity-[0.07] ${className}`} style={style}>
    <Icon className="text-primary" style={{ width: '100%', height: '100%' }} strokeWidth={1.2} />
  </div>
);

const Auth = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [mode, setMode] = useState<'credentials' | 'forgot' | 'sent'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        await resetPassword(email);
        setMode('sent');
      } else if (isLogin) {
        await signIn(email, password);
        toast({ title: 'Welcome back!' });
      } else {
        await signUp(email, password, fullName);
        toast({ title: 'Account created!', description: 'Please check your email to verify.' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const floatingIcons = [
    { Icon: Landmark, width: 64, top: '8%', left: '5%', animation: 'float 9s ease-in-out infinite', rotate: '-15deg' },
    { Icon: FileText, width: 48, top: '15%', right: '8%', animation: 'float 11s ease-in-out infinite 1s', rotate: '10deg' },
    { Icon: Search, width: 80, top: '35%', left: '-2%', animation: 'float 13s ease-in-out infinite 2s', rotate: '-5deg' },
    { Icon: Building2, width: 56, top: '55%', right: '3%', animation: 'float 10s ease-in-out infinite 0.5s', rotate: '20deg' },
    { Icon: BriefcaseBusiness, width: 72, bottom: '20%', left: '10%', animation: 'float 12s ease-in-out infinite 3s', rotate: '-25deg' },
    { Icon: Presentation, width: 44, bottom: '12%', right: '12%', animation: 'float 8s ease-in-out infinite 1.5s', rotate: '15deg' },
    { Icon: ClipboardCheck, width: 52, top: '70%', left: '40%', animation: 'float 14s ease-in-out infinite 4s', rotate: '-10deg' },
    { Icon: Target, width: 40, top: '5%', left: '55%', animation: 'float 10s ease-in-out infinite 2.5s', rotate: '25deg' },
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-6 overflow-hidden bg-background">

      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-25 blur-[120px] animate-[blob_18s_ease-in-out_infinite]"
          style={{ background: 'hsl(var(--primary))' }}
        />
        <div
          className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] animate-[blob_22s_ease-in-out_infinite_2s]"
          style={{ background: 'hsl(25 95% 55%)' }}
        />
        <div
          className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] rounded-full opacity-15 blur-[100px] animate-[blob_20s_ease-in-out_infinite_4s]"
          style={{ background: 'hsl(var(--primary))' }}
        />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Shimmer line */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-40"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 50%, transparent 100%)',
        }}
      />

      {/* Floating B2G and tender icons */}
      <div className="absolute inset-0 overflow-hidden">
        {floatingIcons.map((item, i) => {
          const { Icon, width, rotate, animation, ...pos } = item;
          return (
            <FloatingIcon
              key={i}
              Icon={Icon}
              style={{
                ...pos,
                width,
                height: width,
                transform: `rotate(${rotate})`,
                animation,
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3 animate-in">
          <div className="relative mx-auto">
            <div className="absolute inset-0 mx-auto h-20 w-20 rounded-[22px] blur-xl opacity-30 animate-[pulse-soft_3s_ease-in-out_infinite]"
              style={{ background: 'hsl(var(--primary))', top: '-2px', left: '50%', transform: 'translateX(-50%)' }} />
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-[22px] shadow-2xl border border-border/40 overflow-hidden">
              <img src="/tenderexpert-logo-hd.png" alt="TenderExpert" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight uppercase">TENDEREXPERT</h1>
            <p className="text-[15px] text-muted-foreground">
              {mode === 'forgot'
                ? 'Enter your email and we will send you a password reset link.'
                : mode === 'sent'
                ? 'Check your inbox for the reset link.'
                : isLogin ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
            </p>
          </div>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-border/40 p-6 animate-in-delay"
          style={{
            background: 'hsl(var(--card) / 0.7)',
            backdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: 'var(--shadow-card)',
          }}>
          {mode === 'sent' ? (
            <div className="space-y-5 text-center">
              <p className="text-[15px] text-muted-foreground">
                We've sent a password reset link to <span className="font-semibold text-foreground">{email}</span>. Open it on this device to set a new password.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl text-[15px] font-semibold"
                onClick={() => { setMode('credentials'); setIsLogin(true); }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'credentials' && !isLogin && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">First Name</label>
                  <Input
                    placeholder="First name"
                    value={fullName.split(' ')[0] ?? ''}
                    onChange={(e) => {
                      const last = fullName.split(' ').slice(1).join(' ');
                      setFullName(`${e.target.value} ${last}`.trim());
                    }}
                    required
                    className="h-12 rounded-xl bg-secondary/50 border-border/60 px-4 text-[15px] focus-visible:ring-primary/40 transition-all duration-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Last Name</label>
                  <Input
                    placeholder="Last name"
                    value={fullName.split(' ').slice(1).join(' ')}
                    onChange={(e) => {
                      const first = fullName.split(' ')[0] ?? '';
                      setFullName(`${first} ${e.target.value}`.trim());
                    }}
                    className="h-12 rounded-xl bg-secondary/50 border-border/60 px-4 text-[15px] focus-visible:ring-primary/40 transition-all duration-300"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl bg-secondary/50 border-border/60 px-4 text-[15px] focus-visible:ring-primary/40 transition-all duration-300"
              />
            </div>
            {mode === 'credentials' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Password</label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[13px] font-semibold text-primary hover:underline underline-offset-2"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 rounded-xl bg-secondary/50 border-border/60 px-4 pr-11 text-[15px] focus-visible:ring-primary/40 transition-all duration-300"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] border-0"
              disabled={submitting}
              style={{ background: 'var(--gradient-primary)' }}
            >
              {submitting ? (
                <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : mode === 'forgot' ? (
                'Send reset link'
              ) : (
                <span className="flex items-center gap-2">
                  {isLogin ? 'Sign In' : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Create Account
                    </>
                  )}
                </span>
              )}
            </Button>
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => setMode('credentials')}
                className="w-full text-center text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            )}
          </form>
          )}
        </div>

        {mode === 'credentials' && (
        <p className="text-center text-[15px] text-muted-foreground animate-in-delay">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-semibold hover:underline underline-offset-2 transition-colors">
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
        )}

        <div className="mx-auto w-24 h-px opacity-20" style={{ background: 'var(--gradient-primary)' }} />

        <p className="text-[12px] text-muted-foreground text-center flex items-center justify-center gap-1 animate-in-delay">
          Made with <Heart className="h-3 w-3" style={{ fill: 'hsl(25 95% 55%)', color: 'hsl(25 95% 55%)' }} /> by Handysolver © 2026
        </p>
      </div>
    </div>
  );
};

export default Auth;
