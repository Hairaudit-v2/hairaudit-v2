"use client";

import { useCallback, useRef, useState } from "react";

const OPTION_HEIGHT = 40;
const MAX_VISIBLE = 8;

type Option = { value: string; label: string };

export default function SearchableMultiSelect({
  id,
  name,
  options,
  value,
  onChange,
  disabled,
  placeholder = "Select options...",
  className = "",
}: {
  id: string;
  name: string;
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const otherOption = options.find((o) => o.value === "other");
  const restOptions = options.filter((o) => o.value !== "other");
  const filtered =
    filter.trim() === ""
      ? restOptions
      : restOptions.filter(
          (o) =>
            o.label.toLowerCase().includes(filter.toLowerCase()) ||
            o.value.toLowerCase().includes(filter.toLowerCase())
        );
  const displayList = otherOption ? [...filtered, otherOption] : filtered;

  const selected = Array.isArray(value) ? value : [];
  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean);
  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} selected`;

  const toggle = useCallback(
    (v: string) => {
      const next = selected.includes(v)
        ? selected.filter((x) => x !== v)
        : [...selected, v];
      onChange(next.length ? next : []);
    },
    [onChange, selected]
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-multiselectable
        aria-label={summary}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60 disabled:bg-gray-100 ${className}`}
      >
        {summary}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[320px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            <div className="border-b border-gray-100 p-2">
              <input
                type="search"
                autoFocus
                placeholder="Search..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                aria-label="Filter options"
              />
            </div>
            <ul
              className="overflow-y-auto py-1"
              style={{ maxHeight: OPTION_HEIGHT * MAX_VISIBLE }}
            >
              {displayList.map((o) => (
                <li key={o.value} role="option" aria-selected={selected.includes(o.value)}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-amber-50">
                    <input
                      type="checkbox"
                      checked={selected.includes(o.value)}
                      onChange={() => toggle(o.value)}
                      disabled={disabled}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm">{o.label}</span>
                  </label>
                </li>
              ))}
              {displayList.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-gray-500">
                  No matches
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
