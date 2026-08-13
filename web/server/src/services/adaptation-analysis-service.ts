import type { StoryAdaptationAnalysis } from '@shared/types.js';

const NAME_BLOCKLIST = new Set([
  '故事', '小说', '原文', '改编', '用户', '人物', '场景', '时候', '他们', '我们', '后来',
  '突然', '已经', '因为', '所以', '但是', '如果', '一个', '一种', '这里', '那里',
  '别人', '两人', '众人', '有人', '自己', '对方', '签笔', '案卷', '消息', '误会',
]);

const COMMON_CHINESE_SURNAMES = new Set(
  [...'赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉龚程嵇邢滑裴陆荣翁荀羊惠甄麴家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲台从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧利师巩聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公'],
);

const ACTOR_ACTION_BOUNDARY = /^(.*?)(?=在|从|向|带着|拿着|举着|翻|催|决定|发现|挡|集结|冲向|推|搬|引发|必须|选择|拒绝|答应|寻找|回头|放下|护住|遇见|停下|用|看见|听见|进入|离开|面对|走|跑|站|坐|说|问|喊|劝|失去|回来|相遇|分别|揭开|醒来|意识到)/;
const GROUP_CHARACTER = /^(?:新军士兵|普通士兵|起义军|清军士兵|村人|乡邻|师友|同伴|朋友|母亲|父亲|老师|师父)$/;

const EVENT_MARKERS = /离开|进入|发现|决定|选择|冲突|误会|追问|寻找|失去|回来|相遇|分别|揭开|面对|拒绝|答应|逃离|守住|改变|醒来|看见|听见|意识到/;
const VISUAL_MARKERS = /门口|院子|街|巷|河|桥|山|雨|雪|夜|灯|火|船|书|信|屋|房|窗|桌|井|祠|寺|庙|战场|书院|村|城|路|田|集市|码头/;
const COMPRESSIBLE_MARKERS = /回忆|说明|解释|背景|多年后|与此同时|旁枝|插叙|铺垫|心理活动|内心独白|设定/;

export function buildAdaptationAnalysis(source: string | undefined): StoryAdaptationAnalysis | undefined {
  const normalized = normalizeSource(source);
  if (!normalized) return undefined;

  const units = splitSourceUnits(normalized);
  const plotBeats = extractPlotBeats(units);
  const coreCharacters = extractLikelyNames(normalized, units);
  const visualSetpieces = extractVisualSetpieces(units);
  const compressibleParts = extractCompressibleParts(units);
  const mustKeep = buildMustKeep(coreCharacters, plotBeats, normalized);
  const adaptationRisks = buildAdaptationRisks(normalized, coreCharacters, plotBeats, visualSetpieces);

  return {
    source_mode: 'user_novel',
    source_length: normalized.length,
    source_summary: summarizeSource(units, normalized),
    core_characters: coreCharacters,
    plot_beats: plotBeats,
    must_keep: mustKeep,
    compressible_parts: compressibleParts,
    visual_setpieces: visualSetpieces,
    adaptation_risks: adaptationRisks,
  };
}

