import { apiGet } from './client'
import type {
  AIModelProfile,
  GearsExecutionConfigInfo,
  GearsExecutionContractInfo,
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

export function getGearsExecutionConfig() {
  return apiGet<GearsExecutionConfigInfo>('/system/gears-execution-config')
}

export function getGearsExecutionContract() {
  return apiGet<GearsExecutionContractInfo>('/system/gears-execution-contract')
}

export function getSeedanceProviderAdapterConfig() {
  return apiGet<SeedanceProviderAdapterConfigInfo>('/system/seedance-provider-config')
}

export function getSeedanceProviderAdapterContract() {
  return apiGet<SeedanceProviderAdapterContractInfo>('/system/seedance-provider-adapter-contract')
}
