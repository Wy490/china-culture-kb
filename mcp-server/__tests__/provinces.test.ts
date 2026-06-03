import { describe, it, expect } from 'vitest';
import { PROVINCES, resolveProvinceFile, findProvinceByName } from '../src/lib/provinces.js';

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
});