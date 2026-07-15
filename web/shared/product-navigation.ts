export type ProductWorkspaceId = 'creation' | 'projects' | 'materials' | 'production' | 'review';

export type ProductFeatureFlag = 'internal_story_tools';

export type ProductRoleId =
  | 'creator'
  | 'research_editor'
  | 'director_reviewer'
  | 'cultural_fact_reviewer'
  | 'production_operator'
  | 'administrator';

export interface ProductRoleDefinition {
  id: ProductRoleId;
  label: string;
  description: string;
  default_route: string;
}

export interface ProductWorkspaceNavigationItem {
  id: ProductWorkspaceId;
  label: string;
  to: string;
  description: string;
}

export interface ProductSecondaryNavigationItem {
  id: string;
  workspace: ProductWorkspaceId;
  label: string;
  description: string;
  to: string;
  feature_flag?: ProductFeatureFlag;
  allowed_roles: readonly ProductRoleId[];
}

export interface ProductNavigationAccess {
  role: ProductRoleId;
  enabled_feature_flags: readonly ProductFeatureFlag[];
}

const ALL_ROLES: readonly ProductRoleId[] = [
  'creator',
  'research_editor',
  'director_reviewer',
  'cultural_fact_reviewer',
  'production_operator',
  'administrator',
];

const CREATION_ROLES: readonly ProductRoleId[] = ['creator', 'administrator'];
const MATERIAL_EDITOR_ROLES: readonly ProductRoleId[] = ['research_editor', 'cultural_fact_reviewer', 'administrator'];
const PRODUCTION_ROLES: readonly ProductRoleId[] = ['creator', 'director_reviewer', 'production_operator', 'administrator'];
const REVIEW_ROLES: readonly ProductRoleId[] = ['director_reviewer', 'cultural_fact_reviewer', 'administrator'];
const INTERNAL_PRODUCTION_ROLES: readonly ProductRoleId[] = ['director_reviewer', 'production_operator', 'administrator'];
const RELEASE_ROLES: readonly ProductRoleId[] = ['production_operator', 'administrator'];

export const PRODUCT_ROLES: readonly ProductRoleDefinition[] = [
  {
    id: 'creator',
    label: '创作者',
    description: '创建故事、修订文本并处理项目素材',
    default_route: '/story/new',
  },
  {
    id: 'research_editor',
    label: '研究编辑',
    description: '研究来源、补充素材并管理知识写回',
    default_route: '/knowledge',
  },
  {
    id: 'director_reviewer',
    label: '导演 / 类型评审',
    description: '检查修订、视听生产和终稿类型质量',
    default_route: '/workspace/review',
  },
  {
    id: 'cultural_fact_reviewer',
    label: '文化事实评审',
    description: '审查来源、事实边界和文化风险',
    default_route: '/workspace/review',
  },
  {
    id: 'production_operator',
    label: '制片运营',
    description: '推进项目生产、外部回片和发布验收',
    default_route: '/workspace/production',
  },
  {
    id: 'administrator',
    label: '管理员',
    description: '管理受控工具、权限和发布治理',
    default_route: '/projects',
  },
] as const;

export const PRODUCT_WORKSPACE_NAVIGATION: readonly ProductWorkspaceNavigationItem[] = [
  {
    id: 'creation',
    label: '创作',
    to: '/story/new',
    description: '从文化素材开始单片或系列创作',
  },
  {
    id: 'projects',
    label: '项目',
    to: '/projects',
    description: '管理项目、版本、阻塞和下一步',
  },
  {
    id: 'materials',
    label: '素材',
    to: '/knowledge',
    description: '检索、补充和治理文化素材',
  },
  {
    id: 'production',
    label: '生产',
    to: '/workspace/production',
    description: '修订、桌读、分镜和外部生产交付',
  },
  {
    id: 'review',
    label: '评审',
    to: '/workspace/review',
    description: '素材审稿、终稿盲评和发布验收',
  },
] as const;

