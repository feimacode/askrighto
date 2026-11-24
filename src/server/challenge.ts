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
