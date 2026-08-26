import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AppLayout from "@/components/AppLayout";

// Auth + Dashboard load eagerly (first screens user sees)
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";

// Wraps lazy() to auto-reload once on chunk load failure (stale deployment cache)
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch(() => {
      // Chunk hash changed after a new deploy — hard reload to get fresh assets
      window.location.reload();
      return new Promise<never>(() => {});
    })
  );
}

// Everything else loads only when navigated to
const Leads        = lazyWithRetry(() => import("@/pages/Leads"));
const LeadDetail   = lazyWithRetry(() => import("@/pages/LeadDetail"));
const ClientProfile = lazyWithRetry(() => import("@/pages/ClientProfile"));
const ClientsView   = lazyWithRetry(() => import("@/pages/ClientsView"));
const AddLead      = lazyWithRetry(() => import("@/pages/AddLead"));
const ImportLeads  = lazyWithRetry(() => import("@/pages/ImportLeads"));
const Attendance   = lazyWithRetry(() => import("@/pages/Attendance"));
const Orders       = lazyWithRetry(() => import("@/pages/Orders"));
const Campaigns    = lazyWithRetry(() => import("@/pages/Campaigns"));
const TeamManagement = lazyWithRetry(() => import("@/pages/TeamManagement"));
const InstallApp   = lazyWithRetry(() => import("@/pages/InstallApp"));
const Profile      = lazyWithRetry(() => import("@/pages/Profile"));
const BusinessOperations = lazyWithRetry(() => import("@/pages/BusinessOperations"));
const AIAssistant = lazyWithRetry(() => import("@/pages/AIAssistant"));
const NotFound     = lazyWithRetry(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Minimal skeleton shown while a lazy page chunk downloads (~100ms on fast 4G)
const PageLoader = () => (
  <div className="flex-1 px-4 pt-8 space-y-3 animate-in">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
    ))}
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route element={<AppLayout />}>
                  <Route path="/"           element={<Dashboard />} />
                  <Route path="/leads"      element={<Leads />} />
                  <Route path="/leads/new"  element={<AddLead />} />
                  <Route path="/leads/:id/edit" element={<AddLead />} />
                  <Route path="/leads/:id"  element={<LeadDetail />} />
                  <Route path="/leads/:id/profile" element={<ClientProfile />} />
                  <Route path="/clients" element={<ClientsView />} />
                  <Route path="/campaigns"   element={<Campaigns />} />
                  <Route path="/import"     element={<ImportLeads />} />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/orders"     element={<Orders />} />
                  <Route path="/collections" element={<Navigate to="/orders" replace />} />
                  <Route path="/margin"      element={<Navigate to="/" replace />} />
                  <Route path="/assistant"   element={<AIAssistant />} />
                  <Route path="/tasks"       element={<BusinessOperations />} />
                  <Route path="/proposals"   element={<BusinessOperations />} />
                  <Route path="/tenders"     element={<BusinessOperations />} />
                  <Route path="/documents"   element={<Navigate to="/leads" replace />} />
                  <Route path="/settings"    element={<BusinessOperations />} />
                  <Route path="/team"       element={<TeamManagement />} />
                  <Route path="/install"    element={<InstallApp />} />
                  <Route path="/profile"    element={<Profile />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
