import { describe, expect, it } from 'vitest';
import { buildAdaptationAnalysis } from '../services/adaptation-analysis-service.js';

describe('adaptation-analysis-service', () => {
  it('extracts adaptation anchors from user-owned source material', () => {
    const analysis = buildAdaptationAnalysis(`
少年阿青在书院门口等雨停，师友误会他偷走旧书。阿青决定留下来查清真相。

夜里，阿青举着油灯穿过藏书楼，看见旧书里夹着一封没有署名的信。

多年后，旁人回忆这座书院的来历和旧书的流转。
`);

    expect(analysis).toBeTruthy();
    expect(analysis?.source_mode).toBe('user_novel');
    expect(analysis?.core_characters.some(item => item.includes('阿青'))).toBe(true);
    expect(analysis?.plot_beats.some(item => item.includes('决定留下来'))).toBe(true);
    expect(analysis?.visual_setpieces.some(item => item.includes('油灯'))).toBe(true);
    expect(analysis?.must_keep.some(item => item.includes('主线事件顺序'))).toBe(true);
    expect(analysis?.compressible_parts.some(item => item.includes('多年后'))).toBe(true);
  });
});
