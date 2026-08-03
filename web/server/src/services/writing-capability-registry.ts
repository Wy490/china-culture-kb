import {
  WritingCapabilityCatalogReportV1Schema,
  WritingCapabilityProfileV1Schema,
} from '@shared/schemas.js';
import type {
  WritingCapabilityCatalogReportV1,
  WritingCapabilityProfileV1,
} from '@shared/types.js';

export class WritingCapabilityRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WritingCapabilityRegistryError';
  }
}

export class WritingCapabilityRegistry {
  private readonly profiles = new Map<string, WritingCapabilityProfileV1>();

  register(candidate: unknown): void {
    const parsed = WritingCapabilityProfileV1Schema.safeParse(candidate);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map(issue => `${issue.path.join('.') || 'profile'}: ${issue.message}`)
        .join('; ');
      throw new WritingCapabilityRegistryError(`Invalid writing capability profile: ${details}`);
    }

    if (this.profiles.has(parsed.data.capability_id)) {
      throw new WritingCapabilityRegistryError(
        `Duplicate writing capability_id: ${parsed.data.capability_id}`,
      );
    }

    this.profiles.set(
      parsed.data.capability_id,
      deepFreeze(parsed.data) as WritingCapabilityProfileV1,
    );
  }

  list(): readonly WritingCapabilityProfileV1[] {
    return Object.freeze(
      [...this.profiles.values()].sort((left, right) => (
        left.capability_id.localeCompare(right.capability_id)
      )),
    );
  }
}

const NARRATIVE_VIDEO_TYPES = [
  'character_story',
  'historical_drama',
  'legend_story',
  'ai_comic_drama',
  'children_story',
] as const;

const NON_NARRATIVE_VIDEO_TYPES = [
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'social_short',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
  'scene_short',
  'landscape_mood',
] as const;

const REVIEW_VIDEO_TYPES = [
  ...NARRATIVE_VIDEO_TYPES,
  'culture_promo',
  'heritage_promo',
  'city_brand_promo',
  'social_short',
  'documentary_short',
  'explainer_video',
  'lecture_video',
  'education_training',
] as const;

