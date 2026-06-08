import { apiGet, apiPost } from './client'
import type { EntrySearchResult, EntryDetail, EntryMatchResult } from '@shared/types'

export function searchEntries(params: {
  keywords?: string
  type?: string
  province?: string
  region?: string
}) {
  const qs: Record<string, string> = {}
  if (params.keywords) qs.keywords = params.keywords
  if (params.type) qs.type = params.type
  if (params.province) qs.province = params.province
  if (params.region) qs.region = params.region
  return apiGet<EntrySearchResult[]>('/entries/search', qs)
}

export function matchEntries(params: {
  query: string
  limit?: number
  preferred_province?: string
  preferred_type?: string
}) {
  return apiPost<EntryMatchResult>('/entries/match', params)
}

export function getEntryDetail(name: string) {
  return apiGet<EntryDetail>('/entries/detail', { name })
}