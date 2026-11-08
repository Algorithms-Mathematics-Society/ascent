"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Download, Loader2, Mountain, Search, Trophy } from "lucide-react";
import { hasRecordedSubmission, isResultResponse, normalizeResultUsername, type ResultResponse } from "@/lib/results";
import { ROUND_ONE_REGISTRANTS } from "@/content/results";
import styles from "./results.module.css";
import dynamic from "next/dynamic";

function NoCelebration() { return null; }
function SharingUnavailable() {
  return <section className={styles.sharePanel} role="status"><p className={styles.shareHint}>Sharing couldn’t load. You can still print or save your result below.</p></section>;
}

// Optional enhancements must never take a successfully loaded result down when
// a network interruption or deployment makes their deferred chunk unavailable.
const ResultCelebration = dynamic(() => import("./ResultCelebration").catch(() => ({ default: NoCelebration })), { ssr: false });
const ResultShare = dynamic<{ result: ResultResponse; onCelebrate: () => void }>(
  () => import("./ResultShare").catch(() => ({ default: SharingUnavailable })),
);

export default function ResultsExperience({ selectionCount }: { selectionCount: number }) {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [celebration, setCelebration] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!result) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }, [result]);

  async function reveal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    const normalized = normalizeResultUsername(username);
    if (!normalized) { setError("Enter your contest username, without spaces."); input.current?.focus(); return; }
    inFlight.current = true;
    setBusy(true);
    setResult(null);
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/results", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized }), signal: controller.signal, cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "We couldn’t open your result. Please try again.");
      if (!isResultResponse(data) || normalizeResultUsername(data.result.username) !== normalized) throw new Error("We couldn’t open your result. Please try again.");
      setResult(data);
    } catch (caught) {
      setError(controller.signal.aborted ? "The request took too long. Please try again." : caught instanceof TypeError || caught instanceof SyntaxError ? "We couldn’t connect. Check your connection and try again." : caught instanceof Error ? caught.message : "We couldn’t open your result. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = false;
      setBusy(false);
    }
  }

  function reset() {
    setResult(null); setUsername(""); setError("");
    requestAnimationFrame(() => input.current?.focus());
  }

  const entry = result?.result;
  const hasSubmission = entry ? hasRecordedSubmission(entry) : false;

  return (
    <div className={styles.experience}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}><span className={styles.liveDot} /> Ascent 2026 · Round 1 results</p>
        <h1>Your effort.<br /><span>Your next chapter.</span></h1>
        <p>Round 1 is complete. Your result, and what comes next, is ready.</p>
        <dl className={styles.roundStats} aria-label="Round 1 summary">
          <div><dt>Registrants</dt><dd>{ROUND_ONE_REGISTRANTS}</dd></div>
          <div><dt>Selected for Round 2</dt><dd>{selectionCount}</dd></div>
        </dl>
      </div>

      {!entry ? (
        <section className={styles.lookup} aria-labelledby="lookup-title">
          <div className={styles.lookupBody}>
            <p className={styles.smallLabel}>YOUR ROUND 1 RESULT</p>
            <h2 id="lookup-title">Open your result.</h2>
            <p>Your standing. Your next step. All in one place.</p>
            <form onSubmit={reveal} aria-busy={busy}>
              <label htmlFor="result-username">AMS Access username</label>
              <div className={styles.inputWrap}>
                <Search size={19} aria-hidden="true" />
                <input ref={input} id="result-username" name="username" value={username} onChange={event => { setUsername(event.target.value); if (error) setError(""); }}
                  required maxLength={128} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off"
                  placeholder="Your AMS Access username" disabled={busy} aria-invalid={error ? true : undefined} aria-describedby={`username-help${error ? " result-error" : ""}`} />
              </div>
              <p id="username-help" className={styles.fieldHint}>Use your AMS Access username from Round 1. Capitalization doesn’t matter.</p>
              {error ? <p id="result-error" role="alert" className={styles.error}>{error}</p> : null}
              <button className={styles.revealButton} type="submit" disabled={busy}>
                {busy ? <><Loader2 size={18} className={styles.spinner} aria-hidden="true" /> Opening your result…</> : <>Reveal my result <ArrowRight size={18} aria-hidden="true" /></>}
              </button>
              <span className={styles.srOnly} role="status">{busy ? "Looking up your Round 1 result." : ""}</span>
            </form>
            <p className={styles.lookupNote}>This is a public result lookup. Anyone who knows a contest username can view its result.</p>
          </div>
          <aside className={styles.art} aria-label="The Ascent journey">
            <div className={styles.artHeading}>
              <p className={styles.artLabel}><span /> ROUND 1 · COMPLETE</p>
              <h3>Every attempt.<br /><span>A step forward.</span></h3>
              <p>Thank you for bringing your curiosity, code, and determination to Ascent.</p>
            </div>
            <div className={styles.steps} aria-hidden="true"><i /><i /><i /><i /><i /><span><ArrowUpRight size={32} strokeWidth={1.4} /></span></div>
            <div className={styles.artFooter}><span>01 <Check size={14} aria-hidden="true" /> Round 1 complete</span><ArrowRight size={16} aria-hidden="true" /><span>02 <span>The next chapter</span></span></div>
          </aside>
        </section>
      ) : result ? (
        <section className={`${styles.receipt} ${entry.selected ? styles.selected : ""}`} aria-labelledby="result-title">
          <div className={styles.resultHero}>
            {entry.selected ? <ResultCelebration key={celebration} /> : null}
            <div className={styles.resultTop}><span>ASCENT / 2026</span><span>ROUND 01 · RESULT</span></div>
            <div className={`${styles.resultHeadline} ${hasSubmission ? "" : styles.noSubmissionHeadline}`}>
              <div>
                <p className={styles.resultBadge}>{entry.selected ? <><CheckCircle2 size={16} aria-hidden="true" /> SELECTED FOR ROUND 2</> : hasSubmission ? "NOT SELECTED FOR ROUND 2" : "ROUND 1 RECORD"}</p>
                <p className={styles.username}>{entry.username}</p>
                <h2 ref={heading} tabIndex={-1} id="result-title">{entry.selected ? "You’re through." : hasSubmission ? "Thank you for taking on Ascent." : "No submission recorded."}</h2>
                <p className={styles.resultMessage}>{entry.selected ? `You’re one of ${result.selectionCount} selected for Round 2. Take a moment. You earned this.` : hasSubmission ? `You haven’t been selected for Round 2. The top ${result.selectionCount} in the published standings advance. Thank you for the time and effort you put into this round.` : "No submissions are recorded for this account in Round 1, so a result rank is not shown."}</p>
              </div>
              {hasSubmission ? <div className={styles.rankSeal}>
                {entry.selected ? <Trophy size={24} strokeWidth={1.4} aria-hidden="true" /> : <Mountain size={24} strokeWidth={1.4} aria-hidden="true" />}
                <span>PUBLISHED RANK</span><strong><small>#</small>{entry.rank}</strong><span>ROUND 1 STANDINGS</span>
              </div> : null}
            </div>
          </div>

          <div className={styles.resultBody}>
            <div className={styles.nextStep}>
              <div className={styles.nextIcon}>{entry.selected ? <ArrowUpRight size={22} aria-hidden="true" /> : <Mountain size={22} aria-hidden="true" />}</div>
              <div><h3>{entry.selected ? "Next stop: Round 2." : "Questions about your result?"}</h3><p>{entry.selected ? "Keep an eye on your registered email for Round 2 instructions from the Ascent team." : hasSubmission ? "The Ascent team can help. Contact us from your registered email address using the link below." : "If you submitted a solution, contact the Ascent team from your registered email address so we can check your record."}</p></div>
            </div>
            {entry.selected ? <ResultShare result={result} onCelebrate={() => setCelebration(value => value + 1)} /> : null}
            {hasSubmission ? <dl className={styles.metrics}>
              <div><dt>Problems solved</dt><dd>{entry.solved}<small> / 4</small></dd></div>
              <div><dt>Partial credit</dt><dd>{entry.partialCredit.toFixed(3)}</dd></div>
              <div><dt>Penalty</dt><dd>{entry.penaltyMinutes}<small> min</small></dd></div>
            </dl> : null}
            <div className={styles.breakdownHeading}><h3>{hasSubmission ? "Your round, problem by problem." : "Your submission record."}</h3><span>A — D</span></div>
            <div className={styles.problems}>
              {entry.problems.map(problem => (
                <div key={problem.id} className={`${styles.problem} ${problem.status === "accepted" ? styles.accepted : ""}`}>
                  <div className={styles.problemTop}><span>PROBLEM {problem.id}</span>{problem.status === "accepted" ? <Check size={16} aria-hidden="true" /> : <span aria-hidden="true">—</span>}</div>
                  <strong>{problem.status === "accepted" ? "Accepted" : problem.status === "partial" ? `${problem.credit}% credit` : "No submission"}</strong>
                  <p>{problem.status === "accepted" ? `${problem.minutes} min · ` : ""}{problem.attempts ? `${problem.attempts} ${problem.attempts === 1 ? "attempt" : "attempts"}` : "None recorded"}</p>
                </div>
              ))}
            </div>
            <p className={styles.rankNote}>{hasSubmission ? `Ranks 1–${result.selectionCount} in the published Round 1 standings advance. Your rank is shown exactly as published.` : "No recorded submission does not establish whether you attended the contest. No result rank is displayed for this record."}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.saveButton} onClick={() => window.print()}><Download size={16} aria-hidden="true" /> Print / save result</button>
              <button type="button" className={styles.resetButton} onClick={reset}>Check another username <ArrowRight size={16} aria-hidden="true" /></button>
            </div>
          </div>
        </section>
      ) : null}

      <div className={styles.help}>
        <p>Can’t find your username, or have a question about your result?</p>
        <a href="mailto:team@amshq.in?subject=Ascent%20Round%201%20result">Contact the Ascent team <ArrowUpRight size={14} aria-hidden="true" /></a>
        <p className={styles.helpNote}>Email from your registered address. Please don’t send your password.</p>
      </div>
    </div>
  );
}
