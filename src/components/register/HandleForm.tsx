"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CollegeTypeahead from "@/components/register/CollegeTypeahead";

interface SelectedCollege {
  college_id: string;
  canonical_name: string;
}

export default function HandleForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [selectedCollege, setSelectedCollege] =
    useState<SelectedCollege | null>(null);
  const [unlistedName, setUnlistedName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedCollege && !unlistedName) {
      setError("Select your college or mark it as unlisted.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          college_id: selectedCollege?.college_id ?? null,
          unlisted_name: selectedCollege ? null : unlistedName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.push("/register/profile");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold text-white">Pick your handle</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="handle" className="text-sm text-ascent-muted">
            Handle (shown on the ranklist)
          </label>
          <input
            id="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="e.g. tilak_j"
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
            required
          />
        </div>
        <CollegeTypeahead
          onSelect={setSelectedCollege}
          onUnlisted={setUnlistedName}
        />
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="ascent-btn ascent-btn-primary"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
