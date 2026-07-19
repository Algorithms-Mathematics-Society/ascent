"use client";

import { useEffect, useRef, useState } from "react";

interface CollegeResult {
  college_id: string;
  canonical_name: string;
  campus: string | null;
  tier: "AUTO_QUALIFY" | "STANDARD";
}

interface CollegeTypeaheadProps {
  onSelect: (college: CollegeResult | null) => void;
  onUnlisted: (typedName: string) => void;
}

export default function CollegeTypeahead({
  onSelect,
  onUnlisted,
}: CollegeTypeaheadProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CollegeResult[]>([]);
  const [selected, setSelected] = useState<CollegeResult | null>(null);
  const [markedUnlisted, setMarkedUnlisted] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;
    if (selected || markedUnlisted || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(
        `/api/colleges/search?q=${encodeURIComponent(query.trim())}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (requestIdRef.current === currentRequestId) {
        setResults(data.results ?? []);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, selected, markedUnlisted]);

  function handlePick(college: CollegeResult) {
    setSelected(college);
    setQuery(college.canonical_name);
    setResults([]);
    onSelect(college);
  }

  function handleUnlistedClick() {
    setMarkedUnlisted(true);
    setSelected(null);
    setResults([]);
    onSelect(null);
    onUnlisted(query.trim());
  }

  function handleChange(value: string) {
    setQuery(value);
    setSelected(null);
    setMarkedUnlisted(false);
    onSelect(null);
    onUnlisted("");
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="college" className="text-sm text-ascent-muted">
        College / Institution
      </label>
      <input
        id="college"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Start typing your college name"
        className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
        autoComplete="off"
      />
      {results.length > 0 && (
        <ul className="rounded-lg border border-white/10 bg-ascent-panel">
          {results.map((college) => (
            <li key={college.college_id}>
              <button
                type="button"
                onClick={() => handlePick(college)}
                className="w-full px-4 py-2 text-left text-white hover:bg-white/5"
              >
                {college.canonical_name}
                {college.campus ? `, ${college.campus}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!selected && !markedUnlisted && query.trim().length >= 2 && (
        <button
          type="button"
          onClick={handleUnlistedClick}
          className="self-start text-sm text-ascent-accent underline"
        >
          My college isn&apos;t listed
        </button>
      )}
      {markedUnlisted && (
        <p className="text-sm text-ascent-muted">
          Noted: &quot;{query.trim()}&quot; will be reviewed for the college
          list.
        </p>
      )}
    </div>
  );
}
