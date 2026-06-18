import { apiGet } from './client'
import type {
  AIModelProfile,
  NarrativePatternCatalog,
  ProvinceInfo,
  SeedanceProviderAdapterContractInfo,
  SeedanceProviderAdapterConfigInfo,
  TypeInfo,
} from '@shared/types'

export function getProvinces() {
  return apiGet<ProvinceInfo[]>('/system/provinces')
}

export function getTypes() {
  return apiGet<TypeInfo[]>('/system/types')
}

export function getRegions(province: string) {
  return apiGet<string[]>(`/system/regions?province=${encodeURIComponent(province)}`)
}

export function getModelProfiles() {
  return apiGet<AIModelProfile[]>('/system/models')
}

export function getNarrativePatternCatalog() {
  return apiGet<NarrativePatternCatalog>('/system/narrative-patterns')
}

export function getSeedanceProviderAdapterConfig() {
  return apiGet<SeedanceProviderAdapterConfigInfo>('/system/seedance-provider-config')
}

export function getSeedanceProviderAdapterContract() {
  return apiGet<SeedanceProviderAdapterContractInfo>('/system/seedance-provider-adapter-contract')
}
