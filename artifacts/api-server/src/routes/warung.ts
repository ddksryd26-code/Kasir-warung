import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { SaveWarungStateBody, SaveWarungStateResponse } from "@workspace/api-zod";
import { db, warungStates } from "@workspace/db";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

function currentUserId(req: Parameters<typeof getAuth>[0]) {
  return getAuth(req).userId;
}

function responseFor(record: typeof warungStates.$inferSelect) {
  return SaveWarungStateResponse.parse({
    state: record.state,
    updatedAt: record.updatedAt.toISOString(),
  });
}

router.get("/warung/state", async (req, res) => {
  const userId = currentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [record] = await db
    .select()
    .from(warungStates)
    .where(eq(warungStates.userId, userId))
    .limit(1);

  if (!record) {
    res.status(404).json({ error: "Warung state not found" });
    return;
  }

  res.json(responseFor(record));
});

router.put("/warung/state", async (req, res) => {
  const userId = currentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = SaveWarungStateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid warung state", issues: parsed.error.issues });
    return;
  }

  const now = new Date();
  const [record] = await db
    .insert(warungStates)
    .values({
      userId,
      state: parsed.data.state,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: warungStates.userId,
      set: {
        state: parsed.data.state,
        updatedAt: now,
      },
    })
    .returning();

  res.json(responseFor(record));
});

export default router;