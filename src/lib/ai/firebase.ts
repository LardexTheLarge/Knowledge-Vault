import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";
import {
  CustomProvider,
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
  if (!siteKey && debug === undefined) return;

  if (debug !== undefined) {
    // Must be set before App Check is initialized. The SDK then uses the debug
    // provider for every token request instead of the reCAPTCHA provider below,
    // and prints the token it generated (`true`) or uses the one you pasted.
    (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debug;
  }

  initializeAppCheck(app, {
    // App Check calls `provider.initialize()` even in debug mode, and the
    // reCAPTCHA Enterprise provider loads reCAPTCHA right there. With no site
    // key that throws "Missing required parameters: sitekey", so use an inert
    // provider: its getToken() is never reached while the debug token is active.
    provider: siteKey
      ? new ReCaptchaEnterpriseProvider(siteKey)
      : new CustomProvider({
          getToken: () =>
            Promise.reject(new Error("App Check runs in debug-only mode")),
        }),
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
