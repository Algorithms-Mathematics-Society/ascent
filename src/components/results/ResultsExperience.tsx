"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Download, Loader2, Mountain, Search, Trophy } from "lucide-react";
import { isResultResponse, normalizeResultUsername, type ResultResponse } from "@/lib/results";
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

export default function ResultsExperience({ totalParticipants, selectionCount }: { totalParticipants: number; selectionCount: number }) {
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

  return (
    <div className={styles.experience}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}><span className={styles.liveDot} /> Ascent 2026 · Round 1 results</p>
        <h1>Your effort.<br /><span>Your next chapter.</span></h1>
        <p>Round 1 is complete. Your result, and what comes next, is ready.</p>
        <div className={styles.roundStats} aria-label="Round 1 summary">
          <span><strong>{totalParticipants.toLocaleString("en-IN")}</strong> participants</span>
          <span><strong>{selectionCount}</strong> selected for Round 2</span>
        </div>
      </div>

      {!entry ? (
        <section className={styles.lookup} aria-labelledby="lookup-title">
          <div className={styles.art} aria-hidden="true">
            <div className={styles.artLabel}>THE ASCENT CONTINUES</div>
            <div className={styles.steps}><i /><i /><i /><i /><i /><span><ArrowUpRight size={40} strokeWidth={1.2} /></span></div>
            <div className={styles.artFooter}><Mountain size={22} strokeWidth={1.3} /><span>Built on every attempt.</span></div>
          </div>
          <div className={styles.lookupBody}>
            <p className={styles.smallLabel}>THE MOMENT IS YOURS</p>
            <h2 id="lookup-title">Open your result.</h2>
            <p>Use the contest username you used to sign in for Round 1.</p>
            <form onSubmit={reveal} aria-busy={busy}>
              <label htmlFor="result-username">Contest username</label>
              <div className={styles.inputWrap}>
                <Search size={19} aria-hidden="true" />
                <input ref={input} id="result-username" name="username" value={username} onChange={event => { setUsername(event.target.value); if (error) setError(""); }}
                  required maxLength={128} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off"
                  placeholder="Your Round 1 username" disabled={busy} aria-invalid={error ? true : undefined} aria-describedby={`username-help${error ? " result-error" : ""}`} />
              </div>
              <p id="username-help" className={styles.fieldHint}>Use your contest username, not your email. Capitalization doesn’t matter.</p>
              {error ? <p id="result-error" role="alert" className={styles.error}>{error}</p> : null}
              <button className={styles.revealButton} type="submit" disabled={busy}>
                {busy ? <><Loader2 size={18} className={styles.spinner} aria-hidden="true" /> Opening your result…</> : <>Reveal my result <ArrowRight size={18} aria-hidden="true" /></>}
              </button>
              <span className={styles.srOnly} role="status">{busy ? "Looking up your Round 1 result." : ""}</span>
            </form>
            <p className={styles.lookupNote}>Result lookup uses a contest username. Anyone who knows a username can look up its result.</p>
          </div>
        </section>
      ) : result ? (
        <section className={`${styles.receipt} ${entry.selected ? styles.selected : ""}`} aria-labelledby="result-title">
          <div className={styles.resultHero}>
            {entry.selected ? <ResultCelebration key={celebration} /> : null}
            <div className={styles.resultTop}><span>ASCENT / 2026</span><span>ROUND 01 · RESULT</span></div>
            <div className={styles.resultHeadline}>
              <div>
                <p className={styles.resultBadge}>{entry.selected ? <><CheckCircle2 size={16} aria-hidden="true" /> SELECTED FOR ROUND 2</> : "ROUND 1 COMPLETE"}</p>
                <h2 ref={heading} tabIndex={-1} id="result-title">{entry.selected ? "You’re through." : "Thank you for taking on Ascent."}</h2>
                <p className={styles.resultMessage}>{entry.selected ? `You’ve earned your place among the top ${result.selectionCount}. Take a moment. This one is yours.` : `You haven’t been selected for Round 2. The top ${result.selectionCount} in the published standings advance. Thank you for the time and effort you put into this round.`}</p>
                <p className={styles.username}>{entry.username}</p>
              </div>
              <div className={styles.rankSeal}>
                {entry.selected ? <Trophy size={24} strokeWidth={1.4} aria-hidden="true" /> : <Mountain size={24} strokeWidth={1.4} aria-hidden="true" />}
                <span>OVERALL RANK</span><strong><small>#</small>{entry.rank}</strong><span>OF {result.totalParticipants.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          <div className={styles.resultBody}>
            <dl className={styles.metrics}>
              <div><dt>Problems solved</dt><dd>{entry.solved}<small> / 4</small></dd></div>
              <div><dt>Partial credit</dt><dd>{entry.partialCredit.toFixed(3)}</dd></div>
              <div><dt>Penalty</dt><dd>{entry.penaltyMinutes}<small> min</small></dd></div>
            </dl>
            <div className={styles.breakdownHeading}><h3>Your round, problem by problem.</h3><span>A — D</span></div>
            <div className={styles.problems}>
              {entry.problems.map(problem => (
                <div key={problem.id} className={`${styles.problem} ${problem.status === "accepted" ? styles.accepted : ""}`}>
                  <div className={styles.problemTop}><span>PROBLEM {problem.id}</span>{problem.status === "accepted" ? <Check size={16} aria-hidden="true" /> : <span aria-hidden="true">—</span>}</div>
                  <strong>{problem.status === "accepted" ? "Accepted" : problem.status === "partial" ? `${problem.credit}% credit` : "No submission"}</strong>
                  <p>{problem.status === "accepted" ? `${problem.minutes} min · ` : ""}{problem.attempts ? `${problem.attempts} ${problem.attempts === 1 ? "attempt" : "attempts"}` : "None recorded"}</p>
                </div>
              ))}
            </div>
            <div className={styles.nextStep}>
              <div className={styles.nextIcon}>{entry.selected ? <ArrowUpRight size={22} aria-hidden="true" /> : <Mountain size={22} aria-hidden="true" />}</div>
              <div><h3>{entry.selected ? "Next stop: Round 2." : "There’s more ahead of you."}</h3><p>{entry.selected ? "Keep an eye on your registered email for Round 2 instructions from the Ascent team." : "Keep building, keep solving. If you have a question about your result, the Ascent team can help."}</p></div>
            </div>
            {entry.selected ? <ResultShare result={result} onCelebrate={() => setCelebration(value => value + 1)} /> : null}
            <p className={styles.rankNote}>Selection follows the published Round 1 rank. Ranks 1–{result.selectionCount} advance; equal score fields do not change the published order.</p>
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
