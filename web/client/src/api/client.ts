import type { ApiResponse } from '@shared/types'

const API_BASE = '/api'

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }
  const res = await fetch(url)
  return res.json() as Promise<ApiResponse<T>>
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<ApiResponse<T>>
}