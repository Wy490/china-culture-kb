import { apiGet, apiPost } from './client'
import type { EntrySearchResult, EntryDetail, EntryMatchResult, MultiMatchResult, KnowledgeNeed } from '@shared/types'

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

// New: Multi-entry matching for story creation
export function entriesMultiMatch(params: {
  outline: string
  knowledge_needs: KnowledgeNeed[]
  limit_per_need?: number
}) {
  return apiPost<MultiMatchResult>('/entries/multi-match', params)
}