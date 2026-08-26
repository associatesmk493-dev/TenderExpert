/// <reference types="vite/client" />

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface Window {
  deferredTenderExpertInstall?: BeforeInstallPromptEvent | null;
}