export const PRODUCT_SECONDARY_NAVIGATION: readonly ProductSecondaryNavigationItem[] = [
  {
    id: 'single_story',
    workspace: 'creation',
    label: '单片短片',
    description: '创建一支文化短片',
    to: '/story/new',
    allowed_roles: CREATION_ROLES,
  },
  {
    id: 'comic_series',
    workspace: 'creation',
    label: '漫剧系列',
    description: '规划和制作连续剧集',
    to: '/ai-comic-series/new',
    allowed_roles: CREATION_ROLES,
  },
  {
    id: 'project_list',
    workspace: 'projects',
    label: '全部项目',
    description: '查看项目状态与阻塞',
    to: '/projects',
    allowed_roles: ALL_ROLES,
  },
  {
    id: 'knowledge_library',
    workspace: 'materials',
    label: '素材库',
    description: '浏览全国文化素材',
    to: '/knowledge',
    allowed_roles: ALL_ROLES,
  },
  {
    id: 'material_search',
    workspace: 'materials',
    label: '素材搜索',
    description: '按地区、题材和关键词检索',
    to: '/search',
    allowed_roles: ALL_ROLES,
  },
  {
    id: 'supplement_tasks',
    workspace: 'materials',
    label: '素材补充',
    description: '处理项目素材缺口',
    to: '/supplement-tasks',
    allowed_roles: ['creator', 'research_editor', 'administrator'],
  },
  {
    id: 'knowledge_writeback',
    workspace: 'materials',
    label: '写回队列',
    description: '审查可复用知识写回草案',
    to: '/knowledge-writeback-queue',
    allowed_roles: MATERIAL_EDITOR_ROLES,
  },
  {
    id: 'domain_pack_expansion',
    workspace: 'materials',
    label: '素材包候选',
    description: '审查跨项目素材包候选',
    to: '/domain-pack-expansion-queue',
    allowed_roles: MATERIAL_EDITOR_ROLES,
  },
  {
    id: 'production_projects',
    workspace: 'production',
    label: '项目生产',
    description: '从项目进入分镜、资产和交付',
    to: '/projects',
    allowed_roles: PRODUCTION_ROLES,
  },
  {
    id: 'revision_and_table_read',
    workspace: 'production',
    label: '修订与桌读',
    description: '查看版本、反馈和真实修订状态',
    to: '/story/stage6-revisions',
    allowed_roles: PRODUCTION_ROLES,
  },
  {
    id: 'real_input_intake',
    workspace: 'production',
    label: '真实输入接入',
    description: '核验项目、授权、预算和评审排期',
    to: '/story/stage6-intake',
    feature_flag: 'internal_story_tools',
    allowed_roles: INTERNAL_PRODUCTION_ROLES,
  },
  {
    id: 'revision_batch_preflight',
    workspace: 'production',
    label: '修订批次预检',
    description: '检查批次命令和不可变证据链',
    to: '/story/stage6-preflight',
    feature_flag: 'internal_story_tools',
    allowed_roles: INTERNAL_PRODUCTION_ROLES,
  },
  {
    id: 'revision_exit_audit',
    workspace: 'production',
    label: '修订退出审计',
    description: '核验两轮修订与质量增量',
    to: '/story/stage6-exit-audit',
    feature_flag: 'internal_story_tools',
    allowed_roles: INTERNAL_PRODUCTION_ROLES,
  },
  {
    id: 'initial_package_inspector',
    workspace: 'production',
    label: '初始包检查',
    description: '验证专业文本包与来源绑定',
    to: '/story/stage6-package-inspector',
    feature_flag: 'internal_story_tools',
    allowed_roles: INTERNAL_PRODUCTION_ROLES,
  },
  {
    id: 'revision_operations',
    workspace: 'production',
    label: '修订运营总控',
    description: '查看修订流程的外部阻塞',
    to: '/story/stage6-operations',
    feature_flag: 'internal_story_tools',
    allowed_roles: INTERNAL_PRODUCTION_ROLES,
  },
  {
    id: 'table_read_evidence',
    workspace: 'production',
    label: '桌读证据检查',
    description: '核验真人桌读反馈材料',
    to: '/story/stage6-table-read-inspector',
    feature_flag: 'internal_story_tools',
    allowed_roles: INTERNAL_PRODUCTION_ROLES,
  },
  {
    id: 'revision_exit_signature',
    workspace: 'production',
    label: '退出复核签名',
    description: '验证外部退出复核签名',
    to: '/story/stage6-exit-review-signature',
    feature_flag: 'internal_story_tools',
    allowed_roles: INTERNAL_PRODUCTION_ROLES,
  },
  {
    id: 'material_review',
    workspace: 'review',
    label: '素材审稿',
    description: '审查来源、文化边界和片型用途',
    to: '/story/stage7-golden-card-review',
    allowed_roles: MATERIAL_EDITOR_ROLES,
  },
  {
    id: 'final_story_review',
    workspace: 'review',
    label: '终稿盲评',
    description: '接入独立评审、终稿和授权基准',
    to: '/story/stage8-blind-review-intake',
    allowed_roles: REVIEW_ROLES,
  },
  {
    id: 'release_acceptance',
    workspace: 'review',
    label: '发布验收',
    description: '查看评审、候选与正式发布阻塞',
    to: '/story/stage8-operations',
    allowed_roles: RELEASE_ROLES,
  },
  {
    id: 'material_candidate_expansion',
    workspace: 'review',
    label: '素材候选补齐',
    description: '检查缺失片型的候选材料',
    to: '/story/stage7-golden-card-expansion',
    feature_flag: 'internal_story_tools',
    allowed_roles: MATERIAL_EDITOR_ROLES,
  },
  {
    id: 'material_review_signature',
    workspace: 'review',
    label: '素材审稿签名',
    description: '验证素材审稿的外部签名',
    to: '/story/stage7-golden-card-signature',
    feature_flag: 'internal_story_tools',
    allowed_roles: ['cultural_fact_reviewer', 'administrator'],
  },
  {
    id: 'material_review_operations',
    workspace: 'review',
    label: '素材评审总控',
    description: '查看素材与 Domain Pack 外部阻塞',
    to: '/story/stage7-operations',
    feature_flag: 'internal_story_tools',
    allowed_roles: ['research_editor', 'cultural_fact_reviewer', 'production_operator', 'administrator'],
  },
  {
    id: 'final_story_signature',
    workspace: 'review',
    label: '终稿评审签名',
    description: '验证三角色独立评审签名',
    to: '/story/stage8-blind-review-signature',
    feature_flag: 'internal_story_tools',
    allowed_roles: REVIEW_ROLES,
  },
  {
    id: 'finalization_preflight',
    workspace: 'review',
    label: '发布候选预检',
    description: '检查终稿、修订、评审和外部信任',
    to: '/story/stage8-finalization-preflight',
    feature_flag: 'internal_story_tools',
    allowed_roles: RELEASE_ROLES,
  },
  {
    id: 'durable_release_import',
    workspace: 'review',
    label: '正式发布记录核验',
    description: '只读核验外部 durable release 记录',
    to: '/story/stage8-durable-release-import',
    feature_flag: 'internal_story_tools',
    allowed_roles: RELEASE_ROLES,
  },
] as const;

