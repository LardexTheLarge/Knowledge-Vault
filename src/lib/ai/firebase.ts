import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import {
  appCheckDebugToken,
  appCheckSiteKey,
  firebaseConfig,
  isFirebaseConfigured,
  missingFirebaseVars,
} from "$lib/config";

export class AiSetupError extends Error {
  missing: string[];

  constructor(missing: string[]) {
    super(
      missing.length > 0
        ? `Firebase AI Logic is not configured yet. Add ${missing.join(", ")} to .env and restart the dev server.`
        : "Firebase AI Logic is not configured yet.",
    );
    this.name = "AiSetupError";
    this.missing = missing;
  }
}

let cachedApp: FirebaseApp | null = null;
let cachedAI: AI | null = null;
let appCheckReady = false;

function ensureAppCheck(app: FirebaseApp): void {
  if (appCheckReady) return;
  const siteKey = appCheckSiteKey();
  const debug = appCheckDebugToken();

  // App Check is enforced for AI Logic, so activate it whenever a site key or a
  // debug token exists. Firebase supports enforcement with only the debug
  // provider, which is the normal localhost setup.
  if (!siteKey && !debug) return;

  if (debug) {
    // Must be set before App Check is initialized. The SDK then uses the debug
    // provider for every token request instead of the reCAPTCHA provider below.
    (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debug === "true" ? true : debug;
  }

  initializeAppCheck(app, {
    // Unused while a debug token is active; reCAPTCHA Enterprise needs a real
    // site key, which a localhost-only setup usually does not have yet.
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckReady = true;
}

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  if (!isFirebaseConfigured()) throw new AiSetupError(missingFirebaseVars());

  const existing = getApps()[0];
  cachedApp = existing ?? initializeApp(firebaseConfig());
  ensureAppCheck(cachedApp);
  return cachedApp;
}

export function getFirebaseAI(): AI {
  if (cachedAI) return cachedAI;
  cachedAI = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
  return cachedAI;
}
