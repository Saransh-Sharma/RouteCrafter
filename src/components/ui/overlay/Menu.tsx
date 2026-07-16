"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, usePopoverClose } from "./Popover";

export interface MenuItemSpec {
  label: React.ReactNode;
  onSelect: () => void;
  icon?: React.ReactNode;
  /** Render in the danger style (e.g. Delete). */
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  trigger: PopoverTrigger;
  items: MenuItemSpec[];
  align?: "start" | "end";
}

type PopoverTrigger = React.ComponentProps<typeof Popover>["trigger"];

/**
 * Action menu on top of Popover with roving arrow-key focus. Replaces the
 * old <details>-as-dropdown pattern.
 */
export function Menu({ trigger, items, align = "end" }: MenuProps) {
  return (
    <Popover trigger={trigger} align={align}>
      <MenuList items={items} />
    </Popover>
  );
}

function MenuList({ items }: { items: MenuItemSpec[] }) {
  const close = usePopoverClose();
  const listRef = React.useRef<HTMLDivElement>(null);

  function focusItem(offset: number) {
    const list = listRef.current;
    if (!list) return;
    const buttons = Array.from(
      list.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    );
    if (buttons.length === 0) return;
    const active = document.activeElement;
    const index = buttons.findIndex((button) => button === active);
    const next =
      index === -1
        ? offset > 0
          ? 0
          : buttons.length - 1
        : (index + offset + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(-1);
    }
  }

  return (
    <div
      ref={listRef}
      role="menu"
      onKeyDown={handleKeyDown}
      className="flex flex-col"
    >
      {items.map((item, index) => (
        <button
          key={index}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            close();
            item.onSelect();
          }}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-left text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage",
            item.danger
              ? "text-terracotta hover:bg-terracotta-soft"
              : "text-ink-soft hover:bg-paper-2 hover:text-ink",
            item.disabled && "pointer-events-none opacity-50",
          )}
        >
          {item.icon ? (
            <span className="text-ink-muted" aria-hidden>
              {item.icon}
            </span>
          ) : null}
          {item.label}
        </button>
      ))}
    </div>
  );
}
