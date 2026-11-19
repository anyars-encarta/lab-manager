import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { api } from "./routes";

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use("/api/auth", toNodeHandler(auth));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", api);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  if (error instanceof Error && error.name === "ZodError") {
    res.status(400).json({ error: "Invalid request data" });
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT || 8000);
app.listen(port, () => {
  console.log(`Laboratory backend listening on port ${port}`);
});
