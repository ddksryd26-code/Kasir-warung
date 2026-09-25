import { getAuth } from "@clerk/express";

export const CLERK_AUTH_PROVIDER_HEADER = "x-clerk-auth-provider";

export type ClerkAuthProvider = "replit" | "external";

export function getClerkAuthProvider(req: Parameters<typeof getAuth>[0]): ClerkAuthProvider {
  return req.header(CLERK_AUTH_PROVIDER_HEADER) === "external" ? "external" : "replit";
}

export function scopeClerkUserId(userId: string, provider: ClerkAuthProvider): string {
  return provider === "external" ? `external:${userId}` : userId;
}

export function getAppUserId(req: Parameters<typeof getAuth>[0]): string | null {
  try {
    const userId = getAuth(req).userId;
    return userId ? scopeClerkUserId(userId, getClerkAuthProvider(req)) : null;
  } catch {
    return null;
  }
}