"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "STUDENT", label: "Student" },
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "OTHER", label: "Other" },
];

export default function ProfileForm() {
  const router = useRouter();
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [status, setStatus] = useState("STUDENT");
  const [phone, setPhone] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!resumeFile) {
      setError("Attach your resume as a PDF.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("year_of_study", yearOfStudy);
      formData.set("status", status);
      formData.set("phone", phone);
      formData.set("graduation_year", graduationYear);
      formData.set("resume", resumeFile);

      const res = await fetch("/api/register/profile", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.push("/register/path");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold text-white">
        Complete your profile
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="status" className="text-sm text-ascent-muted">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="yearOfStudy" className="text-sm text-ascent-muted">
            Year of study
          </label>
          <input
            id="yearOfStudy"
            value={yearOfStudy}
            onChange={(e) => setYearOfStudy(e.target.value)}
            placeholder="e.g. 3rd year"
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="graduationYear" className="text-sm text-ascent-muted">
            Graduation year
          </label>
          <input
            id="graduationYear"
            type="number"
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
            placeholder="e.g. 2027"
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className="text-sm text-ascent-muted">
            Phone number
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit Indian number"
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="resume" className="text-sm text-ascent-muted">
            Resume (PDF, under 500KB)
          </label>
          <input
            id="resume"
            type="file"
            accept="application/pdf"
            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            className="text-white"
            required
          />
        </div>
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
