import path from 'node:path';

export function getKbRoot(): string {
  return path.resolve(process.env.KB_ROOT || path.join(process.cwd(), '..', 'data'));
}

export const PROVINCES = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
  '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
  '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆', '香港',
  '澳门', '台湾',
];

// Pinyin/slug → Chinese name mapping for province normalization
const PROVINCE_SLUG_MAP: Record<string, string> = {
  beijing: '北京', tianjin: '天津', hebei: '河北', shanxi: '山西',
  neimenggu: '内蒙古', liaoning: '辽宁', jilin: '吉林', heilongjiang: '黑龙江',
  shanghai: '上海', jiangsu: '江苏', zhejiang: '浙江', anhui: '安徽',
  fujian: '福建', jiangxi: '江西', shandong: '山东', henan: '河南',
  hubei: '湖北', hunan: '湖南', guangdong: '广东', guangxi: '广西',
  hainan: '海南', chongqing: '重庆', sichuan: '四川', guizhou: '贵州',
  yunnan: '云南', xizang: '西藏', shaanxi: '陕西', gansu: '甘肃',
  qinghai: '青海', ningxia: '宁夏', xinjiang: '新疆', xianggang: '香港',
  aomen: '澳门', taiwan: '台湾',
};

export function resolveProvinceFile(province: string): string {
  return path.join(getKbRoot(), 'provinces', `${province}.md`);
}

/** Normalize a province input (Chinese name, pinyin slug, or mixed) to the
 *  canonical Chinese name used in PROVINCES & file names.
 *  Returns the canonical name if found, or null if unrecognized. */
export function normalizeProvince(input: string): string | null {
  // Direct match against PROVINCES list (Chinese name)
  const direct = PROVINCES.find(p => p === input);
  if (direct) return direct;

  // Slug/pinyin lookup (lowercase for case-insensitive matching)
  const slugHit = PROVINCE_SLUG_MAP[input.toLowerCase()];
  if (slugHit) return slugHit;

  return null;
}

export function findProvinceByName(name: string): string | null {
  return normalizeProvince(name);
}