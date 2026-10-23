"use client";

import { installCopy } from "@/lib/pwa/copy";
import {
  INSTALL_DISMISS_KEY,
  installSurface,
  isIosUserAgent,
  type InstallSurface,
} from "@/lib/pwa/install-prompt";
import { cn } from "@/lib/utils";
import { Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isInstallPrompt(event: Event): event is BeforeInstallPromptEvent {
  return "prompt" in event && typeof (event as BeforeInstallPromptEvent).prompt === "function";
}

function standaloneNow() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
  );
}

export function PwaInstallBanner({ className }: { className?: string }) {
  const [surface, setSurface] = useState<InstallSurface>("hidden");
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    const standalone = standaloneNow();
    const ios = isIosUserAgent(navigator.userAgent, navigator.maxTouchPoints ?? 0);
    setSurface(installSurface({ standalone, dismissed, ios, canPrompt: false }));
    if (standalone || dismissed || ios) return;

    const onPrompt = (event: Event) => {
      if (!isInstallPrompt(event)) return;
      event.preventDefault();
      setPromptEvent(event);
      setSurface(installSurface({ standalone: false, dismissed: false, ios: false, canPrompt: true }));
    };
    const onInstalled = () => setSurface("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch {
      /* private mode */
    }
    setSurface("hidden");
    setPromptEvent(null);
  }

  async function install() {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setSurface("hidden");
    } catch {
      /* the browser rejected the prompt; keep the hint */
    }
    setPromptEvent(null);
  }

  if (surface === "hidden") return null;

  const ios = surface === "ios";

  return (
    <section
      aria-label={installCopy.region}
      className={cn(
        "mb-4 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_10px_30px_rgba(28,25,23,0.04)] lg:hidden",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6F4F1] text-text">
          {ios ? <Share size={18} strokeWidth={1.7} /> : <Smartphone size={18} strokeWidth={1.7} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[14px] font-bold text-text">
              {ios ? installCopy.iosTitle : installCopy.androidTitle}
            </h2>
            <button
              type="button"
              onClick={dismiss}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-black/[0.04]"
              aria-label={installCopy.dismiss}
            >
              <X size={16} />
            </button>
          </div>
          <p className="mt-1 text-[13px] leading-6 text-text-secondary">
            {ios ? installCopy.iosBody : installCopy.androidBody}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ios ? (
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex h-10 items-center rounded-xl bg-[#161616] px-4 text-[13px] font-bold text-white"
              >
                {installCopy.gotIt}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void install()}
                  className="inline-flex h-10 items-center rounded-xl bg-[#161616] px-4 text-[13px] font-bold text-white"
                >
                  {installCopy.install}
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex h-10 items-center rounded-xl border border-black/10 px-4 text-[13px] font-bold text-text"
                >
                  {installCopy.later}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
