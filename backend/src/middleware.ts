import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { auth } from "./auth.js";
import { db } from "./db";
import { users } from "./db/schema.js";

export type AppUser = typeof users.$inferSelect;

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });
    if (!session?.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    if (!user || !user.active) {
      res.status(403).json({ error: "Account is inactive or unavailable" });
      return;
    }
    req.appUser = user;
    next();
  } catch {
    res.status(401).json({ error: "Authentication required" });
  }
}

export function requireRole(...allowedRoles: Array<"admin" | "frontdesk" | "account" | "technician" | "doctor">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.appUser || !allowedRoles.includes(req.appUser.role)) {
      res.status(403).json({ error: "You do not have permission for this action" });
      return;
    }
    next();
  };
}
