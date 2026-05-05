import { useCallback, useState } from "react";
import {
  AppBar,
  Container,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from "@mui/material";
import { Restaurant as RestaurantIcon, History as HistoryIcon } from "@mui/icons-material";
import { Spinner } from "./components/Spinner";
import { HistoryLedger } from "./components/HistoryLedger";

type TabKey = "spinner" | "history";

function App() {
  const [tab, setTab] = useState<TabKey>("spinner");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const refreshHistory = useCallback(() => {
    setHistoryRefresh((n) => n + 1);
  }, []);

  return (
    <>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Fair Share Roulette
          </Typography>
          <Tabs
            value={tab}
            onChange={(_e, v: TabKey) => setTab(v)}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab value="spinner" icon={<RestaurantIcon />} iconPosition="start" label="Spinner" />
            <Tab value="history" icon={<HistoryIcon />} iconPosition="start" label="History" />
          </Tabs>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 3 }}>
        {tab === "spinner" && (
          <Spinner onSavedToLedger={refreshHistory} onOpenHistory={() => setTab("history")} />
        )}
        {tab === "history" && <HistoryLedger refreshKey={historyRefresh} />}
      </Container>
    </>
  );
}

export default App;
