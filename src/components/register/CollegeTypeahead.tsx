"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button, Input } from "@/components/ui";

export interface CollegeResult {
  college_id: string;
  canonical_name: string;
  campus: string | null;
  tier: "AUTO_QUALIFY" | "STANDARD";
}

interface CollegeTypeaheadProps {
  onSelect: (college: CollegeResult | null) => void;
  onUnlisted: (typedName: string) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

const MIN_QUERY_LENGTH = 2;
const MAX_VISIBLE_RESULTS = 8;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 32;

type CachedCollegeSearch = {
  results: CollegeResult[];
  expiresAt: number;
};

const searchCache = new Map<string, CachedCollegeSearch>();

function readCachedSearch(query: string) {
  const cached = searchCache.get(query);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(query);
    return null;
  }

  // Refresh insertion order so the bounded map behaves as a small LRU.
  searchCache.delete(query);
  searchCache.set(query, cached);
  return cached.results;
}

function writeCachedSearch(query: string, results: CollegeResult[]) {
  searchCache.delete(query);
  searchCache.set(query, {
    results,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  });

  while (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    searchCache.delete(oldestKey);
  }
}

/**
 * Searchable college combobox with an explicit fallback for unlisted colleges.
 * Typed text is not a selection until a canonical result or unlisted name is
 * deliberately confirmed.
 */
