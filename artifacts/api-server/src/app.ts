import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { getClerkAuthProvider } from "./lib/clerkAuth";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors());
// Image uploads are sent one at a time as base64. A 5 MB image becomes
// roughly 6.7 MB in JSON, so leave room for the request envelope.
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));
const externalClerkSecretKey = process.env.EXTERNAL_CLERK_SECRET_KEY;
const externalClerkPublishableKey = process.env.EXTERNAL_CLERK_PUBLISHABLE_KEY;
const hasExternalClerkKeys = Boolean(externalClerkSecretKey && externalClerkPublishableKey);
const hasReplitClerkKeys = Boolean(process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY);

if (hasExternalClerkKeys || hasReplitClerkKeys) {
  app.use((req, res, next) => {
    const provider = getClerkAuthProvider(req);
    if (provider === "external" && !hasExternalClerkKeys) {
      res.status(503).json({ error: "External Clerk authentication is not configured" });
      return;
    }
    if (provider === "replit" && !hasReplitClerkKeys) {
      res.status(503).json({ error: "Replit Clerk authentication is not configured" });
      return;
    }
    next();
  });

  app.use(
    clerkMiddleware((req) => ({
      ...(getClerkAuthProvider(req) === "external"
        ? {
            publishableKey: externalClerkPublishableKey,
            secretKey: externalClerkSecretKey,
          }
        : {
            publishableKey: publishableKeyFromHost(
              getClerkProxyHost(req) ?? "",
              process.env.CLERK_PUBLISHABLE_KEY,
            ),
            secretKey: process.env.CLERK_SECRET_KEY,
          }),
    })),
  );
}

app.use("/api", router);

export default app;
