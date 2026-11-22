import { AiSetupError } from "./firebase";
import { PrivacyBlockedError } from "./router";
import { firebaseConfig } from "$lib/config";

export interface FriendlyError {
  title: string;
  detail: string;
  hint: string;
  kind:
    | "setup"
    | "privacy"
    | "device"
    | "app-check"
    | "quota"
    | "network"
    | "unavailable"
    | "unknown";
}

/**
 * The AI Logic proxy answers with a Google-style error body, and the SDK wraps
 * every HTTP failure as `Error fetching from <url>: [400] <body>`. That string
 * contains "fetch", so the generic buckets below have to come after the
 * specific HTTP ones or a bad key gets reported as "you are offline".
 */
export function describeAiError(error: unknown): FriendlyError {
  if (error instanceof AiSetupError) {
    return {
      kind: "setup",
      title: "Firebase AI Logic is not configured",
      detail: error.message,
      hint: "Open Setup & API keys and add the missing values to .env, then restart the dev server.",
    };
  }

  if (error instanceof PrivacyBlockedError) {
    return {
      kind: "privacy",
      title: "Blocked by the Privacy Router",
      detail: `${error.notes.join(", ")} ${error.notes.length === 1 ? "is" : "are"} marked Private, so ${
        error.notes.length === 1 ? "it was" : "they were"
      } not sent anywhere.`,
      hint: "Change a note to Shareable if you want to include it in a cloud request.",
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const project = firebaseConfig().projectId;

  // 400 API_KEY_INVALID — the key string itself is not a usable Firebase web key.
  if (
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("api-key not valid") ||
    lower.includes("api key is invalid") ||
    lower.includes("api key expired")
  ) {
    return {
      kind: "setup",
      title: "Firebase rejected the API key",
      detail: message,
      hint: `VITE_FIREBASE_API_KEY must be the Web app apiKey from Project settings → General → Your apps (it starts with "AIza" and is 39 characters)${
        project ? ` and must belong to ${project}` : ""
      }. Re-copy it from that config block, keep it alone on one line (VITE_FIREBASE_API_KEY=AIza…), then stop and restart npm run dev. If it still fails, open Google Cloud → APIs & Services → Credentials: the key must exist in that project (not deleted or regenerated) and allow the Firebase AI Logic API.`,
    };
  }

  if (
    lower.includes("service_disabled") ||
    lower.includes("has not been used in project") ||
    lower.includes("api has not been used")
  ) {
    return {
      kind: "setup",
      title: "Firebase AI Logic is not enabled",
      detail: message,
      hint: "Open the Firebase console → Build → AI Logic → Get started and finish the guided setup for this project (it enables the APIs the proxy needs), then retry.",
    };
  }

  if (
    lower.includes("app check") ||
    lower.includes("appcheck") ||
    lower.includes("app-check")
  ) {
    return {
      kind: "app-check",
      title: "App Check rejected the request",
      detail: message,
      hint: "App Check is enforced for AI Logic. Set VITE_APPCHECK_SITE_KEY, and on localhost set VITE_APPCHECK_DEBUG_TOKEN=true then safelist the debug token in the Firebase console.",
    };
  }

  if (
    lower.includes("permission_denied") ||
    lower.includes("permission denied") ||
    lower.includes("caller does not have permission")
  ) {
    return {
      kind: "setup",
      title: "This API key belongs to a different project",
      detail: message,
      hint: `Firebase matched the request to a project it will not authorise. Copy apiKey, projectId and appId together from one config block${
        project ? ` (you are sending projectId "${project}")` : ""
      }, and confirm the Web app is registered in that same Firebase project.`,
    };
  }

  if (
    lower.includes("quota") ||
    lower.includes("429") ||
    lower.includes("rate limit")
  ) {
    return {
      kind: "quota",
      title: "Cloud quota reached",
      detail: message,
      hint: "Wait a moment or check Firebase AI Logic usage and quotas in the Firebase console.",
    };
  }

  if (
    lower.includes("503") ||
    lower.includes("service unavailable") ||
    lower.includes("overloaded") ||
    lower.includes("internal error") ||
    lower.includes("500 ")
  ) {
    return {
      kind: "unavailable",
      title: "Firebase had a temporary problem",
      detail: message,
      hint: "The request reached Firebase but the service could not answer. Retry in a moment; local search and on-device features are unaffected.",
    };
  }

  if (
    lower.includes("on-device") ||
    lower.includes("on device") ||
    lower.includes("prompt api") ||
    lower.includes("language model") ||
    lower.includes("device model")
  ) {
    return {
      kind: "device",
      title: "The on-device model is unavailable",
      detail: message,
      hint: "Private notes never fall back to the cloud. Use Chrome 139+ on desktop, enable the Prompt API flag at chrome://flags, and download the model from the status chip in the header.",
    };
  }

  // Only genuine transport failures: the SDK's `Error fetching from …` wrapper
  // is an HTTP status, not a lost connection.
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("err_internet_disconnected") ||
    lower.includes("err_name_not_resolved") ||
    lower.includes("offline")
  ) {
    return {
      kind: "network",
      title: "The cloud call could not reach Firebase",
      detail: message,
      hint: "Cloud features need a connection. Local search and on-device features keep working offline.",
    };
  }

  return {
    kind: "unknown",
    title: "Something went wrong",
    detail: message,
    hint: "Check the browser console for the full error, and confirm your Firebase project has AI Logic enabled.",
  };
}
