// Use base URL from Vite config (e.g., '/rea/' in production)
const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
export const API_BASE = `${baseUrl}/api`;

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