export const WRITING_CAPABILITY_PROFILES = [
  {
    schema_version: 'writing-capability-profile/v1',
    capability_id: 'continuity_state_tracking',
    display_name: '叙事连续性与承诺兑现检查',
    source_repository: 'https://github.com/danjdewhurst/story-skills',
    source_commit: 'c482d48f4eb9b488f033a77a51f9fae55cc0d75f',
    source_author: 'danjdewhurst',
    license: 'MIT',
    adapted_rules: [
      '以稳定标识追踪人物、物件、知识状态和场景出场关系。',
      '区分承诺的埋设、推进和兑现，检测兑现早于埋设或长期悬空。',
      '把连续性问题转成可定位、可修复的质量项，不用巨型提示词隐式记忆。',
    ],
    allowed_video_types: NARRATIVE_VIDEO_TYPES,
    forbidden_video_types: NON_NARRATIVE_VIDEO_TYPES,
    blueprint_requirements: [
      '需要长于单场的叙事时，蓝图应声明关键人物、物件和知识状态。',
      '蓝图应记录重要承诺、疑问和预期兑现位置。',
    ],
    scene_rules: [
      '相邻场景的人物状态、物件归属和已知信息不得无解释跳变。',
      '闪回、转述和身后出现必须显式标记，不能被误判为当前时线。',
    ],
    quality_rules: [
      '检测人物状态、物件状态、知识状态、承诺/兑现和问题/解答的顺序冲突。',
      '连续性发现必须指向具体场景或蓝图条目。',
    ],
    repair_guidance: [
      '优先修复单个状态或场景衔接，除非因果主链已整体失效。',
      '保留事实证据边界，不以补写虚构事实掩盖连续性缺口。',
    ],
    provenance: {
      audited_at: '2026-07-31T00:00:00+08:00',
      audit_scope: [
        'README、许可证、目录结构、CLI/脚本与工作流能力的静态审计',
      ],
      adopted_methods: [
        'story bible 状态字段',
        '人物/物件/知识状态',
        '承诺/兑现与开放问题的确定性检查思路',
      ],
      excluded_components: [
        '第三方 CLI、脚本、工作流、安装命令、文件格式和项目脚手架',
      ],
      risk_notes: [
        '原仓库包含可读写故事项目文件的 CLI 与可触发外部 Agent 的工作流；本项目只抽象方法。',
      ],
      static_adaptation_only: true,
      third_party_code_executed: false,
      external_network_access_allowed: false,
      external_file_write_allowed: false,
      external_command_execution_allowed: false,
    },
    enabled: false,
  },
  {
    schema_version: 'writing-capability-profile/v1',
    capability_id: 'reader_simulation_review',
    display_name: '读者体验模拟与结构化审稿',
    source_repository: 'https://github.com/haowjy/creative-writing-skills',
    source_commit: 'fb9dab2d4d23434ae76568e8de36aaf515dea8d5',
    source_author: 'haowjy',
    license: 'Apache-2.0',
    adapted_rules: [
      '把读者困惑、期待、情绪变化和弃读风险作为草稿后的独立观察层。',
      '把泛泛好坏判断改写成带文本证据和修订优先级的审稿项。',
      '区分创作、批评和修订阶段，避免边写边自我解释。',
    ],
    allowed_video_types: REVIEW_VIDEO_TYPES,
    forbidden_video_types: ['scene_short', 'landscape_mood'],
    blueprint_requirements: [
      '蓝图应声明目标受众、观看承诺和预期理解或情绪结果。',
    ],
    scene_rules: [
      '场景或段落应提供足够线索，让目标受众理解当前问题、变化和观看收益。',
    ],
    quality_rules: [
      '检查开场承诺、信息清晰度、情绪推进、模板化表达和结尾兑现。',
      '审稿结论必须引用可定位的文本现象，机器模拟不得冒充真人读者反馈。',
    ],
    repair_guidance: [
      '先修复阻断理解或破坏观看承诺的高优先级问题，再处理文风润色。',
      '保留作者意图、类型规则和文化证据边界。',
    ],
    provenance: {
      audited_at: '2026-07-31T00:00:00+08:00',
      audit_scope: [
        'README、许可证、目录结构、agents/skills/scripts 与安装流程的静态审计',
      ],
      adopted_methods: [
        'story-review 的证据化审稿',
        'reader simulation 的阅读体验观察维度',
        '写作、批评、修订分阶段',
      ],
      excluded_components: [
        'Meridian/Claude Agent 编排、hooks、bootstrap、安装命令、脚本和知识库写入流程',
      ],
      risk_notes: [
        '原仓库包含外部 Agent 编排、依赖同步和项目文件写入能力；机器读者模拟也可能制造伪人类反馈。',
      ],
      static_adaptation_only: true,
      third_party_code_executed: false,
      external_network_access_allowed: false,
      external_file_write_allowed: false,
      external_command_execution_allowed: false,
    },
    enabled: false,
  },
  {
    schema_version: 'writing-capability-profile/v1',
    capability_id: 'short_drama_develop_write_review',
    display_name: '短剧开发、写作与独立复核',
    source_repository: 'https://github.com/worldwonderer/drama-skills',
    source_commit: 'adab39cdfa001f272f03bbcf4e68ed005a43d8b6',
    source_author: 'worldwonderer',
    license: 'MIT',
    adapted_rules: [
      '将短剧开发、单集写作和独立复核分成明确阶段。',
      '用人物目标、压力、策略、局部结果和集尾交接组织短篇因果节拍。',
      '把可表演、可制作的动作与证据置于空泛说明之前。',
    ],
    allowed_video_types: ['ai_comic_drama', 'social_short'],
    forbidden_video_types: [
      'character_story',
      'historical_drama',
      'legend_story',
      'children_story',
      'culture_promo',
      'heritage_promo',
      'city_brand_promo',
      'documentary_short',
      'explainer_video',
      'lecture_video',
      'education_training',
      'scene_short',
      'landscape_mood',
    ],
    blueprint_requirements: [
      '蓝图应明确本集目标、压力来源、角色策略、局部结果和结尾钩子或传播落点。',
    ],
    scene_rules: [
      '每个节拍必须通过行动、调度、对白或可见证据推进。',
      '短剧钩子不能覆盖事实、文化、安全和权利边界。',
    ],
    quality_rules: [
      '检查目标—阻力—策略—结果的因果闭环和开场/结尾钩子的兑现。',
      '独立复核必须区分结构错误、证据判断、制作建议和风格选择。',
    ],
    repair_guidance: [
      '优先修复无行动推进、因果断裂或钩子未兑现的具体节拍。',
      '商业节奏只能用于允许类型，不能扩散为十五种类型的默认模板。',
    ],
    provenance: {
      audited_at: '2026-07-31T00:00:00+08:00',
      audit_scope: [
        'README、许可证、技能目录、Python 工具要求和生产链描述的静态审计',
      ],
      adopted_methods: [
        'short-drama-develop 的故事引擎与分集地图思路',
        'short-drama-write 的因果节拍',
        'short-drama-review 的分层复核',
      ],
      excluded_components: [
        'Python 工具、安装/链接命令、资产/图片/视频提示词链和项目文件格式',
      ],
      risk_notes: [
        '原仓库工具可读写项目文件且依赖 Python；商业钩子规则存在类型误用风险。',
      ],
      static_adaptation_only: true,
      third_party_code_executed: false,
      external_network_access_allowed: false,
      external_file_write_allowed: false,
      external_command_execution_allowed: false,
    },
    enabled: false,
  },
] as const satisfies readonly WritingCapabilityProfileV1[];

export function createWritingCapabilityRegistry(): WritingCapabilityRegistry {
  const registry = new WritingCapabilityRegistry();
  for (const profile of WRITING_CAPABILITY_PROFILES) {
    registry.register(profile);
  }
  return registry;
}

export function getWritingCapabilityCatalogReport(): WritingCapabilityCatalogReportV1 {
  const profiles = createWritingCapabilityRegistry().list();
  const enabledCount = profiles.filter(profile => profile.enabled).length;
  const report = WritingCapabilityCatalogReportV1Schema.parse({
    schema_version: 'writing-capability-catalog-report/v1',
    profile_schema_version: 'writing-capability-profile/v1',
    total_count: profiles.length,
    enabled_count: enabledCount,
    disabled_count: profiles.length - enabledCount,
    boundary: {
      catalog_only: true,
      affects_generation: false,
      third_party_code_executed: false,
      external_execution_allowed: false,
    },
    capabilities: profiles.map(profile => ({
      capability_id: profile.capability_id,
      display_name: profile.display_name,
      source_repository: profile.source_repository,
      source_commit: profile.source_commit,
      source_author: profile.source_author,
      license: profile.license,
      allowed_video_types: [...profile.allowed_video_types],
      forbidden_video_types: [...profile.forbidden_video_types],
      adapted_rule_count: profile.adapted_rules.length,
      audited_at: profile.provenance.audited_at,
      enabled: profile.enabled,
    })),
  });
  return deepFreeze(report);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
