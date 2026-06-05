import { apiGet } from './client'
import type { EntrySearchResult, EntryDetail } from '@shared/types'

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

export function getEntryDetail(name: string) {
  return apiGet<EntryDetail>('/entries/detail', { name })
}