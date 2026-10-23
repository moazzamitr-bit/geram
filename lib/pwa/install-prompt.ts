export const INSTALL_DISMISS_KEY = "geram-pwa-install-dismissed";

export type InstallSurface = "hidden" | "ios" | "android";

export function isIosUserAgent(ua: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ sends a desktop Macintosh UA and reports touch points.
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

export function installSurface(input: {
  standalone: boolean;
  dismissed: boolean;
  ios: boolean;
  canPrompt: boolean;
}): InstallSurface {
  if (input.standalone || input.dismissed) return "hidden";
  if (input.ios) return "ios";
  if (input.canPrompt) return "android";
  return "hidden";
}