export default function CollegeTypeahead({
  onSelect,
  onUnlisted,
  disabled = false,
  error,
  required = true,
}: CollegeTypeaheadProps) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const statusId = `${inputId}-status`;
  const requestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmationActionsRef = useRef<HTMLDivElement>(null);
  const committedSummaryRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CollegeResult[]>([]);
  const [selected, setSelected] = useState<CollegeResult | null>(null);
  const [unlistedName, setUnlistedName] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [confirmingUnlisted, setConfirmingUnlisted] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const normalizedQuery = query.trim();
  const isCommitted = Boolean(selected || unlistedName);
  const canSearch =
    normalizedQuery.length >= MIN_QUERY_LENGTH && !isCommitted && !disabled;
  const visibleResults = results.slice(0, MAX_VISIBLE_RESULTS);
  const canConfirmUnlisted =
    normalizedQuery.length >= MIN_QUERY_LENGTH &&
    hasSearched &&
    !isLoading;
  const showPopup =
    isOpen && canSearch && (isLoading || hasSearched || Boolean(searchError));

  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;
    const controller = new AbortController();

    if (!canSearch) {
      setResults([]);
      setActiveIndex(-1);
      setIsLoading(false);
      setHasSearched(false);
      setSearchError("");
      return () => controller.abort();
    }

    const cacheKey = normalizedQuery.toLocaleLowerCase("en");
    const cachedResults = readCachedSearch(cacheKey);
    if (cachedResults) {
      setResults(cachedResults);
      setActiveIndex(-1);
      setIsLoading(false);
      setHasSearched(true);
      setSearchError("");
      return () => controller.abort();
    }

    setIsLoading(true);
    setHasSearched(false);
    setSearchError("");

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/colleges/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );

        if (requestIdRef.current !== currentRequestId) return;

        if (!response.ok) {
          setResults([]);
          setSearchError(
            response.status === 429
              ? "Too many searches. Wait a moment, then try again."
              : "Institution search is unavailable. Try again.",
          );
          return;
        }

        const data = (await response.json()) as {
          results?: CollegeResult[];
        };
        const nextResults = (data.results ?? []).slice(
          0,
          MAX_VISIBLE_RESULTS,
        );
        writeCachedSearch(cacheKey, nextResults);
        setActiveIndex(-1);
        setResults(nextResults);
      } catch (fetchError) {
        if (
          requestIdRef.current === currentRequestId &&
          !(
            fetchError instanceof DOMException &&
            fetchError.name === "AbortError"
          )
        ) {
          setResults([]);
          setSearchError("Institution search is unavailable. Try again.");
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsLoading(false);
          setHasSearched(true);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canSearch, normalizedQuery, retryNonce]);

  useEffect(() => {
    if (!showPopup || activeIndex < 0) return;
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, showPopup]);

  useEffect(() => {
    if (!confirmingUnlisted) return;
    window.requestAnimationFrame(() => {
      confirmationActionsRef.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus();
    });
  }, [confirmingUnlisted]);

  useEffect(() => {
    if (!selected && !unlistedName) return;
    window.requestAnimationFrame(() => committedSummaryRef.current?.focus());
  }, [selected, unlistedName]);

  function clearCommitment(focusInput = false) {
    setSelected(null);
    setUnlistedName("");
    setConfirmingUnlisted(false);
    setResults([]);
    setActiveIndex(-1);
    setIsOpen(true);
    onSelect(null);
    onUnlisted("");
    if (focusInput) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleChange(value: string) {
    setQuery(value);
    clearCommitment();
  }

  function handlePick(college: CollegeResult) {
    setSelected(college);
    setUnlistedName("");
    setQuery(college.canonical_name);
    setResults([]);
    setActiveIndex(-1);
    setIsOpen(false);
    setConfirmingUnlisted(false);
    onUnlisted("");
    onSelect(college);
  }

  function handleConfirmUnlisted() {
    if (!normalizedQuery) return;
    setSelected(null);
    setUnlistedName(normalizedQuery);
    setResults([]);
    setActiveIndex(-1);
    setIsOpen(false);
    setConfirmingUnlisted(false);
    onSelect(null);
    onUnlisted(normalizedQuery);
  }

  function cancelUnlistedConfirmation() {
    setConfirmingUnlisted(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
    if (searchError) {
      setIsOpen(true);
      setRetryNonce((value) => value + 1);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!canSearch || disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) =>
        visibleResults.length === 0 ? -1 : (index + 1) % visibleResults.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) =>
        visibleResults.length === 0
          ? -1
          : index <= 0
            ? visibleResults.length - 1
            : index - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const activeCollege = visibleResults[activeIndex];
      if (activeCollege) handlePick(activeCollege);
      return;
    }

    if (event.key === "Enter" && showPopup) {
      event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  const statusMessage = isLoading
    ? "Searching institutions."
    : searchError
      ? searchError
      : hasSearched
        ? visibleResults.length > 0
          ? `${visibleResults.length} institution${visibleResults.length === 1 ? "" : "s"} found.`
          : "No matching institutions found."
        : "";

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="text-sm font-medium leading-5 text-ascent-ink"
      >
        Institution
      </label>
      <p id={descriptionId} className="text-sm leading-5 text-ascent-muted">
        Your institution helps determine your competition route, not whether you
        can enter.
      </p>

      <div className="relative">
        <Input
          ref={inputRef}
          id={inputId}
          name="college"
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            if (canSearch) setIsOpen(true);
          }}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing your institution name"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPopup}
          aria-controls={showPopup ? listboxId : undefined}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-describedby={`${descriptionId} ${statusId}${error ? ` ${errorId}` : ""}`}
          aria-invalid={Boolean(error)}
          required={required}
          readOnly={isCommitted}
          disabled={disabled}
        />

        {showPopup ? (
          <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-control border border-ascent-field-border bg-ascent-field-bg">
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Institution search results"
              className="max-h-64 overflow-y-auto py-1"
            >
              {visibleResults.length > 0 ? (
                visibleResults.map((college, index) => (
                  <li
                    id={`${listboxId}-option-${index}`}
                    key={college.college_id}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={
                      index === activeIndex
                        ? "flex min-h-11 cursor-pointer flex-col justify-center bg-ascent-brand-tint-strong px-3 py-2 text-ascent-ink"
                        : "flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2 text-ascent-muted"
                    }
                    onPointerDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handlePick(college)}
                  >
                    <span className="block text-sm text-ascent-ink">
                      {college.canonical_name}
                    </span>
                    {college.campus ? (
                      <span className="mt-0.5 block text-xs text-ascent-muted">
                        {college.campus}
                      </span>
                    ) : null}
                  </li>
                ))
              ) : (
                <li
                  role="option"
                  aria-disabled="true"
                  aria-selected="false"
                  className="px-3 py-3 text-sm text-ascent-muted"
                >
                  {isLoading
                    ? "Searching…"
                    : searchError || "No matches found."}
                </li>
              )}
            </ul>
          </div>
        ) : null}
      </div>

      <p id={statusId} className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>

      {error ? (
        <p id={errorId} className="text-sm leading-5 text-ascent-danger">
          {error}
        </p>
      ) : null}

      {searchError && !isCommitted ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setRetryNonce((value) => value + 1);
          }}
          disabled={disabled}
          className="min-h-11 self-start text-sm font-medium text-ascent-brand underline decoration-ascent-brand underline-offset-4 hover:text-ascent-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          Retry institution search
        </button>
      ) : null}

      {selected ? (
        <div
          ref={committedSummaryRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
          className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-ascent-success/35 bg-ascent-success-tint px-3 py-2 text-sm"
        >
          <span className="min-w-0">
            <span className="block font-medium text-ascent-ink">
              {selected.canonical_name}
            </span>
            <span className="mt-0.5 block text-xs text-ascent-muted">
              {selected.campus
                ? `${selected.campus} · Official institution`
                : "Selected from the official institution list"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => clearCommitment(true)}
            disabled={disabled}
            className="min-h-11 font-medium text-ascent-brand underline decoration-ascent-brand underline-offset-4 hover:text-ascent-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            Change institution
          </button>
        </div>
      ) : unlistedName ? (
        <div
          ref={committedSummaryRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
          className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-ascent-border-strong bg-ascent-surface-subtle px-3 py-2 text-sm"
        >
          <span className="min-w-0">
            <span className="block font-medium text-ascent-ink">
              {unlistedName}
            </span>
            <span className="mt-0.5 block text-xs text-ascent-muted">
              Unlisted institution · Name will be reviewed after submission
            </span>
          </span>
          <button
            type="button"
            onClick={() => clearCommitment(true)}
            disabled={disabled}
            className="min-h-11 font-medium text-ascent-brand underline decoration-ascent-brand underline-offset-4 hover:text-ascent-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            Change institution
          </button>
        </div>
      ) : canConfirmUnlisted ? (
        confirmingUnlisted ? (
          <div className="rounded-panel border border-ascent-border-strong bg-ascent-surface-subtle p-4">
            <p className="text-sm leading-5 text-ascent-ink">
              Register with “{normalizedQuery}” as an unlisted institution?
            </p>
            <p className="mt-1 text-xs leading-5 text-ascent-muted">
              Check the spelling first. The name will be reviewed after
              submission.
            </p>
            <div
              ref={confirmationActionsRef}
              className="mt-3 flex flex-wrap gap-2"
            >
              <Button
                type="button"
                onClick={handleConfirmUnlisted}
                disabled={disabled}
              >
                Use this name
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={cancelUnlistedConfirmation}
                disabled={disabled}
              >
                Keep searching
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setConfirmingUnlisted(true);
            }}
            disabled={disabled}
            className="min-h-11 self-start text-sm font-medium text-ascent-brand underline decoration-ascent-brand underline-offset-4 hover:text-ascent-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searchError
              ? "Continue with this institution name"
              : "My institution is not listed"}
          </button>
        )
      ) : null}
    </div>
  );
}
