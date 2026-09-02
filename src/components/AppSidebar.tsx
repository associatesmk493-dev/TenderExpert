import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserCircle, Heart, ContactRound, WalletCards, Download, ClipboardList, Megaphone, TrendingUp, BadgeIndianRupee, Landmark, ReceiptText, Settings2 } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();

  const mainItems = [
    { title: 'Dashboard', url: '/', icon: LayoutDashboard },
    { title: 'Growth Engine', url: '/growth', icon: TrendingUp },
    { title: 'Leads', url: '/leads', icon: Users },
    { title: 'Clients', url: '/clients', icon: ContactRound },
    { title: 'Tasks & Reminders', url: '/tasks', icon: ClipboardList },
    { title: 'Collection Dashboard', url: '/collection-dashboard', icon: BadgeIndianRupee },
    { title: 'Payments', url: '/orders', icon: WalletCards },
    { title: 'Proposals', url: '/proposals', icon: ReceiptText },
    { title: 'Proposal Templates', url: '/proposal-templates', icon: ClipboardList },
    { title: 'Tender Opportunities', url: '/tenders', icon: Landmark },
    { title: 'Campaigns', url: '/campaigns', icon: Megaphone },
  ];

  const accountItems = [
    { title: 'Profile', url: '/profile', icon: UserCircle },
    { title: 'Install App', url: '/install', icon: Download },
    { title: 'Integrations', url: '/settings', icon: Settings2 },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/leads') return location.pathname.startsWith('/leads');
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarHeader className="border-b border-border/40 py-4">
        <div className="flex items-center gap-2.5 px-2">
          <img
            src="/tenderexpert-logo-hd.png"
            alt="TenderExpert"
            className="h-9 w-9 rounded-xl shrink-0 shadow-sm object-cover"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-primary truncate leading-tight uppercase">TENDEREXPERT</p>
              <p className="text-[11px] text-muted-foreground truncate">B2G Intelligence CRM</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Main</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.url)}
                      tooltip={item.title}
                      className={cn(
                        'cursor-pointer rounded-lg transition-colors',
                        active && 'bg-primary/10 text-primary font-medium hover:bg-primary/15'
                      )}
                    >
                      <item.icon className={cn('h-4 w-4', active && 'text-primary')} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Account</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {accountItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.url)}
                      tooltip={item.title}
                      className={cn(
                        'cursor-pointer rounded-lg transition-colors',
                        active && 'bg-primary/10 text-primary font-medium hover:bg-primary/15'
                      )}
                    >
                      <item.icon className={cn('h-4 w-4', active && 'text-primary')} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-3">
        {!collapsed && (
          <p className="text-[11px] text-muted-foreground text-center px-2 flex items-center justify-center gap-1">
            Made with <Heart className="h-3 w-3" style={{ fill: 'hsl(25 95% 55%)', color: 'hsl(25 95% 55%)' }} /> by Handysolver © 2026
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
