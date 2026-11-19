export const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('flowsys_staff_token');
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('flowsys_staff_token', token);
  } else {
    localStorage.removeItem('flowsys_staff_token');
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (typeof errorJson.detail === 'string') {
        errorDetail = errorJson.detail;
      } else if (Array.isArray(errorJson.detail)) {
        errorDetail = errorJson.detail
          .map((d: any) => d.msg || (typeof d === 'string' ? d : JSON.stringify(d)))
          .join(', ');
      } else if (errorJson.detail && typeof errorJson.detail === 'object') {
        errorDetail = JSON.stringify(errorJson.detail);
      } else if (errorJson.message) {
        errorDetail = typeof errorJson.message === 'string' ? errorJson.message : JSON.stringify(errorJson.message);
      }
    } catch {
      // Body is not JSON
    }
    throw new ApiError(response.status, errorDetail);
  }

  if (response.status === 204) {
    return null as unknown as T;
  }

  return response.json() as Promise<T>;
}
