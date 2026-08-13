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

  it.each([
    [
      '人物史',
      '雨夜，周敦颐在南安军衙翻到案卷中互相矛盾的证词。知军王逵催他画押；周敦颐决定拒签，并交还任命文书。',
      ['周敦颐', '王逵'],
      ['周敦颐决', '定拒签', '并交还任'],
    ],
    [
      '历史群像',
      '武昌起义消息提前泄露，新军士兵连夜集结，决定抢在清军搜捕前发动。起义军冲向楚望台军械库，普通士兵引发连锁响应。',
      ['新军士兵', '起义军', '普通士兵'],
      ['消息提前', '泄露新军'],
    ],
    [
      '传说',
      '刘海在山路砍樵时遇见胡大姐。乡邻迫使两人分开；刘海决定回头寻找胡大姐。',
      ['刘海', '胡大姐'],
      ['刘海决定', '相信一路'],
    ],
    [
      '儿童故事',
      '小刘海在山路上丢了柴绳，胡大姐停下来帮忙。小刘海决定先看行动，再核实误会。',
      ['小刘海', '胡大姐'],
      ['小刘海在山', '小刘海决'],
    ],
    [
      '漫剧',
      '雨夜，刘海发现胡大姐的影子在雷光里变成狐形。胡大姐挡在孩子前，刘海必须作出选择。',
      ['刘海', '胡大姐'],
      ['刘海发现', '胡大姐的', '影子在雷'],
    ],
  ])('extracts real character anchors without action-fragment pseudo names for %s', (
    _label,
    source,
    expected,
    forbidden,
  ) => {
    const analysis = buildAdaptationAnalysis(source);

    expect(analysis?.core_characters).toEqual(expect.arrayContaining(expected));
    expect(analysis?.core_characters).not.toEqual(expect.arrayContaining(forbidden));
  });
});
