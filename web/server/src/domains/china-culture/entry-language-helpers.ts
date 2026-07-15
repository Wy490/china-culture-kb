import { chinaCultureProvinces as mcpProvinces } from './knowledge-source-adapter.js';

export const CHINA_CULTURE_TYPE_KEYWORD_HINTS: Readonly<Record<string, readonly string[]>> = {
  '历史人物': ['人物', '名人', '生平', '经历', '事迹', '传记', '革命', '先贤', '诗人', '英雄', '领袖', '将军', '皇帝', '大臣', '宰相', '学者', '名臣', '革命家', '政治家', '军事家', '哲学家', '思想家'],
  '神话传说': ['传说', '神话', '神仙', '妖怪', '仙人', '龙', '凤凰', '灵'],
  '民间故事': ['故事', '民间', '传说', '传说故事', '爱情', '狐仙'],
  '非遗': ['非遗', '民俗', '工艺', '技艺', '传承', '手艺', '绣', '陶瓷', '织', '染', '雕刻', '仪式'],
  '传统工艺': ['工艺', '技艺', '手工', '制作', '烧制', '编织', '流程'],
  '名胜古迹': ['地点', '建筑', '古建', '景区', '山水', '古城', '楼', '阁', '亭', '书院', '寺', '庙', '祠', '墓', '洞', '遗址', '名胜', '古迹', '景点'],
  '地方掌故': ['掌故', '轶事', '事件', '故事', '经历', '转折', '冲突'],
  '节庆习俗': ['节日', '节庆', '习俗', '端午', '中秋', '春节', '过年', '庆典', '仪式', '祭祀'],
  '饮食文化': ['美食', '饮食', '菜', '味道', '小吃', '特产', '烹饪'],
  '地方戏曲': ['戏曲', '戏', '剧', '唱', '舞台'],
  '宗教信仰': ['宗教', '信仰', '佛', '佛教', '禅宗', '道', '道教', '寺', '庙', '祠', '祭祀', '祭', '神灵'],
  '民俗活动': ['民俗', '习俗', '活动', '赶秋', '鼓舞', '仪式', '祭祀', '歌舞'],
};

export function extractChinaCultureKeywords(query: string): string[] {
  const parts = query.split(/[，、\s,·——\-–_]+/).filter(part => part.trim().length >= 2);
  const words: string[] = [];
  for (const part of parts) {
    if (part.length <= 4) {
      words.push(part);
    } else {
      for (let index = 0; index < part.length - 1; index++) {
        words.push(part.substring(index, index + 2));
      }
    }
  }

  const queryText = parts.join('');
  for (const hints of Object.values(CHINA_CULTURE_TYPE_KEYWORD_HINTS)) {
    for (const hint of hints) {
      if (queryText.includes(hint)) words.push(hint);
    }
  }

  return [...new Set(words)];
}

export function detectChinaCultureProvince(query: string, preferred?: string): string | null {
  for (const province of mcpProvinces) {
    if (query.includes(province)) return province;
  }
  if (preferred && mcpProvinces.includes(preferred)) return preferred;
  return null;
}
