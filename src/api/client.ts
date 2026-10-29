export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const OFFLINE = 'Could not reach DoodleWars. Check your connection and try again.'
const FAILED = 'Something went wrong. Try again.'

function errorMessage(body: unknown): string {
  return typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : FAILED
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : FAILED
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, init).catch(() => {
    throw new ApiError(0, OFFLINE)
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, errorMessage(body))
  return body as T
}

export function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal })
}

export function postJson<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
}

export function postForm<T>(path: string, form: FormData, method = 'POST'): Promise<T> {
  return request<T>(path, { method, body: form })
}
