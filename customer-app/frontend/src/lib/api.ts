export interface Customer {
  id: string;
  name: string;
  email: string;
}

interface Session {
  user: Customer | Record<string, never>;
  csrfToken: string;
  csrfHeader: string;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

let csrf: { token: string; header: string } | null = null;

export async function currentCustomer(): Promise<Customer | null> {
  const session = await api<Session>('/api/auth/session');
  csrf = { token: session.csrfToken, header: session.csrfHeader };
  return session.user.id ? session.user as Customer : null;
}

export async function api<T>(url: string, body?: unknown): Promise<T> {
  if (body !== undefined && !csrf) await currentCustomer();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 165_000);
  try {
    const response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? {} : {
        'Content-Type': 'application/json',
        [csrf!.header]: csrf!.token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) csrf = null;
      throw new ApiError(data?.error || 'Please try again.', response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error('Doneeo could not connect. Your request is kept here so you can retry.');
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function authenticate(
  mode: 'login' | 'register', name: string, email: string, password: string,
): Promise<Customer> {
  await currentCustomer();
  const customer = await api<Customer>('/api/auth/' + mode, { name, email, password });
  await currentCustomer();
  return customer;
}

export async function signOut(): Promise<void> {
  await api('/api/auth/logout', {});
  csrf = null;
}
