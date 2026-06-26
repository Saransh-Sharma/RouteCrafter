export interface ClientApiResult<T> {
  ok: boolean;
  status: number;
  body: T & { error?: string };
}

export class ClientApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.body = body;
  }
}

export async function readJsonBody<T>(
  response: Response,
): Promise<T & { error?: string }> {
  try {
    return (await response.json()) as T & { error?: string };
  } catch {
    return {} as T & { error?: string };
  }
}

export async function requestJsonResult<T>(
  input: string,
  init?: RequestInit,
): Promise<ClientApiResult<T>> {
  const response = await fetch(input, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await readJsonBody<T>(response),
  };
}

export async function requestJson<T>(
  input: string,
  init: RequestInit | undefined,
  fallbackMessage: string,
): Promise<T & { error?: string }> {
  const result = await requestJsonResult<T>(input, init);
  if (!result.ok) {
    throw new ClientApiError(
      result.status,
      result.body.error ?? fallbackMessage,
      result.body,
    );
  }
  return result.body;
}
