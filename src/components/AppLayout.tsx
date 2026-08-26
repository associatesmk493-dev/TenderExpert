import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from './BottomNav';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { NotificationBell } from './NotificationBell';
import TenderExpertAssistant from './TenderExpertAssistant';

const AppLayout = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="relative">
          <div className="h-12 w-12 rounded-2xl bg-primary/20 animate-pulse" />
          <div className="absolute inset-0 h-12 w-12 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Mobile / tablet: bottom nav + fixed notification bell
  if (isMobile) {
    return (
      <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-background pb-28">
        {/* Fixed notification bell — sits in the safe-area strip above page content */}
        <div
          className="fixed right-3 z-50"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}
        >
          <NotificationBell iconClassName="text-foreground/80" />
        </div>
        <main className="min-w-0 w-full"><Outlet /></main>
        {location.pathname !== '/assistant' && <TenderExpertAssistant />}
        <BottomNav />
      </div>
    );
  }

  // Desktop: sidebar
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-30">
            <SidebarTrigger className="ml-2" />
            <div className="mr-3">
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
            <Outlet />
          </main>
          {location.pathname !== '/assistant' && <TenderExpertAssistant />}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
