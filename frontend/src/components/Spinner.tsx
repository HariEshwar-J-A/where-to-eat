import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import type { Restaurant } from "../types";
import { fetchSpinnerOptions } from "../api";
import { SplitModal } from "./SplitModal";

const LONG_LABEL_PREVIEW =
  "Luigi's Trattoria & Wood-Fired Neapolitan Pizza Kitchen — Authentic Family Style, Reservations Welcome";

type Props = {
  onSavedToLedger: () => void;
  onOpenHistory: () => void;
  onOpenManage: () => void;
};

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function mod2Pi(a: number): number {
  return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

/** Word-wrap for canvas.measureText — max width along the tangent at the label radius */
function wrapLabelToLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [""];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  const flushLine = (): void => {
    if (line) {
      lines.push(line);
      line = "";
    }
  };

  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      line = trial;
      continue;
    }
    flushLine();
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }
    let chunk = "";
    for (const ch of word) {
      const t = chunk + ch;
      if (ctx.measureText(t).width <= maxWidth) chunk = t;
      else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    line = chunk;
  }
  flushLine();
  return lines.length ? lines : [trimmed];
}

/**
 * Draws every character of label inside wedge: shrinks font, then tightens line spacing only if necessary.
 */
function drawLabelInWedge(
  ctx: CanvasRenderingContext2D,
  name: string,
  sector: number,
  r: number,
  size: number
): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const rimPad = Math.max(10, Math.round(size * 0.034));
  const outerR = r - rimPad;
  const innerR = r * 0.28;
  const radialBudget = Math.max(outerR - innerR, 36);

  const paint = (lines: string[], midRVal: number, lead: number) => {
    const baseY = -midRVal;
    const mid = (lines.length - 1) / 2;
    lines.forEach((ln, idx) => ctx.fillText(ln, 0, baseY + (idx - mid) * lead));
  };

  for (let fontPx = 13; fontPx >= 8; fontPx--) {
    ctx.font = `bold ${fontPx}px sans-serif`;
    const lineLeading = Math.max(Math.round(fontPx * 1.14), fontPx + 3);
    const midR = (innerR + outerR) / 2;
    const maxLabelWidth =
      sector >= Math.PI - 1e-3 ? r * 0.76 : Math.max(22, 2 * Math.sin(sector / 2) * midR * 0.97);
    const lines = wrapLabelToLines(ctx, name, maxLabelWidth);
    const blockHeight = lines.length * lineLeading;
    if (blockHeight <= radialBudget * 0.98) {
      paint(lines, midR, lineLeading);
      return;
    }
  }

  ctx.font = "bold 8px sans-serif";
  const midR = (innerR + outerR) / 2;
  const maxLabelWidth =
    sector >= Math.PI - 1e-3 ? r * 0.76 : Math.max(20, 2 * Math.sin(sector / 2) * midR * 0.97);
  const lines = wrapLabelToLines(ctx, name, maxLabelWidth);
  const lineLeading =
    radialBudget / Math.max(lines.length * 1.02, 1);
  paint(lines, midR, lineLeading);
}

