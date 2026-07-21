import type { AiComicCommercialOpeningHookType } from '@shared/types.js';
import { isRuleMysteryPremise } from './ai-comic-series-premise-contract-service.js';

export interface AiComicCommercialStoryProfile {
  profile_id: 'rule_mystery' | 'heritage_stage_rescue' | 'serial_drama';
  opening_hook_types: AiComicCommercialOpeningHookType[];
  scene_function_sequences: string[][];
  signature_locations: string[];
  signature_actions: string[];
}

const RULE_MYSTERY_PROFILE: AiComicCommercialStoryProfile = {
  profile_id: 'rule_mystery',
  opening_hook_types: [
    'visual_anomaly',
    'countdown',
    'forbidden_action',
    'identity_gap',
    'evidence_reversal',
    'relationship_rupture',
  ],
  scene_function_sequences: [
    ['可视异常', '规则验证', '关系受压', '证据反转', '新规则追问'],
    ['倒计时', '分工调查', '代价兑现', '对手暴露', '身份悬念'],
    ['禁忌动作', '即时补救', '错误归因', '记忆复原', '互信追问'],
    ['身份缺口', '证据对照', '双重施压', '规则改写', '选择悬念'],
    ['证据翻案', '旧账重查', '盟友冲突', '幕后触发', '失忆倒计时'],
    ['关系断裂', '行动分离', '规则惩罚', '共同证据', '重选同伴'],
  ],
  signature_locations: ['白幕前', '后台灯箱', '规则墙', '档案柜侧门', '空观众席', '戏台夹层'],
  signature_actions: ['追认反向影子', '封存双人灯票', '阻止触碰禁偶', '对照缺页灯谱', '复原被删记忆', '截断人为触发线'],
};

const HERITAGE_STAGE_RESCUE_PROFILE: AiComicCommercialStoryProfile = {
  profile_id: 'heritage_stage_rescue',
  opening_hook_types: ['countdown', 'visual_anomaly', 'forbidden_action', 'evidence_reversal'],
  scene_function_sequences: [
    ['倒计时', '技艺试做', '现实阻力', '方法反转', '接续任务'],
    ['损伤显影', '拆解验证', '价值冲突', '协作选择', '新难题'],
    ['错误操作', '代价出现', '师徒碰撞', '可逆修复', '验收追问'],
    ['证据翻案', '旧物追查', '公开试演', '关系改变', '续演压力'],
  ],
  signature_locations: ['旧戏台前场', '皮影工作台', '灯幕后', '戏箱库房', '街坊试演场', '戏台屋顶'],
  signature_actions: ['翻写拆除告示', '校准影偶关节', '复测白幕透光', '追认戏箱记录', '组织无设备试演', '抢护木台灯幕'],
};

const SERIAL_DRAMA_PROFILE: AiComicCommercialStoryProfile = {
  profile_id: 'serial_drama',
  opening_hook_types: [
    'visual_anomaly',
    'countdown',
    'evidence_reversal',
    'relationship_rupture',
    'forbidden_action',
  ],
  scene_function_sequences: [
    ['反常画面', '目标落地', '压力升级', '信息反转', '具体追问'],
    ['倒计时', '主动调查', '失败代价', '人物选择', '关系悬念'],
    ['证据翻案', '目标改写', '外部阻断', '状态变化', '行动钩子'],
    ['关系破裂', '独立行动', '认知纠错', '重新结盟', '代价悬念'],
    ['禁忌动作', '后果出现', '责任冲突', '选择兑现', '新威胁'],
  ],
  signature_locations: ['事件现场', '证据空间', '关系对峙点', '行动入口', '公开压力场'],
  signature_actions: ['截住异常证据', '抢在时限前验证', '推翻错误判断', '拒绝安全退路', '把选择公开化'],
};

export function resolveAiComicCommercialStoryProfile(text: string): AiComicCommercialStoryProfile {
  if (isRuleMysteryPremise(text)) return RULE_MYSTERY_PROFILE;
  if (/皮影|影偶|灯幕/.test(text) && /戏台|戏班/.test(text) && /拆除|修复|守艺|演出/.test(text)) {
    return HERITAGE_STAGE_RESCUE_PROFILE;
  }
  return SERIAL_DRAMA_PROFILE;
}
