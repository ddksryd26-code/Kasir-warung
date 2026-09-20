import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWarungRouter } from "./warung";

type StoredRecord = {
  userId: string;
  state: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

function makeState(label: string) {
  return {
    menus: [{ id: `${label}-menu`, name: label, price: 10_000, recipe: {} }],
    activeOrders: [],
    kitchenOrders: [],
    inventory: [],
    consignments: [],
    expenses: [],
    sales: [],
    cashClosures: [],
    savingsRules: [],
    savingsEntries: [],
  };
}

class FakeDatabase {
  readonly records = new Map<string, StoredRecord>();
  currentUserId: string | null = null;

  select() {
    return {
      from: () => ({
        where: () => ({
          limit: async () => {
            const record = this.currentUserId ? this.records.get(this.currentUserId) : undefined;
            return record ? [record] : [];
          },
        }),
      }),
    };
  }

  insert() {
    return {
      values: (value: Omit<StoredRecord, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date }) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (!this.currentUserId || this.records.has(this.currentUserId)) return [];
            const record = { ...value };
            this.records.set(this.currentUserId, record);
            return [record];
          },
        }),
      }),
    };
  }

  update() {
    return {
      set: (patch: Partial<StoredRecord>) => ({
        where: () => ({
          returning: async () => {
            if (!this.currentUserId) return [];
            const record = this.records.get(this.currentUserId);
            if (!record || patch.version === undefined || patch.version <= record.version) return [];
            const updated = { ...record, ...patch };
            this.records.set(this.currentUserId, updated);
            return [updated];
          },
        }),
      }),
    };
  }
}

describe("warung state account isolation and versioning", () => {
  const database = new FakeDatabase();
  const app = express();
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    app.use(express.json());
    app.use(createWarungRouter({
      database: database as never,
      getUserId: (req) => {
        const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
        database.currentUserId = token || null;
        return token || null;
      },
    }));
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function request(token: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}/warung/state`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
  }

  it("keeps account A from reading or writing account B", async () => {
    const stateA = makeState("akun-a");
    const stateB = makeState("akun-b");

    expect((await request("akun-a", {
      method: "PUT",
      body: JSON.stringify({ state: stateA, baseVersion: null }),
    })).status).toBe(200);
    expect((await request("akun-b", {
      method: "PUT",
      body: JSON.stringify({ state: stateB, baseVersion: null }),
    })).status).toBe(200);

    const accountA = await request("akun-a");
    const accountB = await request("akun-b");
    const accountABody = await accountA.json() as { state: unknown };
    const accountBBody = await accountB.json() as { state: unknown };
    expect(accountABody.state).toEqual(stateA);
    expect(accountBBody.state).toEqual(stateB);

    const updatedA = makeState("akun-a-updated");
    expect((await request("akun-a", {
      method: "PUT",
      body: JSON.stringify({ state: updatedA, baseVersion: 1 }),
    })).status).toBe(200);
    const unchangedB = await (await request("akun-b")).json() as { state: unknown };
    expect(unchangedB.state).toEqual(stateB);
  });

  it("returns a conflict instead of overwriting a newer snapshot", async () => {
    const first = makeState("versi-satu");
    const second = makeState("versi-dua");
    const stale = makeState("perangkat-offline");

    expect((await request("akun-konflik", {
      method: "PUT",
      body: JSON.stringify({ state: first, baseVersion: null }),
    })).status).toBe(200);
    expect((await request("akun-konflik", {
      method: "PUT",
      body: JSON.stringify({ state: second, baseVersion: 1 }),
    })).status).toBe(200);

    const response = await request("akun-konflik", {
      method: "PUT",
      body: JSON.stringify({ state: stale, baseVersion: 1 }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "WARUNG_STATE_CONFLICT",
      state: second,
      version: 2,
    });
  });
});
