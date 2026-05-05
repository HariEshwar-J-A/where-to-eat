import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { fetchHistory } from "../api";

type Props = {
  refreshKey: number;
};

export function HistoryLedger({ refreshKey }: Props) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchHistory>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const visits = await fetchHistory();
      setRows(visits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const fmtCurrency = (s: string) => {
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : s;
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">History Ledger</Typography>
      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {loading && (
        <Stack alignItems="center" py={4}>
          <CircularProgress />
        </Stack>
      )}
      {!loading && !error && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Restaurant</TableCell>
                <TableCell>Cuisine</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Receipt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No visits yet.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{fmtDate(v.date)}</TableCell>
                  <TableCell>{v.restaurant.name}</TableCell>
                  <TableCell>{v.restaurant.cuisine}</TableCell>
                  <TableCell align="right">{fmtCurrency(v.totalAmount)}</TableCell>
                  <TableCell>
                    {v.receiptFileUrl ? (
                      <Link href={v.receiptFileUrl} target="_blank" rel="noopener noreferrer">
                        View / download
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
