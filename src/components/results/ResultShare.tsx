"use client";

import { useRef, useState } from "react";
import { Copy, Download, Linkedin, Loader2, PartyPopper } from "lucide-react";
import type { ResultResponse } from "@/lib/results";
import { LINKEDIN_SHARE_URL, resultCaption, resultCardFilename } from "@/lib/resultSharing";
import styles from "./results.module.css";

export default function ResultShare({ result, onCelebrate }: { result: ResultResponse; onCelebrate: () => void }) {
  const [caption, setCaption] = useState(() => resultCaption(result));
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const downloadingRef = useRef(false);

  async function download() {
    if (downloadingRef.current) return;
    downloadingRef.current = true; setDownloading(true); setMessage("");
    try {
      const { createResultShareCard } = await import("@/lib/resultShareCard");
      const blob = await createResultShareCard(result);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = resultCardFilename(result.result.rank);
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage("Your share card is ready. Attach the PNG to your LinkedIn post.");
    } catch {
      setMessage("We couldn’t create the share card. Try again, or use Print / save result below.");
    } finally { downloadingRef.current = false; setDownloading(false); }
  }

  async function copyCaption() {
    if (copying) return;
    setCopying(true); setMessage("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(caption);
      setMessage("Caption copied. Paste it into your LinkedIn post and make it your own.");
    } catch {
      setShowCaption(true);
      setMessage("Select and copy the caption below. Your browser couldn’t copy it automatically.");
      requestAnimationFrame(() => { captionRef.current?.focus(); captionRef.current?.select(); });
    } finally { setCopying(false); }
  }

  return <section className={styles.sharePanel} aria-labelledby="share-title">
    <div className={styles.shareHeading}>
      <div><p className={styles.smallLabel}>A MILESTONE WORTH SHARING</p><h3 id="share-title">Take this moment with you.</h3></div>
      <button type="button" className={styles.celebrateButton} onClick={onCelebrate}><PartyPopper size={18} aria-hidden="true" /> Celebrate again</button>
    </div>
    <div className={styles.sharePreview} role="img" aria-label={`Share card: Ascent 2026, selected for Round 2, ${result.result.username}, rank ${result.result.rank} of ${result.totalParticipants}`}>
      <div><span>ASCENT / 2026</span><strong>The ascent<br />continues.</strong><small>{result.result.username}</small></div>
      <div className={styles.sharePreviewRank}><span>ROUND 2 · SELECTED</span><strong>#{result.result.rank}</strong><small>OF {result.totalParticipants.toLocaleString("en-IN")}</small></div>
    </div>
    <p className={styles.shareHint}>Download your card and copy the caption. On LinkedIn, attach the PNG and paste or edit your caption before posting.</p>
    <div className={styles.shareActions}>
      <button type="button" className={styles.saveButton} onClick={download} disabled={downloading}>
        {downloading ? <Loader2 size={16} className={styles.spinner} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}{downloading ? "Creating card…" : "Download share card"}
      </button>
      <button type="button" className={styles.copyButton} onClick={copyCaption} disabled={copying}><Copy size={16} aria-hidden="true" />{copying ? "Copying…" : "Copy caption"}</button>
      <a className={styles.linkedinButton} href={LINKEDIN_SHARE_URL} target="_blank" rel="noopener noreferrer"><Linkedin size={16} aria-hidden="true" /> Share on LinkedIn<span className={styles.srOnly}> (opens in a new tab)</span></a>
    </div>
    <p className={styles.shareStatus} role="status">{message}</p>
    <details className={styles.captionEditor} open={showCaption} onToggle={event => setShowCaption(event.currentTarget.open)}>
      <summary>Edit your caption</summary>
      <label className={styles.srOnly} htmlFor="result-caption">Your LinkedIn caption</label>
      <textarea ref={captionRef} id="result-caption" value={caption} maxLength={3000} onChange={event => { setCaption(event.target.value); setMessage(""); }} rows={8} />
    </details>
  </section>;
}
