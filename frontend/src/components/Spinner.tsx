import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { scaleOrdinal, schemeTableau10 } from "d3";
import type { Restaurant } from "../types";
import {
  createRestaurant,
  deleteRestaurant,
  fetchRestaurants,
  fetchSpinnerOptions,
  updateRestaurant,
} from "../api";
import { SplitModal } from "./SplitModal";

type Props = {
  onSavedToLedger: () => void;
  onOpenHistory: () => void;
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<Restaurant[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [canvasSize, setCanvasSize] = useState(760);
  const rotationRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setError(null);
    try {
      const list = await fetchSpinnerOptions();
      setOptions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const loadRestaurants = useCallback(async () => {
    setLoadingList(true);
    setActionError(null);
    try {
      const list = await fetchRestaurants();
      setRestaurants(list);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to load restaurants");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadOptions(), loadRestaurants()]);
  }, [loadOptions, loadRestaurants]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const clampSize = () => {
      const style = window.getComputedStyle(node);
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const width = Math.max(0, node.clientWidth - paddingX);
      const height = Math.max(0, node.clientHeight - paddingY);
      setCanvasSize(Math.max(360, Math.min(760, Math.min(width, height))));
    };

    clampSize();
    const observer = new ResizeObserver(clampSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = canvasSize;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const outerMargin = Math.max(18, Math.round(size * 0.024));
    const r = size / 2 - outerMargin;
    const n = Math.max(options.length, 1);
    const sector = (2 * Math.PI) / n;
    const colorScale = scaleOrdinal(schemeTableau10).domain(options.map((restaurant) => restaurant.id.toString()));

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(rotationRef.current);

    for (let i = 0; i < n; i++) {
      const start = i * sector - Math.PI / 2;
      const end = start + sector;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = (colorScale(options[i]?.id.toString()) as string) ?? "#999";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      const labelAngle = start + sector / 2;
      const nameLabel = options[i]?.name ?? `Slot ${i + 1}`;
      ctx.save();
      ctx.rotate(labelAngle + Math.PI / 2);
      ctx.fillStyle = "#fff";
      drawLabelInWedge(ctx, nameLabel, sector, r, size);
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
  }, [canvasSize, options]);

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

  const handleSaveRestaurant = async () => {
    if (!name.trim() || !cuisine.trim()) {
      setActionError("Name and cuisine are required.");
      return;
    }

    setSaving(true);
    setActionError(null);

    try {
      if (editingId != null) {
        await updateRestaurant(editingId, name.trim(), cuisine.trim());
      } else {
        await createRestaurant(name.trim(), cuisine.trim());
      }
      setName("");
      setCuisine("");
      setEditingId(null);
      await loadAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to save restaurant");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (restaurant: Restaurant) => {
    setEditingId(restaurant.id);
    setName(restaurant.name);
    setCuisine(restaurant.cuisine);
    setActionError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this restaurant?")) return;
    setSaving(true);
    setActionError(null);
    try {
      await deleteRestaurant(id);
      if (editingId === id) {
        setEditingId(null);
        setName("");
        setCuisine("");
      }
      await loadAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to delete restaurant");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setCuisine("");
    setActionError(null);
  };

  const handleOpenManager = () => setManagerOpen(true);
  const handleCloseManager = () => setManagerOpen(false);

  const renderManagementPanel = (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Typography variant="h6">Manage options</Typography>
      <Typography variant="body2" color="text.secondary">
        Add or edit restaurants here. The spinner uses the full live list.
      </Typography>

      <Stack spacing={1}>
        <TextField
          label="Restaurant name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Cuisine"
          value={cuisine}
          onChange={(event) => setCuisine(event.target.value)}
          size="small"
          fullWidth
        />
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="small"
            onClick={handleSaveRestaurant}
            disabled={saving}
            sx={{ flex: 1 }}
          >
            {editingId != null ? "Update" : "Add"}
          </Button>
          {editingId != null ? (
            <Button variant="outlined" size="small" onClick={handleCancelEdit} disabled={saving}>
              Cancel
            </Button>
          ) : null}
        </Stack>
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Typography variant="subtitle2">Active options ({restaurants.length})</Typography>
      <List dense disablePadding sx={{ maxHeight: 420, overflowY: "auto" }}>
        {restaurants.map((restaurant) => (
          <ListItem key={restaurant.id} divider>
            <ListItemText
              primary={restaurant.name}
              secondary={restaurant.cuisine}
              primaryTypographyProps={{ fontWeight: 700 }}
            />
            <ListItemSecondaryAction>
              <IconButton edge="end" size="small" onClick={() => handleEdit(restaurant)}>
                <Edit fontSize="small" />
              </IconButton>
              <IconButton
                edge="end"
                size="small"
                color="error"
                onClick={() => void handleDelete(restaurant.id)}
              >
                <Delete fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Stack>
  );

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

  const isLoading = loadingOptions || loadingList;

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Box sx={{ textAlign: "center", width: "100%" }}>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
          Lunch spinner
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
          Spin from your live restaurant list and manage options directly on the same screen.
        </Typography>
      </Box>

      {(error || actionError) && (
        <Alert severity="error" sx={{ width: "100%" }}>
          {error ?? actionError}
          <Button onClick={() => void loadAll()} size="small" sx={{ ml: 1 }}>
            Retry
          </Button>
        </Alert>
      )}

      {isLoading ? (
        <Box py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
          <Box
            ref={wrapperRef}
            sx={{
              flex: 2,
              minWidth: 0,
              width: "100%",
              minHeight: 520,
              height: { xs: "min(70vw, 520px)", md: "min(75vh, 760px)" },
              bgcolor: "#fafafa",
              borderRadius: 3,
              p: 2,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <canvas ref={canvasRef} style={{ display: "block" }} />
          </Box>

          {isMobile ? (
            <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <Button variant="outlined" onClick={handleOpenManager}>
                Manage options
              </Button>
              <Dialog open={managerOpen} onClose={handleCloseManager} fullWidth maxWidth="sm" fullScreen={isMobile}>
                <DialogTitle>Manage restaurants</DialogTitle>
                <DialogContent>{renderManagementPanel}</DialogContent>
                <DialogActions>
                  <Button onClick={handleCloseManager}>Close</Button>
                </DialogActions>
              </Dialog>
            </Box>
          ) : (
            <Box
              sx={{
                flex: 1,
                minWidth: 280,
                maxWidth: 380,
                width: "100%",
                bgcolor: "background.paper",
                borderRadius: 3,
                p: 3,
                boxShadow: 1,
                boxSizing: "border-box",
              }}
            >
              {renderManagementPanel}
            </Box>
          )}
        </Stack>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
        <Button variant="contained" size="large" onClick={spin} disabled={spinning || options.length === 0}>
          {spinning ? "Spinning…" : "Spin"}
        </Button>
        <Button variant="outlined" onClick={() => void loadAll()} disabled={spinning}>
          Reload options
        </Button>
        <Button variant="text" onClick={onOpenHistory}>
          View ledger
        </Button>
        {isMobile ? (
          <Button variant="outlined" onClick={handleOpenManager}>
            Manage options
          </Button>
        ) : null}
      </Stack>

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
