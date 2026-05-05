import path from "path";
import { Router } from "express";
import multer from "multer";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../prisma";

const uploadDir = path.join(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const safe = `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, "_")}`;
    cb(null, safe);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const historyRouter = Router();

type SplitPayload = {
  personName?: string;
  amountOwed?: number | string;
  paid?: boolean;
};

historyRouter.get("/history", async (_req, res) => {
  try {
    const visits = await prisma.visitHistory.findMany({
      orderBy: { date: "desc" },
      include: {
        restaurant: true,
        splits: true,
      },
    });
    const serialized = visits.map((v) => ({
      id: v.id,
      date: v.date.toISOString(),
      totalAmount: v.totalAmount.toString(),
      receiptFileUrl: v.receiptFileUrl,
      restaurant: {
        id: v.restaurant.id,
        name: v.restaurant.name,
        cuisine: v.restaurant.cuisine,
      },
      splits: v.splits.map((s) => ({
        personName: s.personName,
        amountOwed: s.amountOwed.toString(),
        paid: s.paid,
      })),
    }));
    res.json({ visits: serialized });
  } catch (e) {
    console.error("GET /history", e);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

/**
 * multipart: receipt (file), restaurantId, totalAmount, splits (JSON array string)
 */
historyRouter.post(
  "/history",
  upload.single("receipt"),
  async (req, res) => {
    try {
      const restaurantId = Number(req.body.restaurantId);
      const totalAmountRaw = req.body.totalAmount;

      if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
        return res.status(400).json({ error: "Invalid restaurantId" });
      }

      let splitsPayload: SplitPayload[];
      try {
        const parsed = JSON.parse(String(req.body.splits ?? "[]"));
        splitsPayload = Array.isArray(parsed) ? parsed : [];
      } catch {
        return res.status(400).json({ error: "Invalid splits JSON" });
      }

      if (splitsPayload.length === 0) {
        return res.status(400).json({ error: "At least one split row required" });
      }

      let totalBill: Decimal;
      try {
        totalBill = new Decimal(String(totalAmountRaw));
      } catch {
        return res.status(400).json({ error: "Invalid totalAmount" });
      }

      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
      });
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const splitsParsed = splitsPayload.map((row, idx) => {
        const name = typeof row.personName === "string" ? row.personName.trim() : "";
        let owed: Decimal;
        try {
          owed = new Decimal(row.amountOwed ?? 0);
        } catch {
          throw new Error(`Invalid amount row ${idx + 1}`);
        }
        if (!name.length) throw new Error(`Missing name row ${idx + 1}`);
        return {
          personName: name,
          amountOwed: owed,
          paid: Boolean(row.paid),
        };
      }).filter((row) => row.personName.length > 0);

      if (!splitsParsed.length) {
        return res.status(400).json({ error: "No valid splits" });
      }

      let receiptUrl: string | null = null;
      if (req.file) {
        receiptUrl = `/uploads/${req.file.filename}`;
      }

      await prisma.$transaction(async (tx) => {
        await tx.visitHistory.create({
          data: {
            restaurantId,
            totalAmount: totalBill,
            receiptFileUrl: receiptUrl,
            splits: {
              createMany: {
                data: splitsParsed.map((s) => ({
                  personName: s.personName,
                  amountOwed: s.amountOwed,
                  paid: s.paid,
                })),
              },
            },
          },
        });

        await tx.restaurant.update({
          where: { id: restaurantId },
          data: { lastVisited: new Date() },
        });
      });

      return res.status(201).json({ ok: true });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Invalid amount")) {
        return res.status(400).json({ error: e.message });
      }
      if (e instanceof Error && e.message.includes("Missing name")) {
        return res.status(400).json({ error: e.message });
      }
      console.error("POST /history", e);
      return res.status(500).json({ error: "Failed to save visit" });
    }
  }
);
