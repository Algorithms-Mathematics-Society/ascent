import type { ResultResponse } from "./results";

/** Imported only on download. Drawing happens on the participant's device. */
export async function createResultShareCard({ result, totalParticipants, selectionCount }: ResultResponse): Promise<Blob> {
  if (!result.selected || result.rank < 1 || result.rank > selectionCount) throw new Error("A selected result is required.");
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 627;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn’t create the image. Try Print / save result instead.");

  const navy = "#14283a", gold = "#e7d3a4", muted = "#bdcdd4";
  ctx.fillStyle = navy; ctx.fillRect(0, 0, 1200, 627);
  const glow = ctx.createRadialGradient(1110, 0, 0, 1110, 0, 850);
  glow.addColorStop(0, "#a9822f38"); glow.addColorStop(1, "#a9822f00");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 1200, 627);
  ctx.strokeStyle = "#e7d3a450"; ctx.lineWidth = 1;
  ctx.strokeRect(24.5, 24.5, 1151, 578);

  const text = (value: string, x: number, y: number, size: number, color: string, weight = 400) => {
    ctx.font = `${weight} ${size}px Arial, sans-serif`; ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  // Ascent's stair motif, drawn as geometry so export needs no image/font fetches.
  ctx.strokeStyle = gold; ctx.lineWidth = 3; ctx.beginPath();
  ctx.moveTo(65, 87); ctx.lineTo(79, 87); ctx.lineTo(79, 75); ctx.lineTo(93, 75); ctx.lineTo(93, 63); ctx.lineTo(107, 63); ctx.stroke();
  text("ASCENT / 2026", 125, 83, 23, "#ffffff", 600);
  text("ALGORITHMS & MATHEMATICS SOCIETY", 65, 124, 13, muted);
  ctx.strokeStyle = "#ffffff25"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(65, 154); ctx.lineTo(1135, 154); ctx.stroke();

  text("SELECTED FOR ROUND 2", 65, 208, 17, gold, 600);
  text("The ascent", 61, 297, 72, "#ffffff", 600);
  text("continues.", 61, 374, 72, "#ffffff", 600);
  text(`One of ${selectionCount}. Ready for what’s next.`, 65, 422, 22, muted);

  // Fit the whole username, including unusually long handles, without clipping.
  let fontSize = 24;
  ctx.font = `600 ${fontSize}px Arial, sans-serif`;
  while (ctx.measureText(result.username).width > 690 && fontSize > 10) {
    fontSize--; ctx.font = `600 ${fontSize}px Arial, sans-serif`;
  }
  ctx.fillStyle = gold; ctx.fillText(result.username, 65, 477, 690);

  ctx.strokeStyle = "#e7d3a470"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(825, 190, 285, 292, [140, 140, 16, 16]); ctx.stroke();
  ctx.textAlign = "center";
  text("OVERALL RANK", 967, 288, 15, gold, 600);
  text(`#${result.rank}`, 967, 382, 88, gold, 600);
  text(`OF ${totalParticipants.toLocaleString("en-IN")} PARTICIPANTS`, 967, 427, 14, muted);
  ctx.textAlign = "left";
  ctx.strokeStyle = "#ffffff25"; ctx.beginPath(); ctx.moveTo(65, 522); ctx.lineTo(1135, 522); ctx.stroke();
  text("ROUND 1  /  QUALIFIED", 65, 566, 15, gold, 600);
  ctx.textAlign = "right"; text("ascent.amshq.in/results", 1135, 566, 17, muted);

  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Couldn’t save the image. Try Print / save result instead.")), "image/png"));
}
