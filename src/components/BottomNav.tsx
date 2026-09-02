import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, UserCircle, MoreHorizontal, ContactRound, WalletCards, Download, ClipboardList, Megaphone, BadgeIndianRupee, TrendingUp, Landmark, ReceiptText, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const leftItems = [
    { path: '/', icon: LayoutDashboard, label: 'Home' },
    { path: '/leads', icon: Users, label: 'Leads' },
  ];

  const rightItems = [
    { path: '/clients', icon: ContactRound, label: 'Clients' },
    { path: '/orders', icon: WalletCards, label: 'Payments' },
  ];

  const moreItems = [
    { path: '/tasks', icon: ClipboardList, label: 'Tasks' },
    { path: '/collection-dashboard', icon: BadgeIndianRupee, label: 'Collections' },
    { path: '/growth', icon: TrendingUp, label: 'Growth Engine' },
    { path: '/proposals', icon: ReceiptText, label: 'Proposals' },
    { path: '/proposal-templates', icon: ClipboardList, label: 'Templates' },
    { path: '/tenders', icon: Landmark, label: 'Tenders' },
    { path: '/campaigns', icon: Megaphone, label: 'Campaigns' },
    { path: '/settings', icon: Settings2, label: 'Integrations' },
    { path: '/profile', icon: UserCircle, label: 'Profile' },
    { path: '/install', icon: Download, label: 'Install App' },
  ];

  const NAV_ITEMS = [...leftItems, ...rightItems];
  const moreActive = moreItems.some((i) => location.pathname.startsWith(i.path));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-2 mb-2 sm:mx-3 sm:mb-3">
        <div className="glass rounded-[20px] shadow-nav border border-border/20 bg-card/50" style={{ backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)' }}>
          <div className="flex h-[64px] max-w-lg items-center justify-between gap-0 mx-auto px-0.5 sm:px-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path === '/leads' && location.pathname.startsWith('/leads')) ||
        (item.path === '/attendance' && location.pathname.startsWith('/attendance')) ||
        (item.path === '/orders' && location.pathname.startsWith('/orders')) ||
        (item.path === '/clients' && location.pathname.startsWith('/clients'));
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1.5 transition-all duration-300',
                    isActive && 'text-primary',
                    !isActive && 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <div className={cn(
                    'h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-300',
                    isActive && 'bg-primary/12'
                  )}>
                    <item.icon className={cn(
                      'h-[18px] w-[18px] transition-all duration-300',
                      isActive && 'scale-110'
                    )} />
                  </div>
                  <span className={cn(
                    'max-w-full truncate text-[9px] sm:text-[10px] font-medium transition-all duration-300 leading-tight',
                    isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}

            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1.5 transition-all duration-300',
                    moreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <div className={cn(
                    'h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-300',
                    moreActive && 'bg-primary/12'
                  )}>
                    <MoreHorizontal className={cn('h-[18px] w-[18px]', moreActive && 'scale-110')} />
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium leading-tight',
                    moreActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}>More</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>More</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-3 mt-4 pb-4">
                  {moreItems.map((item) => {
                    const active = location.pathname.startsWith(item.path);
                    return (
                      <button
                        key={item.path}
                        onClick={() => { setMoreOpen(false); navigate(item.path); }}
                        className={cn(
                          'flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-border/30 bg-muted/40 transition-colors',
                          active && 'bg-primary/10 border-primary/30 text-primary'
                        )}
                      >
                        <item.icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