export const PRESERVED_STORY_AGENT_DEEP_ROUTES = PRODUCT_SECONDARY_NAVIGATION
  .filter(item => item.to.startsWith('/story/stage'))
  .map(item => item.to);

export function productWorkspaceForPath(path: string): ProductWorkspaceId {
  if (path.startsWith('/workspace/production') || path.startsWith('/story/stage6')) return 'production';
  if (path.startsWith('/workspace/review') || path.startsWith('/story/stage7') || path.startsWith('/story/stage8')) return 'review';
  if (
    path.startsWith('/knowledge')
    || path.startsWith('/province')
    || path.startsWith('/entry')
    || path.startsWith('/search')
    || path.startsWith('/supplement-tasks')
    || path.startsWith('/domain-pack-expansion-queue')
  ) return 'materials';
  if (path.startsWith('/projects')) return 'projects';
  return 'creation';
}

export function productNavigationForWorkspace(
  workspace: ProductWorkspaceId,
  access: ProductNavigationAccess,
): ProductSecondaryNavigationItem[] {
  const enabledFlags = new Set(access.enabled_feature_flags);
  return PRODUCT_SECONDARY_NAVIGATION.filter(item => (
    item.workspace === workspace
    && item.allowed_roles.includes(access.role)
    && (!item.feature_flag || enabledFlags.has(item.feature_flag))
  ));
}

export function isProductRoleId(value: string | undefined): value is ProductRoleId {
  return PRODUCT_ROLES.some(role => role.id === value);
}

export function canAccessProductNavigationItem(
  item: ProductSecondaryNavigationItem,
  access: ProductNavigationAccess,
): boolean {
  return item.allowed_roles.includes(access.role)
    && (!item.feature_flag || access.enabled_feature_flags.includes(item.feature_flag));
}
