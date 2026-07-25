import { describe, expect, it } from 'vitest'
import type {
  AiComicContinuityLedger,
  AiComicSeriesPlan,
  AiComicSeriesVisualBible,
} from '@shared/types.js'
import {
  aiComicSeriesVisualIdentityId,
  buildAiComicSeriesVisualBible,
  isAiComicSeriesGenericVisualCharacterLabel,
} from '../services/ai-comic-series-visual-bible-service.js'

function fixturePlan(): AiComicSeriesPlan {
  return {
    schema_version: 'ai-comic-series-plan/v1',
    series_title: '皮影诡戏：守灯人',
    episode_count: 20,
    episode_duration_range_sec: { min: 60, max: 120 },
    pacing_profile: 'mystery_cliffhanger',
    generation_scope: 'full_planning',
    premise: '沈砚与林灯调查午夜皮影戏规则。',
    premise_contract: {
      schema_version: 'series-premise-contract/v1',
      locked_characters: [
        { name: '沈砚', role: '主角', required: true, evidence_span: '沈砚与林灯调查午夜皮影戏规则' },
        { name: '林灯', role: '核心人物', required: true, evidence_span: '沈砚与林灯调查午夜皮影戏规则' },
      ],
      world_rules: [{
        rule_id: 'midnight-shadow-play-rules',
        statement: '午夜皮影戏必须遵守二十条规则',
        required: true,
        evidence_span: '午夜皮影戏必须遵守二十条规则',
      }],
      antagonistic_forces: [{
        label: '开发商',
        function: '制造拆台和封场压力',
        required: true,
      }, {
        label: '盗谱者',
        function: '争夺失传灯谱',
        required: true,
      }],
      core_stakes: ['违反规则会被抹去记忆'],
      must_cover_beats: [],
      forbidden_substitutions: ['少女'],
      cultural_boundaries: [{
        statement: '皮影技艺按可核实非遗事实呈现',
        truth_mode: 'verified_fact',
      }, {
        statement: '记忆抹除属于原创悬疑机制',
        truth_mode: 'fictional_mechanism',
      }],
    },
    logline: '守住记忆并揭开规则。',
    core_theme: '记忆与选择',
    main_characters: [{
      name: '沈砚',
      role: '主角',
      starting_state: '被规则追赶',
      desire: '守住记忆',
      long_arc: '从被动到主动承担',
      turning_points: [{ episode_no: 1, change: '进入主线' }, { episode_no: 20, change: '完成选择' }],
      visual_signature: '固定服饰、随身灯票与克制动作',
    }, {
      name: '林灯',
      role: '核心人物',
      starting_state: '掌握部分规则',
      desire: '保护共同证据',
      long_arc: '从守密到共同承担',
      turning_points: [{ episode_no: 1, change: '进入主线' }, { episode_no: 20, change: '关系落点' }],
      visual_signature: '固定发型、识别道具与警觉表情',
    }],
    plot_threads: [],
    phases: [],
    episodes: Array.from({ length: 20 }, (_, index) => ({
      episode_no: index + 1,
      title: `第${index + 1}集`,
      target_duration_sec: 90,
      target_panel_count: 12,
      story_phase: 'investigation' as const,
      main_conflict: '追查规则',
      key_characters: ['沈砚', '林灯'],
      continuity_from_previous: [],
      new_information: [],
      foreshadowing: [],
      payoff: [],
      ending_hook: '下一条规则出现',
      knowledge_focus: ['皮影'],
      continuity_state_after: [],
    })),
    continuity_rules: [],
    recurring_motifs: ['灯与白幕'],
    production_notes: [],
  }
}

function fixtureLedger(): AiComicContinuityLedger {
  return {
    schema_version: 'ai-comic-continuity-ledger/v1',
    last_generated_episode_no: 20,
    character_state_current: [],
    open_threads: [],
    paid_off_threads: [],
    knowledge_used: [],
    episode_records: [],
    series_memory: {
      schema_version: 'ai-comic-series-memory/v1',
      characters: [],
      relationships: [],
      props: [{
        memory_id: 'prop-lamp',
        category: 'prop',
        label: '道具「灯」外观参考',
        status: '跨集固定外观',
        first_episode_no: 1,
        last_episode_no: 20,
        related_episode_nos: [1, 10, 20],
        continuity_notes: ['灯的形制与归属保持一致'],
      }, {
        memory_id: 'prop-polluted',
        category: 'prop',
        label: '道具和空间关系必须服务本镜头',
        status: '内部制作指令',
        related_episode_nos: [1, 10, 20],
        continuity_notes: [],
      }],
      locations: [{
        memory_id: 'location-stage',
        category: 'location',
        label: '午夜皮影戏台前场',
        status: 'Seedance镜头shot-1场景',
        first_episode_no: 1,
        last_episode_no: 20,
        related_episode_nos: [1, 10, 20],
        continuity_notes: ['空间结构、灯位与白幕方向固定'],
      }],
      visual_assets: [],
      knowledge_boundaries: [],
      story_events: [],
      conflicts: [],
    },
  }
}

