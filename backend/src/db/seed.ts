import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "./index";
import { users } from "./schema";

const name = process.env.ADMIN_NAME;
const email = (process.env.ADMIN_EMAIL!).toLowerCase();
const password = process.env.ADMIN_PASSWORD;

async function seed() {
  if (password!.length < 8) {
    throw new Error("ADMIN_PASSWORD must contain at least 8 characters");
  }

  let user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    const created = await auth.api.signUpEmail({
      body: { name: String(name), email: String(email), password: String(password) },
    });
    if (!created?.user?.id) {
      throw new Error("Better Auth did not return a created user");
    }

    await db.update(users)
      .set({ role: "admin", active: true, emailVerified: true })
      .where(eq(users.id, created.user.id));
    user = await db.query.users.findFirst({
      where: eq(users.id, created.user.id),
    });
  } else {
    await db.update(users)
      .set({ role: "admin", active: true })
      .where(eq(users.id, user.id));
  }

  if (!user) {
    throw new Error("Unable to create or locate the admin user");
  }

  console.log(`Admin user seeded: ${email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("No ADMIN_PASSWORD was provided; the admin user may not be able to log in.");
  }
}

seed().catch((error) => {
  console.error("Admin seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
