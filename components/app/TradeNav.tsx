"use client";

import { MetalIcon } from "@/components/app/MetalIcon";
import type { AppNavItem } from "@/lib/app/navigation";
import {
  activeTradeSlugFromPath,
  isTradeSectionPath,
  TRADE_METALS,
  tradeSubmenuCommand,
  type TradeSubmenuCommand,
} from "@/lib/market/trade-routes";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

type TradeMenuItem = Extract<AppNavItem, { menuKey: "trade" }>;

function runCommand(
  event: KeyboardEvent,
  command: TradeSubmenuCommand,
  open: boolean,
  setOpen: (value: boolean) => void,
  focusIndex: (index: number) => void,
  focusTrigger: () => void
) {
  if (command.type === "none") return;
  event.preventDefault();
  if (command.type === "toggle") {
    setOpen(!open);
    return;
  }
  if (command.type === "close") {
    setOpen(false);
    focusTrigger();
    return;
  }
  if (command.type === "focus") {
    focusIndex(command.index);
    return;
  }
  setOpen(true);
  if (open) focusIndex(command.focusIndex);
  return command.focusIndex;
}

export function DesktopTradeMenu({
  item,
  pathname,
}: {
  item: TradeMenuItem;
  pathname: string;
}) {
  const activeSlug = activeTradeSlugFromPath(pathname);
  const sectionActive = isTradeSectionPath(pathname);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const pendingFocus = useRef<number | null>(null);
  const listId = useId();
  const Icon = item.icon;

  useEffect(() => {
    if (activeSlug) setOpen(true);
  }, [activeSlug]);

  useEffect(() => {
    if (!open || pendingFocus.current == null) return;
    const index = pendingFocus.current;
    pendingFocus.current = null;
    itemRefs.current[index]?.focus();
  }, [open]);

  const focusIndex = (index: number) => {
    const node = itemRefs.current[index];
    if (node) {
      node.focus();
      return;
    }
    pendingFocus.current = index;
  };

  const onCommand = (event: KeyboardEvent, index: number | null) => {
    const command = tradeSubmenuCommand({
      key: event.key,
      open,
      index,
      count: item.children.length,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    });
    const deferred = runCommand(
      event,
      command,
      open,
      setOpen,
      focusIndex,
      () => buttonRef.current?.focus()
    );
    if (typeof deferred === "number" && !open) pendingFocus.current = deferred;
  };

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        id={`${listId}-trigger`}
        className={cn(
          "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-right text-[14px] transition-colors duration-200",
          sectionActive
            ? "bg-[#FFF4D6] font-semibold text-text"
            : "text-text-secondary hover:bg-black/[0.04] hover:text-text"
        )}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => onCommand(event, null)}
      >
        <Icon size={18} strokeWidth={sectionActive ? 1.9 : 1.6} className="shrink-0" />
        <span className="truncate">{item.label}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          aria-hidden
          className={cn("mr-auto shrink-0 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <ul
        id={listId}
        aria-labelledby={`${listId}-trigger`}
        hidden={!open}
        className="mt-1 space-y-0.5"
        onKeyDown={(event) => {
          const indexAttr = (event.target as HTMLElement)
            .closest("a")
            ?.getAttribute("data-index");
          if (indexAttr == null) return;
          onCommand(event, Number(indexAttr));
        }}
      >
        {item.children.map((metal, index) => {
          const current = activeSlug === metal.slug;
          return (
            <li key={metal.slug}>
              <Link
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                href={metal.href}
                data-index={index}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-xl py-2 pr-9 pl-3 text-[13px] transition-colors",
                  current
                    ? "bg-[#FFF4D6] font-semibold text-text"
                    : "text-text-secondary hover:bg-black/[0.04] hover:text-text"
                )}
                style={
                  current
                    ? { boxShadow: `inset -3px 0 0 ${metal.accent}` }
                    : undefined
                }
              >
                <MetalIcon slug={metal.slug} />
                <span>{metal.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MobileTradeButton({
  item,
  pathname,
}: {
  item: TradeMenuItem;
  pathname: string;
}) {
  const activeSlug = activeTradeSlugFromPath(pathname);
  const sectionActive = isTradeSectionPath(pathname);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const listId = useId();
  const titleId = useId();
  const Icon = item.icon;
  const activeMetal = TRADE_METALS.find((metal) => metal.slug === activeSlug);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node =
      itemRefs.current[Math.max(0, TRADE_METALS.findIndex((metal) => metal.slug === activeSlug))] ??
      panelRef.current?.querySelector<HTMLElement>("a, button");
    node?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, activeSlug]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      const root = panelRef.current;
      if (!root) return;
      const nodes = root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    const indexAttr = (event.target as HTMLElement).closest("a")?.getAttribute("data-index");
    if (indexAttr == null) return;
    const command = tradeSubmenuCommand({
      key: event.key,
      open: true,
      index: Number(indexAttr),
      count: item.children.length,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    });
    if (command.type === "none") return;
    event.preventDefault();
    if (command.type === "close") {
      close();
      return;
    }
    if (command.type === "focus" || command.type === "open") {
      const index = command.type === "focus" ? command.index : command.focusIndex;
      itemRefs.current[index]?.focus();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "relative flex min-h-12 w-full cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] leading-3 transition-colors",
          sectionActive || open ? "font-semibold text-text" : "text-muted-app"
        )}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          const command = tradeSubmenuCommand({
            key: event.key,
            open,
            index: null,
            count: item.children.length,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
          });
          if (command.type === "none") return;
          event.preventDefault();
          if (command.type === "close") {
            close();
            return;
          }
          setOpen(true);
          if (command.type === "open") {
            const index = command.focusIndex;
            window.setTimeout(() => itemRefs.current[index]?.focus(), 0);
          }
        }}
      >
        <span className="relative">
          <Icon size={18} strokeWidth={sectionActive || open ? 2 : 1.6} />
          {activeMetal && (
            <span
              className="absolute -top-0.5 -left-1 h-1.5 w-1.5 rounded-full"
              style={{ background: activeMetal.accent }}
            />
          )}
        </span>
        {item.label}
      </button>
      {mounted &&
        createPortal(
          <div
            id={listId}
            role="dialog"
            aria-modal={open}
            aria-labelledby={titleId}
            hidden={!open}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="بستن منوی خرید و فروش"
              onClick={close}
            />
            <div
              ref={panelRef}
              className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-12px_40px_rgba(28,25,23,0.12)]"
              onKeyDown={onListKeyDown}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10" />
              <div className="mb-2 flex items-center justify-between">
                <h2 id={titleId} className="text-[16px] font-extrabold text-[#1c1917]">
                  {item.label}
                </h2>
                <button
                  type="button"
                  onClick={close}
                  className="min-h-10 rounded-xl px-3 text-[13px] font-medium text-[#57534e]"
                >
                  بستن
                </button>
              </div>
              <ul className="space-y-1">
                {item.children.map((metal, index) => {
                  const current = activeSlug === metal.slug;
                  return (
                    <li key={metal.slug}>
                      <Link
                        ref={(node) => {
                          itemRefs.current[index] = node;
                        }}
                        href={metal.href}
                        data-index={index}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2",
                          current ? "bg-[#FFF4D6] font-semibold text-[#1c1917]" : "font-medium text-[#1c1917] hover:bg-black/[0.04]"
                        )}
                        style={
                          current
                            ? { boxShadow: `inset -3px 0 0 ${metal.accent}` }
                            : undefined
                        }
                        onClick={() => setOpen(false)}
                      >
                        <MetalIcon slug={metal.slug} size={22} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px]">{metal.label}</span>
                          <span className="block text-[12px] font-normal text-[#57534e]">
                            {metal.title}
                          </span>
                        </span>
                        <ChevronLeft size={16} className="text-[#57534e]" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
