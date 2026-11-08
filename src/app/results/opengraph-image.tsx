import { ImageResponse } from "next/og";
import { ROUND_ONE_SELECTION_COUNT } from "@/lib/results";

export const alt = `Ascent 2026 Round 1 results. The top ${ROUND_ONE_SELECTION_COUNT} advance to Round 2.`;
export const size = { width: 1200, height: 627 };
export const contentType = "image/png";
export const dynamic = "force-static";

// Rendered at build time. Social preview requests never load participant data.
export default function Image() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#14283a", color: "white", padding: "58px 70px", border: "12px solid #a9822f" }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#e7d3a4", fontSize: 23, letterSpacing: 3 }}><span>ASCENT / 2026</span><span>ROUND 1 RESULTS</span></div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 88, lineHeight: 1.05, letterSpacing: -4, marginTop: 70 }}><span>The ascent</span><span>continues.</span></div>
      <div style={{ display: "flex", fontSize: 27, color: "#bdcdd4", marginTop: 30 }}>The top {ROUND_ONE_SELECTION_COUNT} advance to Round 2.</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", fontSize: 20, color: "#e7d3a4" }}><span>Algorithms &amp; Mathematics Society</span><span>ascent.amshq.in/results</span></div>
    </div>, size,
  );
}
