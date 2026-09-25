import { and, eq } from "drizzle-orm";
import { SaveWarungStateBody, SaveWarungStateResponse } from "@workspace/api-zod";
import { db, warungStates } from "@workspace/db";
import { Router, type IRouter } from "express";
import { getAppUserId } from "../lib/clerkAuth";

function responseFor(record: typeof warungStates.$inferSelect) {
  return SaveWarungStateResponse.parse({
    state: record.state,
    version: record.version,
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function createWarungRouter({
  database = db,
  getUserId = getAppUserId,
}: {
  database?: typeof db;
  getUserId?: (req: Parameters<typeof getAppUserId>[0]) => string | null;
} = {}) {
  const router: IRouter = Router();

  router.get("/warung/state", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const [record] = await database
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
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const parsed = SaveWarungStateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid warung state", issues: parsed.error.issues });
      return;
    }

    const [current] = await database
      .select()
      .from(warungStates)
      .where(eq(warungStates.userId, userId))
      .limit(1);

    if (current && parsed.data.baseVersion !== current.version) {
      res.status(409).json({
        error: "WARUNG_STATE_CONFLICT",
        state: current.state,
        version: current.version,
        updatedAt: current.updatedAt.toISOString(),
      });
      return;
    }

    const now = new Date();

    if (!current) {
      if (parsed.data.baseVersion !== null) {
        res.status(409).json({ error: "WARUNG_STATE_MISSING" });
        return;
      }

      const [created] = await database
        .insert(warungStates)
        .values({
          userId,
          state: parsed.data.state,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: warungStates.userId })
        .returning();

      if (created) {
        res.json(responseFor(created));
        return;
      }

      const [raceWinner] = await database
        .select()
        .from(warungStates)
        .where(eq(warungStates.userId, userId))
        .limit(1);

      if (raceWinner) {
        res.status(409).json({
          error: "WARUNG_STATE_CONFLICT",
          state: raceWinner.state,
          version: raceWinner.version,
          updatedAt: raceWinner.updatedAt.toISOString(),
        });
        return;
      }

      res.status(500).json({ error: "Warung state could not be created" });
      return;
    }

    const [updated] = await database
      .update(warungStates)
      .set({
        state: parsed.data.state,
        version: current.version + 1,
        updatedAt: now,
      })
      .where(and(
        eq(warungStates.userId, userId),
        eq(warungStates.version, current.version),
      ))
      .returning();

    if (updated) {
      res.json(responseFor(updated));
      return;
    }

    const [latest] = await database
      .select()
      .from(warungStates)
      .where(eq(warungStates.userId, userId))
      .limit(1);

    if (latest) {
      res.status(409).json({
        error: "WARUNG_STATE_CONFLICT",
        state: latest.state,
        version: latest.version,
        updatedAt: latest.updatedAt.toISOString(),
      });
      return;
    }

    res.status(409).json({ error: "WARUNG_STATE_MISSING" });
  });

  return router;
}

const router = createWarungRouter();
export default router;