import { createHash } from 'node:crypto'
import type {
  AiComicSeriesVisualIdentity,
  AiComicSeriesVisualSuggestionDraft,
  AiComicSeriesVisualWorldRule,
} from '@shared/types.js'

const SUGGESTION_VERSION = 'visual-definition-suggestions/v1' as const

export function buildAiComicSeriesVisualIdentitySuggestionDraft(input: {
  identity: AiComicSeriesVisualIdentity
  generatedAt?: string
}): AiComicSeriesVisualSuggestionDraft {
  const fields: Record<string, string> = {}
  const unresolvedFieldIds: string[] = []
  for (const field of input.identity.definition_fields) {
    if (field.value.trim()) continue
    const suggestion = visualIdentityFieldSuggestion(input.identity, field.field_id, field.label)
    if (!suggestion) {
      unresolvedFieldIds.push(field.field_id)
      continue
    }
    fields[field.field_id] = suggestion.slice(0, 500)
  }
  return buildSuggestionDraft({
    targetType: 'visual_identity',
    targetId: input.identity.identity_id,
    sourceFingerprint: input.identity.source_fingerprint,
    inputFingerprintValue: input.identity,
    generatedAt: input.generatedAt,
    fields,
    definitionNotes: input.identity.definition_notes.trim()
      ? undefined
      : `【系统建议草稿，尚未人工批准】系统仅补全空白项，并依据“${input.identity.label}”及当前系列设定提供可编辑提案；请真人逐项核对来源、跨集不变量和允许变化后再批准。`,
    unresolvedFieldIds,
  })
}

export function buildAiComicSeriesVisualWorldRuleSuggestionDraft(input: {
  rule: AiComicSeriesVisualWorldRule
  generatedAt?: string
}): AiComicSeriesVisualSuggestionDraft {
  const fields = Object.fromEntries(input.rule.definition_fields.flatMap(field => {
    if (field.value.trim()) return []
    return [[field.field_id, visualWorldRuleFieldSuggestion(input.rule, field.field_id, field.label).slice(0, 500)]]
  }))
  return buildSuggestionDraft({
    targetType: 'visual_world_rule',
    targetId: input.rule.rule_id,
    sourceFingerprint: input.rule.source_fingerprint,
    inputFingerprintValue: input.rule,
    generatedAt: input.generatedAt,
    fields,
    definitionNotes: input.rule.definition_notes.trim()
      ? undefined
      : `【系统建议草稿，尚未人工批准】请真人核对“${input.rule.statement}”的规则文本、视觉符号、触发条件及代表目标；系统不会创建或替换真实镜头绑定。`,
    unresolvedFieldIds: [],
  })
}

function buildSuggestionDraft(input: {
  targetType: AiComicSeriesVisualSuggestionDraft['target_type']
  targetId: string
  sourceFingerprint: string
  inputFingerprintValue: unknown
  generatedAt?: string
  fields: Record<string, string>
  definitionNotes?: string
  unresolvedFieldIds: string[]
}): AiComicSeriesVisualSuggestionDraft {
  return {
    schema_version: 'ai-comic-series-visual-suggestion-draft/v1',
    target_type: input.targetType,
    target_id: input.targetId,
    source_fingerprint: input.sourceFingerprint,
    input_fingerprint: `sha256:${createHash('sha256')
      .update(JSON.stringify(input.inputFingerprintValue), 'utf8')
      .digest('hex')}`,
    suggestion_source: 'deterministic_template',
    suggestion_version: SUGGESTION_VERSION,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    fields: input.fields,
    definition_notes: input.definitionNotes,
    suggested_field_ids: Object.keys(input.fields),
    unresolved_field_ids: input.unresolvedFieldIds,
    persisted: false,
    auto_approved: false,
  }
}

function visualIdentityFieldSuggestion(
  identity: AiComicSeriesVisualIdentity,
  fieldId: string,
  fieldLabel: string,
): string {
  const subject = `“${identity.label}”`
  if (identity.kind === 'character') {
    if (fieldId === 'age_range' || fieldId === 'gender_pronouns') return ''
    if (fieldId === 'body_type') {
      return `围绕${subject}建立与其他角色可一眼区分的身高、胖瘦、肩背轮廓，以及一项固定站姿或动作习惯；具体数值与动作需由真人结合剧本确认。`
    }
    if (fieldId === 'facial_features') {
      return `为${subject}固定脸型、眉眼、鼻唇、肤色区间和一项近景识别特征；避免与同项目其他人物重复，最终细节由真人确认。`
    }
    if (fieldId === 'hairstyle') {
      return `为${subject}固定头发长度、颜色、分缝和造型轮廓；跨集不得无剧情依据改变，最终方案由真人确认。`
    }
  }
  if (identity.kind === 'costume') {
    if (fieldId === 'garment_details') {
      return `围绕${subject}明确外层、内搭、下装、鞋履、材质和至少一个跨镜头识别锚点；版型与锚点跨集保持稳定。`
    }
    if (fieldId === 'color_palette') {
      return `为${subject}指定主色、辅色、小面积点缀色及暗场明度关系；避免与其他主服装的主色和轮廓混淆。`
    }
    if (fieldId === 'phase_changes') {
      return `${subject}初期保持完整；中后期只允许增加有剧情依据的污损、修补或局部破损，基础版型与识别锚点不得改变。`
    }
  }
  if (identity.kind === 'location') {
    if (fieldId === 'spatial_architecture') {
      return `为${subject}固定入口、前后景、主要表演区、遮挡物和角色动线的相对位置；跨镜头保持空间方向与尺度一致。`
    }
    if (fieldId === 'primary_lighting') {
      return `为${subject}指定唯一主光源的方向、色温、硬软度与亮度层级，并明确熄灯或异常状态下可变化的范围。`
    }
    if (fieldId === 'materials_palette') {
      return `为${subject}固定三类主要材质、主辅色和老化程度；近景纹理与远景色块应能指向同一地点。`
    }
  }
  if (identity.kind === 'prop') {
    if (fieldId === 'form_dimensions') {
      return `为${subject}固定形制、比例、可动部件和与人物手部的尺寸参照；所有景别保持同一轮廓。`
    }
    if (fieldId === 'materials_colors') {
      return `为${subject}固定主体材质、表面工艺、主色、磨损位置和点亮前后的色彩差异。`
    }
    if (fieldId === 'ownership_state_changes') {
      return `明确${subject}的初始归属、交接节点和各剧情阶段的状态变化；每次变化必须能追溯到具体事件。`
    }
  }
  return `围绕${subject}补充“${fieldLabel}”的固定视觉锚点、允许变化范围和跨镜头一致性要求；最终方案由真人确认。`
}

function visualWorldRuleFieldSuggestion(
  rule: AiComicSeriesVisualWorldRule,
  fieldId: string,
  fieldLabel: string,
): string {
  const statement = `“${rule.statement}”`
  if (fieldId === 'visual_symbol') {
    return `围绕${statement}固定一个可重复识别的主符号，明确其形状、颜色、出现位置、正常状态与异常状态；跨集保持同一视觉语法。`
  }
  if (fieldId === 'trigger_condition') {
    const consequence = rule.consequence?.trim() || '规则后果显现'
    return `当角色明确触发${statement}时，在同一动作链内按“触发动作 → 主符号变化 → ${consequence}”呈现，跨集保持顺序不变。`
  }
  return `围绕${statement}补充“${fieldLabel}”的固定视觉锚点、触发前后变化和跨集一致性要求；最终方案由真人确认。`
}
