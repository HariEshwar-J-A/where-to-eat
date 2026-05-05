import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { spinnerRouter } from "./routes/spinner";
import { historyRouter } from "./routes/history";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const uploadsPath = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(uploadsPath));

app.use("/api", spinnerRouter);
app.use("/api", historyRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Fair Share Roulette API listening on http://localhost:${PORT}`);
});
