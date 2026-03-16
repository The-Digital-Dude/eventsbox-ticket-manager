"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface SearchableSelectProps {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  className,
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const listboxId = `searchable-select-listbox-${generatedId}`;

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  function openPopover() {
    setOpen(true);
    setSearch("");
    setHighlightedIndex(0);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function closePopover() {
    setOpen(false);
    setSearch("");
    setHighlightedIndex(0);
  }

  function selectOption(option: { value: string; label: string }) {
    onChange(option.value);
    closePopover();
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePopover();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openPopover();
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closePopover();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[highlightedIndex];
      if (item) selectOption(item);
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setHighlightedIndex(0);
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger button */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={disabled}
        onClick={openPopover}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex h-[2.625rem] w-full items-center justify-between rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-900 shadow-sm transition",
          "focus-visible:border-[rgb(var(--theme-accent-rgb)/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.2)]",
          open && "border-[rgb(var(--theme-accent-rgb)/0.55)] ring-2 ring-[rgb(var(--theme-accent-rgb)/0.2)]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span className={cn("truncate", !selectedLabel && "text-neutral-400")}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--border)] bg-white shadow-lg">
          {/* Search input */}
          <div className="border-b border-[var(--border)] p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder-neutral-400 focus-visible:border-[rgb(var(--theme-accent-rgb)/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.2)]"
            />
          </div>

          {/* Options list */}
          <ul
            id={listboxId}
            ref={listRef}
            role="listbox"
            className="max-h-[300px] overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-neutral-400">No results found</li>
            ) : (
              filtered.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseDown={(e) => {
                    // Prevent blur on search input before click registers
                    e.preventDefault();
                    selectOption(option);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between px-3 py-2 text-sm",
                    index === highlightedIndex
                      ? "bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[var(--theme-accent)]"
                      : "text-neutral-900 hover:bg-neutral-50",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-[var(--theme-accent)]" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
