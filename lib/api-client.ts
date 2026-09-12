/**
 * Path the API is reached through, on this origin.
 *
 * Relative on purpose: `next.config.ts` rewrites `/backend` to wherever the Nest
 * app actually runs, so the browser only ever calls the site it is already on
 * and the session cookie travels with the request. Pointing this at the API host
 * directly would work in development and silently stop sending the cookie in
 * production.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/backend";

export const apiUrl = (path: string): string =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const extractMessage = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json();
    const message = (body as { message?: unknown } | null)?.message;

    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(". ");
  } catch {}

  return response.statusText || `Request failed with status ${response.status}`;
};

const retryAfterFrom = (response: Response): number | undefined => {
  const header = response.headers.get("Retry-After");
  if (header === null) return undefined;

  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
};

export const apiFetch = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const headers = {
    ...init?.headers,
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
  };

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiError(
      await extractMessage(response),
      response.status,
      retryAfterFrom(response),
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};