export function Spinner({ onSavedToLedger, onOpenHistory }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [options, setOptions] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSpinnerOptions();
      setOptions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 600;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const outerMargin = Math.max(14, Math.round(size * 0.022));
    const r = size / 2 - outerMargin;
    const n = Math.max(options.length, 1);
    const sector = (2 * Math.PI) / n;
    const colors = [
      "#1976d2",
      "#9c27b0",
      "#2e7d32",
      "#ed6c02",
      "#d32f2f",
      "#0288d1",
      "#5d4037",
      "#455a64",
    ];

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotationRef.current);

    for (let i = 0; i < n; i++) {
      const start = i * sector - Math.PI / 2;
      const end = start + sector;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length] ?? "#999";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      const labelAngle = start + sector / 2;
      const name = options[i]?.name ?? `Slot ${i + 1}`;
      ctx.save();
      ctx.rotate(labelAngle + Math.PI / 2);
      ctx.fillStyle = "#fff";
      drawLabelInWedge(ctx, name, sector, r, size);
      ctx.restore();
    }

    ctx.restore();

    const ptrTop = Math.round(size * 0.024);
    const ptrHalfW = Math.round(size * 0.038);
    const ptrDepth = Math.round(size * 0.072);
    ctx.beginPath();
    ctx.moveTo(cx, ptrTop);
    ctx.lineTo(cx - ptrHalfW, ptrTop + ptrDepth);
    ctx.lineTo(cx + ptrHalfW, ptrTop + ptrDepth);
    ctx.closePath();
    ctx.fillStyle = "#333";
    ctx.fill();
  }, [options]);

  useEffect(() => {
    draw();
  }, [draw, options]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const stopAnim = () => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  };

  const spin = () => {
    if (spinning || options.length === 0) return;

    const n = options.length;
    const winnerIndex = Math.floor(Math.random() * n);
    const sector = (2 * Math.PI) / n;
    const thetaTargetMod = mod2Pi(-(winnerIndex + 0.5) * sector);
    const startRotation = rotationRef.current;
    const startMod = mod2Pi(startRotation);
    let delta = mod2Pi(thetaTargetMod - startMod);
    if (delta < 0.2) delta += 2 * Math.PI;
    const fullTurns = 5 + Math.floor(Math.random() * 3);
    const endRotation = startRotation + fullTurns * 2 * Math.PI + delta;
    const durationMs = 4500 + Math.random() * 1200;
    const startTs = performance.now();

    setSpinning(true);
    stopAnim();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTs) / durationMs);
      const eased = easeOutCubic(t);
      rotationRef.current = startRotation + (endRotation - startRotation) * eased;
      draw();
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        rotationRef.current = endRotation;
        draw();
        setSpinning(false);
        setWinner(options[winnerIndex] ?? null);
        setModalOpen(true);
        animRef.current = null;
      }
    };

    animRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => stopAnim(), []);

  return (
    <Stack spacing={2} alignItems="center" sx={{ width: "100%" }}>
      <Box sx={{ textAlign: "center", width: "100%" }}>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
          Lunch spinner
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
          Full venue names wrap in each slice — font stays 13px when it fits and scales down slightly if needed so nothing is clipped.
        </Typography>
      </Box>
      {error && (
        <Alert severity="error" sx={{ width: "100%" }}>
          {error}
          <Button onClick={() => void load()} size="small">
            Retry
          </Button>
        </Alert>
      )}
      {loading && (
        <Box py={6}>
          <CircularProgress />
        </Box>
      )}
      {!loading && !error && (
        <>
          <Box position="relative" sx={{ bgcolor: "#fafafa", borderRadius: 2, p: 1 }}>
            <canvas ref={canvasRef} />
          </Box>
          {options.length > 0 && (
            <Box
              sx={{
                width: "100%",
                maxWidth: 560,
                alignSelf: "center",
                bgcolor: "action.hover",
                p: 2,
                borderRadius: 2,
                borderLeft: 4,
                borderColor: "primary.main",
                borderStyle: "solid",
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Long name preview — full text, same treatment as slices (wheel may shrink font to fit wedge)
              </Typography>
              <Typography
                component="div"
                sx={{
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "sans-serif",
                  lineHeight: 1.35,
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
              >
                {LONG_LABEL_PREVIEW}
              </Typography>
            </Box>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              variant="contained"
              size="large"
              onClick={spin}
              disabled={spinning || options.length === 0}
            >
              {spinning ? "Spinning…" : "Spin"}
            </Button>
            <Button variant="outlined" onClick={() => void load()} disabled={spinning}>
              Reload options
            </Button>
            <Button variant="text" onClick={onOpenManage}>
              Manage restaurants
            </Button>
            <Button variant="text" onClick={onOpenHistory}>
              View ledger
            </Button>
          </Stack>
          {options.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No restaurants in the database yet. Run backend seed and migrations.
            </Typography>
          )}
        </>
      )}
      <SplitModal
        open={modalOpen}
        restaurant={winner}
        onClose={() => {
          setModalOpen(false);
          setWinner(null);
        }}
        onSuccess={() => {
          setModalOpen(false);
          setWinner(null);
          onSavedToLedger();
        }}
      />
    </Stack>
  );
}
