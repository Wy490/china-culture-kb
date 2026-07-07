import type { ApiResponse } from '@shared/types'
import { fail, ErrorCodes } from '@shared/types'

const API_BASE = '/api'

type QueryParams = Record<string, string | string[]>

function buildQueryString(params: QueryParams): string {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach(item => qs.append(key, item))
    } else if (value) {
      qs.set(key, value)
    }
  })
  return qs.toString()
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<ApiResponse<T>> {
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = buildQueryString(params)
    if (qs) url += `?${qs}`
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

export async function apiPostForm<T>(path: string, body: FormData): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      body,
    })
    return res.json() as Promise<ApiResponse<T>>
  } catch (err: any) {
    return fail<T>(ErrorCodes.INTERNAL_ERROR, err.message || '网络请求失败')
  }
}

export async function apiPatch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json() as Promise<ApiResponse<T>>
  } catch (err: any) {
    return fail<T>(ErrorCodes.INTERNAL_ERROR, err.message || '网络请求失败')
  }
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
    })
    return res.json() as Promise<ApiResponse<T>>
  } catch (err: any) {
    return fail<T>(ErrorCodes.INTERNAL_ERROR, err.message || '网络请求失败')
  }
}
