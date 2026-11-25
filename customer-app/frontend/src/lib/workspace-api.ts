import { api, ApiError } from './api';

// Keep the original GitHub response contracts while using the authenticated
// Spring Boot gateway and its CSRF-protected, same-origin session.
export async function workspaceFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    const body = options?.body ? JSON.parse(String(options.body)) : undefined;
    return Response.json(await api(url, body));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      window.dispatchEvent(new Event('doneeo:session-expired'));
    }
    return Response.json(
      { error: error instanceof Error ? error.message : 'Doneeo could not connect.' },
      { status: error instanceof ApiError ? error.status : 503 },
    );
  }
}
