import { useEffect, useState } from 'react';
import { Smartphone, Share, Plus, MoreVertical, Download, Apple, CheckCircle2, WifiOff, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="flex gap-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {n}
    </div>
    <div className="flex-1 pt-1">
      <p className="font-medium text-foreground">{title}</p>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
    </div>
  </div>
);

const InstallApp = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(window.deferredTenderExpertInstall || null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [installing, setInstalling] = useState(false);
  const isApple = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onReady = () => setInstallPrompt(window.deferredTenderExpertInstall || null);
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener('tenderexpert-install-ready', onReady);
    window.addEventListener('tenderexpert-app-installed', onInstalled);
    return () => { window.removeEventListener('tenderexpert-install-ready', onReady); window.removeEventListener('tenderexpert-app-installed', onInstalled); };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') { window.deferredTenderExpertInstall = null; setInstallPrompt(null); }
    } finally { setInstalling(false); }
  };

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6 pb-28 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Download className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Install TenderExpert</h1>
          <p className="text-sm text-muted-foreground">
            Add the app to your home screen for a native-like experience.
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/icon-192.png" alt="TenderExpert" className="h-14 w-14 rounded-2xl" />
              <div><p className="font-semibold">TenderExpert B2G CRM</p><p className="text-sm text-muted-foreground">{installed ? 'App installed and running in standalone mode' : 'Install securely on your home screen'}</p></div>
            </div>
            {installed ? <Button disabled variant="outline"><CheckCircle2 className="h-4 w-4 mr-2"/>Installed</Button> : installPrompt ? <Button onClick={install} disabled={installing}><Download className="h-4 w-4 mr-2"/>{installing ? 'Installing…' : 'Install app'}</Button> : null}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary"/>Fast app-like launch</span><span className="flex items-center gap-2"><WifiOff className="h-4 w-4 text-primary"/>Offline app shell</span></div>
        </CardContent>
      </Card>

      <Tabs defaultValue={isApple ? 'ios' : 'android'} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ios" className="gap-2">
            <Apple className="h-4 w-4" /> iOS
          </TabsTrigger>
          <TabsTrigger value="android" className="gap-2">
            <Smartphone className="h-4 w-4" /> Android
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ios" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Install on iPhone / iPad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Step n={1} title="Open in Safari">
                Open this app in the <strong>Safari</strong> browser. Other browsers (Chrome, Firefox) won't show the install option on iOS.
              </Step>
              <Step n={2} title="Tap the Share button">
                Tap the <Share className="inline h-4 w-4 align-text-bottom" /> Share icon at the bottom of the Safari screen.
              </Step>
              <Step n={3} title="Add to Home Screen">
                Scroll down in the share sheet and tap <strong>Add to Home Screen</strong> <Plus className="inline h-4 w-4 align-text-bottom" />.
              </Step>
              <Step n={4} title="Confirm">
                Tap <strong>Add</strong> in the top-right corner. The TenderExpert icon will appear on your home screen.
              </Step>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="android" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Install on Android</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Step n={1} title="Open in Chrome">
                Open this app in <strong>Google Chrome</strong> (recommended) or any modern Android browser.
              </Step>
              <Step n={2} title="Open the menu">
                Tap the <MoreVertical className="inline h-4 w-4 align-text-bottom" /> three-dot menu in the top-right corner.
              </Step>
              <Step n={3} title="Install app">
                Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </Step>
              <Step n={4} title="Confirm">
                Tap <strong>Install</strong>. The TenderExpert icon will be added to your home screen and app drawer.
              </Step>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Tip:</strong> Once installed, TenderExpert opens in its own window without browser
            tabs or address bar — just like a native app. You can also use it offline for previously visited pages.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallApp;