describe('AI comic series visual bible', () => {
  it('classifies narrative role placeholders separately from canonical visual identities', () => {
    expect(isAiComicSeriesGenericVisualCharacterLabel('同行者')).toBe(true)
    expect(isAiComicSeriesGenericVisualCharacterLabel(' 关键见证者 ')).toBe(true)
    expect(isAiComicSeriesGenericVisualCharacterLabel('唐遥')).toBe(false)
  })

  it('builds stable cross-episode identities without promoting placeholders or prompt pollution', () => {
    const plan = fixturePlan()
    plan.main_characters.push({
      name: '关键见证者',
      role: '关系推动者',
      starting_state: '通用占位状态',
      desire: '推动剧情',
      long_arc: '通用占位弧线',
      turning_points: [],
      visual_signature: '关键见证者的识别道具和表情基调',
    })
    const input = {
      plan,
      ledger: fixtureLedger(),
      generatedEpisodeStoryIds: {
        1: '20260720-story-e1',
        10: '20260720-story-e10',
        20: '20260720-story-e20',
      },
      assetLibrary: {
        schema_version: 'ai-comic-seedance-asset-library/v1' as const,
        items: [{
          asset_id: 'approved-shen-yan-image',
          kind: 'character' as const,
          label: '沈砚',
          provider: 'local_upload',
          local_path: 'ai-comic-series-projects/fixture/media/originals/shen-yan.png',
          content_sha256: 'a'.repeat(64),
          rights_status: 'authorized' as const,
          human_review_status: 'approved' as const,
          reviewer_id: 'visual-reviewer-001',
          updated_at: '2026-07-21T01:00:00.000Z',
        }],
      },
      generatedAt: '2026-07-21T02:00:00.000Z',
    }
    const first = buildAiComicSeriesVisualBible(input)
    const second = buildAiComicSeriesVisualBible({
      ...input,
      generatedAt: '2026-07-21T03:00:00.000Z',
    })

    const shenYan = first.identities.find(item => item.kind === 'character' && item.label === '沈砚')
    const shenYanCostume = first.identities.find(item => item.kind === 'costume' && item.label === '沈砚主服装')
    const stage = first.identities.find(item => item.kind === 'location' && item.label === '午夜皮影戏台前场')
    const lamp = first.identities.find(item => item.kind === 'prop' && item.label === '灯')

    expect(first.schema_version).toBe('ai-comic-series-visual-bible/v1')
    expect(first.source_fingerprint).toBe(second.source_fingerprint)
    expect(first.identities.map(item => item.identity_id)).toEqual(second.identities.map(item => item.identity_id))
    expect(shenYan?.identity_id).toBe(aiComicSeriesVisualIdentityId('character', '沈砚'))
    expect(shenYanCostume?.parent_identity_id).toBe(shenYan?.identity_id)
    expect(stage?.pilot_episode_nos).toEqual([1, 10, 20])
    expect(lamp?.pilot_episode_nos).toEqual([1, 10, 20])
    expect(first.identities.some(item => item.label.includes('必须服务本镜头'))).toBe(false)
    expect(first.identities.some(item => item.label.includes('关键见证者'))).toBe(false)
    expect(first.identities.some(item => item.kind === 'character' && item.label === '开发商')).toBe(true)
    expect(first.identities.some(item => item.kind === 'character' && item.label === '盗谱者')).toBe(true)
    expect(first.world_rules).toEqual([expect.objectContaining({ rule_id: 'midnight-shadow-play-rules' })])
    expect(first.cultural_boundaries).toHaveLength(2)
    expect(first.pilot_episode_bindings.map(item => item.episode_no)).toEqual([1, 10, 20])
    expect(first.pilot_episode_bindings.every(item => item.character_identity_ids.length === 4)).toBe(true)
    expect(first.production_credit_identity_count).toBe(0)
    expect(first.issues).toContain('角色视觉定义仍缺年龄区间、体态、脸部特征、发型或性别/代词字段')
  })

  it('preserves structured definitions and invalidates approval when source evidence changes', () => {
    const input = {
      plan: fixturePlan(),
      ledger: fixtureLedger(),
      generatedEpisodeStoryIds: {
        1: '20260720-story-e1',
        10: '20260720-story-e10',
        20: '20260720-story-e20',
      },
      assetLibrary: {
        schema_version: 'ai-comic-seedance-asset-library/v1' as const,
        items: [{
          asset_id: 'approved-shen-yan-image',
          kind: 'character' as const,
          label: '沈砚',
          provider: 'local_upload',
          local_path: 'ai-comic-series-projects/fixture/media/originals/shen-yan.png',
          content_sha256: 'a'.repeat(64),
          rights_status: 'authorized' as const,
          human_review_status: 'approved' as const,
          reviewer_id: 'visual-reviewer-001',
          updated_at: '2026-07-21T01:00:00.000Z',
        }],
      },
      generatedAt: '2026-07-21T04:00:00.000Z',
    }
    const initial = buildAiComicSeriesVisualBible(input)
    const shenYan = initial.identities.find(item => item.kind === 'character' && item.label === '沈砚')!
    const previousVisualBible = {
      ...initial,
      identities: initial.identities.map(identity => identity.identity_id === shenYan.identity_id
        ? {
            ...identity,
            definition_fields: identity.definition_fields.map(field => ({
              ...field,
              value: `${field.label}已由用户确认`,
            })),
            definition_notes: '锁定同一人物的跨集视觉连续性',
            approval: {
              status: 'approved' as const,
              reviewer_id: 'visual-reviewer-001',
              reviewed_at: '2026-07-21T04:10:00.000Z',
              review_note: '已对照角色设定逐项复核',
              source_fingerprint: identity.source_fingerprint,
              human_confirmed: true,
            },
          }
        : identity),
    }

    const reviewed = buildAiComicSeriesVisualBible({
      ...input,
      generatedAt: '2026-07-21T05:00:00.000Z',
      previousVisualBible,
    })
    const reviewedShenYan = reviewed.identities.find(item => item.identity_id === shenYan.identity_id)!
    const boundAssetLibrary = {
      ...input.assetLibrary,
      items: input.assetLibrary.items.map(item => ({
        ...item,
        identity_binding: {
          series_identity_id: reviewedShenYan.identity_id,
          source_fingerprint: reviewedShenYan.source_fingerprint,
          visual_definition_fingerprint: reviewedShenYan.definition_fingerprint,
          status: 'approved' as const,
          reviewer_id: 'visual-reviewer-001',
          reviewed_at: '2026-07-21T05:05:00.000Z',
          review_note: '已对照真实文件、授权依据与当前角色定义。',
          human_confirmed: true,
        },
      })),
    }
    const unchanged = buildAiComicSeriesVisualBible({
      ...input,
      assetLibrary: boundAssetLibrary,
      generatedAt: '2026-07-21T05:10:00.000Z',
      previousVisualBible: reviewed,
    })
    const approved = unchanged.identities.find(item => item.identity_id === shenYan.identity_id)!
    expect(approved.definition_status).toBe('ready')
    expect(approved.approval.status).toBe('approved')
    expect(approved.production_credit).toBe(true)
    expect(approved.definition_notes).toContain('跨集视觉连续性')
    expect(unchanged.approved_identity_count).toBe(1)
    expect(unchanged.production_credit_identity_count).toBe(1)

    const changedPlan = fixturePlan()
    changedPlan.main_characters = changedPlan.main_characters.map(character => character.name === '沈砚'
      ? { ...character, visual_signature: `${character.visual_signature}，新增一道明确面部伤痕` }
      : character)
    const changed = buildAiComicSeriesVisualBible({
      ...input,
      assetLibrary: boundAssetLibrary,
      plan: changedPlan,
      generatedAt: '2026-07-21T06:00:00.000Z',
      previousVisualBible: reviewed,
    })
    const stale = changed.identities.find(item => item.identity_id === shenYan.identity_id)!
    expect(stale.approval.status).toBe('stale')
    expect(stale.production_credit).toBe(false)
    expect(changed.approved_identity_count).toBe(0)
  })

  it('keeps world-rule visual definitions fail-closed until every pilot target is reviewed and stales them on source changes', () => {
    const input = {
      plan: fixturePlan(),
      ledger: fixtureLedger(),
      generatedEpisodeStoryIds: {
        1: '20260720-story-e1',
        10: '20260720-story-e10',
        20: '20260720-story-e20',
      },
      generatedAt: '2026-07-21T07:00:00.000Z',
    }
    const initial = buildAiComicSeriesVisualBible(input)

    expect(initial.world_rules[0]).toMatchObject({
      rule_id: 'midnight-shadow-play-rules',
      missing_visual_mapping: true,
      definition_status: 'needs_definition',
      missing_definition_fields: expect.arrayContaining(['视觉符号', '触发条件']),
      missing_pilot_episode_nos: [1, 10, 20],
    })
    expect(initial.pilot_episode_bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ episode_no: 1, world_rule_coverage_percent: 0 }),
      expect.objectContaining({ episode_no: 10, world_rule_coverage_percent: 0 }),
      expect.objectContaining({ episode_no: 20, world_rule_coverage_percent: 0 }),
    ]))

    const initialRule = initial.world_rules[0]!
    const reviewedPreviousBible = {
      ...initial,
      world_rules: [{
        ...initialRule,
        visual_symbol: '白幕上逆向移动的影子与规则字迹',
        trigger_condition: '午夜灯火熄灭后有人踏入幕前禁位',
        definition_fields: [
          { field_id: 'visual_symbol', label: '视觉符号', value: '白幕上逆向移动的影子与规则字迹', required: true },
          { field_id: 'trigger_condition', label: '触发条件', value: '午夜灯火熄灭后有人踏入幕前禁位', required: true },
        ],
        definition_notes: '三集均需保留白幕、灯火和逆影的可见关系。',
        pilot_bindings: [
          { episode_no: 1, target_type: 'seedance_shot', target_id: 'shot-1', story_id: '20260720-story-e1' },
          { episode_no: 10, target_type: 'gears_segment', target_id: '2', story_id: '20260720-story-e10' },
          { episode_no: 20, target_type: 'seedance_shot', target_id: 'shot-3', story_id: '20260720-story-e20' },
        ],
        approval: {
          status: 'approved',
          reviewer_id: 'visual-reviewer-001',
          reviewed_at: '2026-07-21T07:10:00.000Z',
          review_note: '已逐项复核规则文本、视觉符号、触发条件和三集代表目标。',
          source_fingerprint: initialRule.source_fingerprint,
          human_confirmed: true,
        },
      }],
    } as unknown as AiComicSeriesVisualBible
    const approved = buildAiComicSeriesVisualBible({
      ...input,
      generatedAt: '2026-07-21T07:20:00.000Z',
      previousVisualBible: reviewedPreviousBible,
    })

    expect(approved.world_rules[0]).toMatchObject({
      visual_symbol: '白幕上逆向移动的影子与规则字迹',
      trigger_condition: '午夜灯火熄灭后有人踏入幕前禁位',
      definition_status: 'ready',
      missing_visual_mapping: false,
      missing_pilot_episode_nos: [],
      approval: expect.objectContaining({ status: 'approved' }),
    })
    expect(approved.pilot_episode_bindings.every(binding => binding.world_rule_coverage_percent === 100)).toBe(true)

    const changedPlan = fixturePlan()
    changedPlan.premise_contract!.world_rules[0]!.statement = '午夜皮影戏必须遵守二十条规则，且白幕熄灯后不得越过禁位'
    const stale = buildAiComicSeriesVisualBible({
      ...input,
      plan: changedPlan,
      generatedAt: '2026-07-21T07:30:00.000Z',
      previousVisualBible: reviewedPreviousBible,
    })
    expect(stale.world_rules[0]?.approval.status).toBe('stale')

    const changedPilotStory = buildAiComicSeriesVisualBible({
      ...input,
      generatedEpisodeStoryIds: {
        ...input.generatedEpisodeStoryIds,
        10: '20260721-story-e10-revised',
      },
      generatedAt: '2026-07-21T07:40:00.000Z',
      previousVisualBible: reviewedPreviousBible,
    })
    expect(changedPilotStory.world_rules[0]).toMatchObject({
      approval: expect.objectContaining({ status: 'stale' }),
      missing_pilot_episode_nos: [10],
      missing_visual_mapping: true,
    })
  })

  it('grants costume and prop credit only to the reviewed identity definition and stales it when that definition changes', () => {
    const input = {
      plan: fixturePlan(),
      ledger: fixtureLedger(),
      generatedEpisodeStoryIds: {
        1: '20260720-story-e1',
        10: '20260720-story-e10',
        20: '20260720-story-e20',
      },
      generatedAt: '2026-07-21T08:00:00.000Z',
    }
    const initial = buildAiComicSeriesVisualBible(input)
    const reviewedVisualBible = {
      ...initial,
      identities: initial.identities.map(identity => ({
        ...identity,
        definition_fields: identity.definition_fields.map(field => ({
          ...field,
          value: `${field.label}已由用户确认`,
        })),
        definition_notes: `${identity.label}的跨集视觉定义已由用户确认`,
        approval: {
          status: 'approved' as const,
          reviewer_id: 'visual-reviewer-001',
          reviewed_at: '2026-07-21T08:10:00.000Z',
          review_note: '已逐项对照该身份的结构化视觉定义。',
          source_fingerprint: identity.source_fingerprint,
          human_confirmed: true,
        },
      })),
    } as AiComicSeriesVisualBible
    const approved = buildAiComicSeriesVisualBible({
      ...input,
      generatedAt: '2026-07-21T08:20:00.000Z',
      previousVisualBible: reviewedVisualBible,
    })
    const costume = approved.identities.find(item => item.kind === 'costume' && item.label === '沈砚主服装')!
    const prop = approved.identities.find(item => item.kind === 'prop' && item.label === '灯')!
    const assetLibrary = {
      schema_version: 'ai-comic-seedance-asset-library/v1' as const,
      items: [costume, prop].map(identity => ({
        asset_id: `uploaded-${identity.identity_id}`,
        kind: identity.kind,
        label: identity.label,
        provider: 'local_upload',
        local_path: `ai-comic-series-projects/fixture/media/originals/${identity.identity_id}.png`,
        content_sha256: identity.kind === 'costume' ? 'b'.repeat(64) : 'c'.repeat(64),
        rights_status: 'authorized',
        authorization_reference: '授权单-20260721',
        human_review_status: 'approved',
        reviewer_id: 'visual-reviewer-001',
        reviewed_at: '2026-07-21T08:25:00.000Z',
        review_note: '已审核真实文件、授权证明与身份映射。',
        identity_binding: {
          series_identity_id: identity.identity_id,
          source_fingerprint: identity.source_fingerprint,
          visual_definition_fingerprint: (identity as any).definition_fingerprint,
          status: 'approved',
          reviewer_id: 'visual-reviewer-001',
          reviewed_at: '2026-07-21T08:25:00.000Z',
          review_note: '已审核真实文件、授权证明与身份映射。',
          human_confirmed: true,
        },
        updated_at: '2026-07-21T08:25:00.000Z',
      })),
    } as any
    const credited = buildAiComicSeriesVisualBible({
      ...input,
      assetLibrary,
      generatedAt: '2026-07-21T08:30:00.000Z',
      previousVisualBible: approved,
    })

    expect(credited.identities.find(item => item.identity_id === costume.identity_id)?.production_credit).toBe(true)
    expect(credited.identities.find(item => item.identity_id === prop.identity_id)?.production_credit).toBe(true)
    expect(credited.production_credit_identity_count).toBe(2)

    const changedDefinitionBible = {
      ...approved,
      identities: approved.identities.map(identity => identity.identity_id === costume.identity_id
        ? {
            ...identity,
            definition_fields: identity.definition_fields.map(field => field.field_id === 'color_palette'
              ? { ...field, value: '用户确认的深靛与旧金色方案' }
              : field),
            approval: {
              ...identity.approval,
              status: 'pending' as const,
              reviewer_id: undefined,
              reviewed_at: undefined,
              review_note: undefined,
              human_confirmed: false,
            },
          }
        : identity),
    } as AiComicSeriesVisualBible
    const stale = buildAiComicSeriesVisualBible({
      ...input,
      assetLibrary,
      generatedAt: '2026-07-21T08:40:00.000Z',
      previousVisualBible: changedDefinitionBible,
    })

    expect(stale.identities.find(item => item.identity_id === costume.identity_id)?.production_credit).toBe(false)
    expect(stale.production_credit_identity_count).toBe(1)
  })
})
