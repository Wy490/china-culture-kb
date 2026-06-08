import type { ApiResponse } from '@shared/types'
import { fail, ErrorCodes } from '@shared/types'

const API_BASE = '/api'

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }
  try {
    const res = await fetch(url)
    return res.json() as Promise<ApiResponse<T>>
  } catch (err: any) {
    return fail<T>(ErrorCodes.INTERNAL_ERROR, err.message || '网络请求失败')
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json() as Promise<ApiResponse<T>>
  } catch (err: any) {
    return fail<T>(ErrorCodes.INTERNAL_ERROR, err.message || '网络请求失败')
  }
}