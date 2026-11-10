"use client";
import { forwardRef, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  ImageOff,
  Linkedin,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui";
import { ROUND_ONE_SELECTION_COUNT } from "@/lib/results";
import type { CertificateSummary } from "./certificateRequest";

const CERTIFICATE_NAME = "Ascent '26 Round 1 Qualifier";
const ORGANIZATION_NAME = "Algorithms & Mathematics Society";

function linkedInUrl(summary: CertificateSummary) {
  return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(CERTIFICATE_NAME)}&organizationName=${encodeURIComponent(ORGANIZATION_NAME)}&issueYear=2026&issueMonth=11&certUrl=${encodeURIComponent(summary.verifyUrl)}&certId=${encodeURIComponent(summary.verificationCode)}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and some in-app webviews block the async clipboard API.
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}

const secondaryLink =
  "inline-flex min-h-11 items-center gap-2 rounded-control px-1 text-sm font-semibold text-ascent-brand hover:underline hover:underline-offset-4";

type CertificateReadyProps = {
  summary: CertificateSummary;
  busy: boolean;
  onSignOut: () => void;
  onAnnounce: (message: string) => void;
};

const CertificateReady = forwardRef<HTMLHeadingElement, CertificateReadyProps>(
  function CertificateReady({ summary, busy, onSignOut, onAnnounce }, heading) {
    const [preview, setPreview] = useState<"loading" | "ready" | "failed">(
      "loading",
    );
    const [copied, setCopied] = useState(false);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const copyTimer = useRef<number>();

    useEffect(() => () => window.clearTimeout(copyTimer.current), []);

    // One transfer serves both the preview and the download: the PNG is
    // fetched once and kept in memory as a blob URL. The button keeps the
    // server URL as a fallback until (or unless) the blob is ready.
    useEffect(() => {
      const controller = new AbortController();
      let objectUrl: string | null = null;
      fetch("/api/certificates/download?disposition=inline", {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok || response.headers.get("content-type") !== "image/png")
            throw new Error("preview_unavailable");
          objectUrl = URL.createObjectURL(await response.blob());
          setFileUrl(objectUrl);
        })
        .catch(() => {
          if (!controller.signal.aborted) setPreview("failed");
        });
      return () => {
        controller.abort();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, []);

    async function copyLink() {
      const ok = await copyText(summary.verifyUrl);
      window.clearTimeout(copyTimer.current);
      if (ok) {
        setCopied(true);
        onAnnounce("Verification link copied.");
        copyTimer.current = window.setTimeout(() => setCopied(false), 2500);
      } else {
        onAnnounce(
          "Copying was blocked. Select the link shown below the buttons to copy it.",
        );
      }
    }

    return (
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ascent-gold-ink">
          Ascent ’26 · Round 1 qualifier
        </p>
        <h2
          ref={heading}
          tabIndex={-1}
          className="mt-3 font-display text-4xl leading-tight text-ascent-ink outline-none sm:text-5xl"
        >
          Congratulations, {summary.name}.
        </h2>
        <p className="mt-3 text-base leading-7 text-ascent-muted">
          <strong className="font-semibold text-ascent-ink">
            Rank {summary.rank} of {ROUND_ONE_SELECTION_COUNT} qualifiers.
          </strong>{" "}
          Your certificate is ready to download.
        </p>

        <figure className="mt-7">
          <div className="relative aspect-[2246/1588] w-full overflow-hidden rounded-control border border-ascent-border bg-ascent-surface-subtle">
            {preview === "loading" ? (
              <div
                aria-hidden="true"
                className="absolute inset-0 animate-pulse bg-ascent-surface-strong/60"
              />
            ) : null}
            {preview === "failed" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-ascent-muted">
                <ImageOff size={22} aria-hidden="true" />
                <p>
                  The preview couldn’t load. You can still download your
                  certificate below.
                </p>
              </div>
            ) : null}
            {fileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, session-bound blob that must not pass through the image optimizer
            <img
              src={fileUrl}
              width={2246}
              height={1588}
              alt={`Ascent ’26 Round 1 certificate awarded to ${summary.name}, rank ${summary.rank} of ${ROUND_ONE_SELECTION_COUNT}, verification code ${summary.verificationCode}.`}
              decoding="async"
              onLoad={() => setPreview("ready")}
              onError={() => setPreview("failed")}
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${preview === "ready" ? "opacity-100" : "opacity-0"}`}
            />
            ) : null}
          </div>
          <figcaption className="mt-2 text-xs text-ascent-muted">
            Preview · PNG, 2246 × 1588
          </figcaption>
        </figure>

        <div className="mt-6">
          <Button
            href={fileUrl ?? "/api/certificates/download"}
            download={summary.filename}
            size="lg"
            className="w-full sm:w-auto"
          >
            <Download size={18} aria-hidden="true" /> Download certificate (PNG)
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
          <button type="button" onClick={copyLink} className={secondaryLink}>
            {copied ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy verification link"}
          </button>
          <a
            href={summary.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryLink}
          >
            <ExternalLink size={16} aria-hidden="true" /> Open verification page
          </a>
          <a
            href={linkedInUrl(summary)}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryLink}
          >
            <Linkedin size={16} aria-hidden="true" /> Add to LinkedIn
          </a>
        </div>

        <dl className="mt-6 grid gap-4 border-y border-ascent-border py-5 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-ascent-muted">
              Verification code
            </dt>
            <dd className="mt-1 inline-flex items-center gap-2 font-mono text-sm font-bold tracking-[0.08em] text-ascent-ink">
              <ShieldCheck
                size={16}
                className="text-ascent-success"
                aria-hidden="true"
              />{" "}
              {summary.verificationCode}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-ascent-muted">
              Issued on
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ascent-ink">
              {summary.issuedOn}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-ascent-muted">
              Verification link
            </dt>
            <dd className="mt-1 select-all break-all font-mono text-sm text-ascent-ink">
              {summary.verifyUrl}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2 text-xs leading-5 text-ascent-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            This session lasts 30 minutes. Sign out when using a shared device.
          </p>
          <button
            type="button"
            onClick={onSignOut}
            disabled={busy}
            className="inline-flex min-h-11 items-center self-start rounded-control px-1 text-sm font-medium text-ascent-muted underline underline-offset-4 hover:text-ascent-ink disabled:cursor-wait sm:self-auto"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    );
  },
);

export default CertificateReady;
