"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  label: string;
  kicker?: string;
  disabled?: boolean;
  invert?: boolean;
  placeholder?: string;
  trailing?: ReactNode;
}

export function Dropdown({
  options,
  value,
  onChange,
  label,
  kicker,
  disabled,
  invert,
  placeholder = "Sélectionner…",
  trailing
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div
      className={clsx("dropdown", invert && "dropdown--invert")}
      ref={containerRef}
      data-open={open}
    >
      <button
        type="button"
        className="dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="dropdown-trigger-label">
          {kicker ? <span>{kicker}</span> : null}
          <strong>{selected?.label ?? placeholder}</strong>
        </span>
        {trailing}
        <svg className="dropdown-caret" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="dropdown-menu" id={listId} role="listbox">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className="dropdown-item"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="dropdown-item-label">
                  <strong>{option.label}</strong>
                  {option.hint ? <span>{option.hint}</span> : null}
                </span>
                {active ? (
                  <svg className="dropdown-tick" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
