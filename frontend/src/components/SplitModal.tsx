import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import type { Restaurant } from "../types";
import { postHistory } from "../api";

type Row = { personName: string; amountOwed: string; paid: boolean };

type Props = {
  open: boolean;
  restaurant: Restaurant | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function SplitModal({ open, restaurant, onClose, onSuccess }: Props) {
  const [totalBill, setTotalBill] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { personName: "", amountOwed: "", paid: false },
  ]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reset = () => {
    setTotalBill("");
    setRows([{ personName: "", amountOwed: "", paid: false }]);
    setFile(null);
    setMsg(null);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const addRow = () => setRows((r) => [...r, { personName: "", amountOwed: "", paid: false }]);
  const removeRow = (index: number) =>
    setRows((r) => (r.length > 1 ? r.filter((_, i) => i !== index) : r));

  const updateRow = (index: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = async () => {
    if (!restaurant) return;

    const splitsPayload = rows
      .filter((row) => row.personName.trim().length > 0)
      .map((row) => ({
        personName: row.personName.trim(),
        amountOwed: Number.parseFloat(row.amountOwed || "0"),
        paid: row.paid,
      }));

    if (!Number.isFinite(Number.parseFloat(totalBill))) {
      setMsg("Enter a valid total bill amount.");
      return;
    }
    if (splitsPayload.length === 0) {
      setMsg("Add at least one team member with a name.");
      return;
    }
    if (!file) {
      setMsg("Attach a receipt file.");
      return;
    }

    const form = new FormData();
    form.append("restaurantId", String(restaurant.id));
    form.append("totalAmount", totalBill);
    form.append("splits", JSON.stringify(splitsPayload));
    form.append("receipt", file);

    setSaving(true);
    setMsg(null);
    try {
      await postHistory(form);
      reset();
      onSuccess();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{restaurant ? `Split bill — ${restaurant.name}` : "Split bill"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {msg && <Alert severity="error">{msg}</Alert>}
          <TextField
            label="Total bill"
            type="number"
            fullWidth
            value={totalBill}
            onChange={(e) => setTotalBill(e.target.value)}
            inputProps={{ step: "0.01", min: "0" }}
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Who owes what
            </Typography>
            {rows.map((row, idx) => (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                key={idx}
                alignItems={{ sm: "center" }}
                sx={{ mb: 1 }}
              >
                <TextField
                  label="Name"
                  value={row.personName}
                  onChange={(e) => updateRow(idx, { personName: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Owes ($)"
                  type="number"
                  value={row.amountOwed}
                  onChange={(e) => updateRow(idx, { amountOwed: e.target.value })}
                  sx={{ width: { sm: 120 } }}
                  inputProps={{ step: "0.01", min: "0" }}
                />
                <FormControlLabel
                  sx={{ mr: 0 }}
                  control={
                    <Checkbox
                      checked={row.paid}
                      onChange={(e) => updateRow(idx, { paid: e.target.checked })}
                    />
                  }
                  label="Paid"
                />
                <IconButton aria-label="remove row" onClick={() => removeRow(idx)} disabled={rows.length <= 1}>
                  <RemoveIcon />
                </IconButton>
              </Stack>
            ))}
            <Button startIcon={<AddIcon />} onClick={addRow}>
              Add person
            </Button>
          </Box>

          <Divider />

          <Button variant="outlined" component="label">
            Choose receipt image
            <input
              type="file"
              name="receipt"
              hidden
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Button>
          {file && (
            <Typography variant="caption" display="block">
              Selected: {file.name}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={saving || !restaurant}>
          {saving ? "Saving…" : "Save to Ledger"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
