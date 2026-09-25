const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const publishableKey = (process.env.CLERK_PUBLISHABLE_KEY || '').trim();

if (!publishableKey) {
  throw new Error(
    'CLERK_PUBLISHABLE_KEY is required for the native Expo build. Refusing to build an APK with login disabled.',
  );
}

const deploymentDomain =
  process.env.REPLIT_INTERNAL_APP_DOMAIN ||
  process.env.REPLIT_DEV_DOMAIN ||
  process.env.EXPO_PUBLIC_DOMAIN ||
  '';

const proxyPath = (process.env.CLERK_PROXY_URL || '').trim();
const proxyUrl =
  proxyPath && deploymentDomain
    ? `https://${deploymentDomain.replace(/^https?:\/\//, '')}${proxyPath}`
    : '';

const envLines = [
  `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=${publishableKey}`,
  `EXPO_PUBLIC_CLERK_AUTH_PROVIDER=${process.env.EXPO_PUBLIC_CLERK_AUTH_PROVIDER || 'replit'}`,
  `EXPO_PUBLIC_CLERK_PROXY_URL=${proxyUrl}`,
];

if (process.env.GOOGLE_OAUTH_CLIENT_ID) {
  envLines.push(`EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=${process.env.GOOGLE_OAUTH_CLIENT_ID}`);
}

fs.writeFileSync(path.join(projectRoot, '.env'), `${envLines.join('\n')}\n`, 'utf8');
console.log('Prepared Expo native build environment for Clerk authentication.');