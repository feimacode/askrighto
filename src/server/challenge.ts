/**
 * Domain check for the ChatGPT plugin portal: `GET /.well-known/openai-apps-challenge` answers with
 * the token the portal shows us. The token is a deployment secret (ASKRIGHTO_OPENAI_CHALLENGE), never
 * committed; with no token the route does not exist.
 */
export const CHALLENGE_PATH = "/.well-known/openai-apps-challenge";

export interface ChallengeResponse {
  status: 200 | 404;
  body: string;
}

export function challengeResponse(
  env: NodeJS.ProcessEnv = process.env,
): ChallengeResponse {
  const token = env.ASKRIGHTO_OPENAI_CHALLENGE?.trim();
  return token
    ? { status: 200, body: token }
    : { status: 404, body: "Not found" };
}

/**
 * Domain check for Google's Connected Apps preview: `GET /.well-known/google-connected-apps` answers
 * with the JSON file the Connected Console gives us (`google-connected-apps.json`). The content is a
 * deployment setting (ASKRIGHTO_GOOGLE_CONNECTED_APPS), never committed; unset means 404. Google needs
 * HTTP 200 with no redirects.
 */
export const GOOGLE_CONNECTED_APPS_PATH = "/.well-known/google-connected-apps";

export interface GoogleChallengeResponse {
  status: 200 | 404;
  body: string;
  type: "application/json" | "text/plain";
}

export function googleConnectedAppsResponse(
  env: NodeJS.ProcessEnv = process.env,
): GoogleChallengeResponse {
  const raw = env.ASKRIGHTO_GOOGLE_CONNECTED_APPS?.trim();
  if (raw) {
    try {
      JSON.parse(raw);
      return { status: 200, body: raw, type: "application/json" };
    } catch {
      // Not JSON: serve nothing rather than a broken file.
    }
  }
  return { status: 404, body: "Not found", type: "text/plain" };
}
