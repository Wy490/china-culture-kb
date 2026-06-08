import { describe, it, expect } from 'vitest';
import { PROVINCES, resolveProvinceFile, findProvinceByName, normalizeProvince } from '../src/lib/provinces.js';

describe('provinces', () => {
  it('should have 34 provinces', () => {
    expect(PROVINCES.length).toBe(34);
  });

  it('should resolve province file path', () => {
    const filePath = resolveProvinceFile('北京');
    expect(filePath).toContain('provinces');
    expect(filePath).toContain('北京.md');
  });

  it('should find province by name', () => {
    expect(findProvinceByName('浙江')).toBe('浙江');
    expect(findProvinceByName('不存在的省')).toBeNull();
  });

  it('should find province by alias', () => {
    expect(findProvinceByName('内蒙古')).toBe('内蒙古');
  });

  it('should normalize pinyin slug to Chinese name', () => {
    expect(normalizeProvince('hunan')).toBe('湖南');
    expect(normalizeProvince('beijing')).toBe('北京');
    expect(normalizeProvince('shaanxi')).toBe('陕西');  // double-a for 陕西 vs 山西
    expect(normalizeProvince('HUNAN')).toBe('湖南');    // case-insensitive
    expect(normalizeProvince('未知slug')).toBeNull();
  });

  it('findProvinceByName uses normalizeProvince internally', () => {
    expect(findProvinceByName('hunan')).toBe('湖南');
    expect(findProvinceByName('湖南')).toBe('湖南');
  });
});