function normalizeSource(source: string | undefined): string {
  return (source ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function splitSourceUnits(source: string): string[] {
  return source
    .split(/\n{2,}|(?<=[。！？!?；;])\s*/)
    .map(item => item.trim())
    .filter(item => item.length >= 8)
    .slice(0, 80);
}

function summarizeSource(units: string[], source: string): string {
  const first = units[0] ?? source;
  const second = units.find(unit => unit !== first && EVENT_MARKERS.test(unit));
  const summary = [first, second].filter(Boolean).join(' ');
  return truncate(summary || source, 180);
}

function extractPlotBeats(units: string[]): string[] {
  const candidates = units
    .filter(unit => EVENT_MARKERS.test(unit) || /^第?[一二三四五六七八九十0-9]+[、.．章节幕]/.test(unit))
    .map(unit => cleanBeat(unit));
  return unique(candidates).slice(0, 10);
}

function extractLikelyNames(source: string, units: string[]): string[] {
  const clauses = units.flatMap(unit => unit.split(/[，。！？!?；;：:\n]+/));
  const actionSubjects = clauses
    .map(clause => clause.trim().match(ACTOR_ACTION_BOUNDARY)?.[1] ?? '')
    .map(normalizeCharacterCandidate)
    .filter(isLikelyCharacterCandidate);
  const explicitRoles = Array.from(source.matchAll(
    /(?:主角|主人公|少年|少女|老人|反派|对手)[：为叫名]?([阿小]?[\u4e00-\u9fa5]{1,3})(?=在|从|向|带|拿|翻|决定|发现|选择|拒绝|遇见|走|跑|说|问|，|。|；|\s)/g,
  )).map(match => normalizeCharacterCandidate(match[1] ?? ''));
  const nicknames = Array.from(source.matchAll(
    /([阿小][\u4e00-\u9fa5]{1,2})(?=在|从|向|带|拿|举|翻|决定|发现|选择|拒绝|遇见|走|跑|说|问|，|。|；|\s)/g,
  )).map(match => normalizeCharacterCandidate(match[1] ?? ''));
  const titledCharacters = Array.from(source.matchAll(
    /([\u4e00-\u9fa5](?:大姐|大哥)|[\u4e00-\u9fa5]{1,2}(?:先生|姑娘|师傅))(?=在|从|向|带|拿|举|翻|决定|发现|选择|拒绝|遇见|挡|走|跑|说|问|，|。|；|\s|的)/g,
  )).map(match => normalizeCharacterCandidate(match[1] ?? ''));
  const groups = Array.from(source.matchAll(
    /(新军士兵|普通士兵|起义军|清军士兵|村人|乡邻|师友|同伴|朋友)(?=在|从|向|带|拿|举|翻|决定|发现|选择|拒绝|遇见|挡|(?:连夜)?集结|冲向|走|跑|说|问|，|。|；|\s|的)/g,
  )).map(match => match[1] ?? '');
  return unique([...explicitRoles, ...nicknames, ...titledCharacters, ...groups, ...actionSubjects])
    .filter(isLikelyCharacterCandidate)
    .slice(0, 8);
}

function normalizeCharacterCandidate(value: string): string {
  return value
    .replace(/^(?:雨夜|夜里|清晨|黄昏|此时|随后|后来|最终)/, '')
    .replace(/^(?:知军|将军|老师|师父|少年|少女|老人)(?=[\u4e00-\u9fa5]{2,4}$)/, '')
    .replace(/[的地得]$/, '')
    .trim();
}

function isLikelyCharacterCandidate(value: string): boolean {
  if (value.length < 2 || value.length > 6 || NAME_BLOCKLIST.has(value)) return false;
  if (GROUP_CHARACTER.test(value)) return true;
  if (/^阿[\u4e00-\u9fa5]{1,2}$/.test(value)) return true;
  const personalName = value.startsWith('小') || value.startsWith('阿')
    ? value.slice(1)
    : value;
  return personalName.length >= (value.startsWith('阿') ? 1 : 2)
    && personalName.length <= 3
    && COMMON_CHINESE_SURNAMES.has(personalName[0]);
}

function extractVisualSetpieces(units: string[]): string[] {
  return unique(
    units
      .filter(unit => VISUAL_MARKERS.test(unit) && (EVENT_MARKERS.test(unit) || /说|问|喊|看|走|跑|站|坐|拿|推|望/.test(unit)))
      .map(unit => truncate(unit, 90)),
  ).slice(0, 8);
}

function extractCompressibleParts(units: string[]): string[] {
  return unique(
    units
      .filter(unit => COMPRESSIBLE_MARKERS.test(unit) && !/决定|选择|失去|冲突|揭开|面对/.test(unit))
      .map(unit => truncate(unit, 80)),
  ).slice(0, 6);
}

function buildMustKeep(coreCharacters: string[], plotBeats: string[], source: string): string[] {
  const items: string[] = [];
  if (coreCharacters.length > 0) {
    items.push(`保留核心人物/称谓：${coreCharacters.slice(0, 5).join('、')}`);
  }
  if (plotBeats.length > 0) {
    items.push(`保留主线事件顺序：${plotBeats.slice(0, 5).join(' → ')}`);
  }
  if (/父亲|母亲|师友|同伴|朋友|兄弟|姐妹|老师|师父/.test(source)) {
    items.push('保留原作中推动选择的关键关系压力。');
  }
  if (/决定|选择|拒绝|留下|离开|守住/.test(source)) {
    items.push('保留主角做出选择的那一刻，并写出代价。');
  }
  return unique(items).slice(0, 6);
}

function buildAdaptationRisks(
  source: string,
  coreCharacters: string[],
  plotBeats: string[],
  visualSetpieces: string[],
): string[] {
  const risks: string[] = [];
  if (source.length > 3000) risks.push('原作较长，需要先锁定一集/一段核心冲突，避免压缩成流水账。');
  if (coreCharacters.length === 0) risks.push('未稳定识别核心人物，生成前应补充人物表或主角称谓。');
  if (plotBeats.length < 2) risks.push('原作事件节拍偏少，改编时容易变成氛围片，需要补出目标、阻力和选择。');
  if (visualSetpieces.length === 0) risks.push('可视化场面不足，需补地点、动作、道具和光线，避免 GEARS 场景图条件过空。');
  if (/世界观|设定|门派|系统|规则/.test(source)) risks.push('世界观设定不要整段解释，应拆成角色行动中的可见规则。');
  return risks;
}

function cleanBeat(text: string): string {
  return truncate(text.replace(/^第?[一二三四五六七八九十0-9]+[、.．章节目幕\s]*/, ''), 80);
}

function truncate(text: string, max: number): string {
  const value = text.replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function unique(items: string[]): string[] {
  return [...new Set(items.map(item => item.trim()).filter(Boolean))];
}
