import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { api } from "./routes.js";

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use("/api/auth", toNodeHandler(auth));
app.use("/api/laboratory-profile/logo", express.json({ limit: "8mb" }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.send("Laboratory Backend Server is running!");
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", api);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  if (error instanceof Error && error.name === "ZodError") {
    const zodError = error as Error & { issues?: Array<{ path: Array<string | number>; message: string }> };
    const firstIssue = zodError.issues?.[0];
    const field = firstIssue?.path?.length ? firstIssue.path.join(".") : "Request";
    res.status(400).json({
      error: firstIssue ? `${field}: ${firstIssue.message}` : "Invalid request data",
    });
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT || 8000);
app.listen(port, () => {
  console.log(`Laboratory backend listening on port ${port}`);
});
