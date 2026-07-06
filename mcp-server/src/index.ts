import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { searchKnowledgeBase } from './tools/search.js';
import { addEntry } from './tools/add-entry.js';
import { matchEntries } from './tools/match.js';
import { supplement } from './tools/supplement.js';
import { fetchVideo } from './tools/fetch-video.js';
import { fetchArticle } from './tools/fetch-article.js';
import { verifySource } from './tools/verify-source.js';
import { generateScript } from './tools/generate-script.js';
import { queryIndex } from './tools/query-index.js';
import { addRegionEntry } from './tools/add-region-entry.js';
import { ingestVideo } from './tools/ingest-video.js';
import { collect } from './tools/collect.js';
import { getEntryDetail } from './tools/get-entry-detail.js';
import { generateStory } from './tools/generate-story.js';
import { getProjectContext } from './tools/get-project-context.js';
import { generateStoryBlueprint } from './tools/generate-story-blueprint.js';
import { validateGenreStory } from './tools/validate-genre-story.js';
import { generateGearsDelivery } from './tools/generate-gears-delivery.js';
import { generateSeedancePrompt } from './tools/generate-seedance-prompt.js';
import { generateStoryRepairPrompt, repairStory } from './tools/repair-story.js';
import { updateProjectVersion } from './tools/update-project-version.js';
import { getProductionReadiness } from './tools/get-production-readiness.js';
import { getProductionReadinessPortfolio } from './tools/get-production-readiness-portfolio.js';
import { draftProductionMaterialPack } from './tools/draft-production-material-pack.js';
import {
  getStoryAgentGeneratedGovernancePlan,
  runStoryAgentGeneratedGovernance,
} from './tools/get-generated-governance-plan.js';
import { getStoryAgentGeneratedHealth } from './tools/get-generated-health.js';
import { getStoryAgentMvpStatus } from './tools/get-story-agent-mvp-status.js';
import {
  getDomainPackProductionHealthToolResult,
  getProductionMaterialPackHealthToolResult,
} from './tools/production-health-reports.js';
import { getGearsWorkerEvidenceSignoff } from './tools/get-gears-worker-evidence-signoff.js';
import { runProductionReadinessAutomation } from './tools/run-production-readiness-automation.js';
import { runProductionReadinessPortfolioAutomationBridge } from './tools/run-production-readiness-portfolio-automation.js';
import { CultureEntry, SourceType, ScriptType } from './types.js';

const server = new McpServer({
  name: 'china-culture-kb',
  version: '0.3.0',
});

// kb_search
server.tool(
  'kb_search',
  '按关键词、类型、省份、地区检索素材库',
  {
    keywords: z.string().describe('搜索关键词，多个关键词用逗号或空格分隔'),
    type: z.string().optional().describe('条目类型过滤'),
    province: z.string().optional().describe('省份过滤'),
    region: z.string().optional().describe('地区/城市过滤'),
  },
  async (input) => {
    const results = await searchKnowledgeBase(input);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }
);

// kb_add_entry
server.tool(
  'kb_add_entry',
  '写入文化条目到省份文件',
  {
    name: z.string().describe('条目名称'),
    province: z.string().describe('省份'),
    region: z.string().describe('地区/城市'),
    type: z.string().describe('类型'),
    summary: z.string().describe('简介'),
    story: z.string().describe('故事梗概'),
    culturalSignificance: z.string().describe('文化意义'),
    relatedLocations: z.string().describe('相关地点，JSON数组'),
    keywords: z.string().describe('关键词，逗号分隔'),
    sources: z.string().describe('来源列表，JSON数组'),
    credibility: z.string().describe('可信度'),
    verificationMethod: z.string().optional().describe('核实方法标注'),
    unverifiedPoints: z.string().describe('待核实点，JSON数组'),
  },
  async (input) => {
    const entry: CultureEntry = {
      name: input.name,
      province: input.province,
      region: input.region,
      type: input.type as CultureEntry['type'],
      summary: input.summary,
      story: input.story,
      culturalSignificance: input.culturalSignificance,
      relatedLocations: JSON.parse(input.relatedLocations),
      keywords: input.keywords.split(/[，,、]/),
      sources: JSON.parse(input.sources),
      credibility: input.credibility as CultureEntry['credibility'],
      verificationMethod: input.verificationMethod,
      unverifiedPoints: JSON.parse(input.unverifiedPoints),
    };
    const result = await addEntry(entry);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_match
server.tool(
  'kb_match',
  '语义匹配素材条目，返回条目供Claude Code做创意分析',
  {
    storyText: z.string().describe('用户上传的故事或观点文本'),
    provinceHints: z.string().optional().describe('地理线索省份，逗号分隔'),
    typeHint: z.string().optional().describe('类型判断'),
    regionHint: z.string().optional().describe('地市/县区等地方化线索，例如长沙、岳麓'),
  },
  async (input) => {
    const result = await matchEntries({
      storyText: input.storyText,
      provinceHints: input.provinceHints?.split(/[，,]/) ?? undefined,
      typeHint: input.typeHint,
      regionHint: input.regionHint,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_supplement
server.tool(
  'kb_supplement',
  '三维度补充：版本差异、同地同类、关联网络',
  {
    entryName: z.string().optional().describe('条目名称'),
    storyText: z.string().optional().describe('故事文本'),
    province: z.string().optional().describe('当前条目所属省份'),
    region: z.string().optional().describe('甲方指定的地方化目标，例如长沙、岳麓'),
    keywords: z.string().optional().describe('关键词，逗号分隔'),
    type: z.string().optional().describe('条目类型'),
  },
  async (input) => {
    const result = await supplement({
      entryName: input.entryName,
      storyText: input.storyText,
      province: input.province,
      region: input.region,
      keywords: input.keywords?.split(/[，,、]/) ?? undefined,
      type: input.type,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_fetch_video
server.tool(
  'kb_fetch_video',
  '从B站视频抓取内容信息',
  {
    bvId: z.string().optional().describe('BV号'),
    url: z.string().optional().describe('B站视频链接'),
  },
  async (input) => {
    const result = await fetchVideo(input);
    if (!result) {
      return { content: [{ type: 'text', text: '无法获取视频信息，请检查BV号或链接' }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_fetch_article
server.tool(
  'kb_fetch_article',
  '从网页文章抓取内容',
  {
    url: z.string().describe('文章链接'),
  },
  async (input) => {
    const result = await fetchArticle(input);
    if (!result) {
      return { content: [{ type: 'text', text: '无法获取文章内容，请检查链接' }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_verify_source
server.tool(
  'kb_verify_source',
  '核查来源可信度。混合策略：外部权威优先+内部互证补充',
  {
    sourceType: z.string().describe('来源类型：bilibili|article|book|oral'),
    sourceUrl: z.string().optional().describe('来源链接'),
    sourceAuthor: z.string().optional().describe('来源作者'),
    claims: z.string().describe('待核实主张内容'),
    externalVerificationResults: z.string().optional().describe('外部搜索核实结果'),
    internalEvidenceCount: z.number().optional().describe('素材库内佐证条目数量'),
  },
  async (input) => {
    const result = await verifySource({
      sourceType: input.sourceType as SourceType,
      sourceUrl: input.sourceUrl,
      sourceAuthor: input.sourceAuthor,
      claims: input.claims,
      externalVerificationResults: input.externalVerificationResults,
      internalEvidenceCount: input.internalEvidenceCount,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_generate_script
server.tool(
  'kb_generate_script',
  '从素材条目生成脚本骨架（纪录片/短剧/动画/文化解说），供Claude Code填充内容',
  {
    entry_names: z.string().describe('条目名称列表，逗号或顿号分隔'),
    script_type: z.string().describe('脚本类型：纪录片/短剧/动画/文化解说'),
    target_duration: z.string().optional().describe('目标时长，如"30分钟"'),
    title: z.string().optional().describe('脚本标题'),
    creation_use_case: z.string().optional().describe('创作场景，例如 original_ai_comic/adapted_ai_comic/institutional_promo/documentary_short'),
    truth_mode: z.string().optional().describe('真实度模式，例如 fictional_original/source_adaptation/factual_reconstruction/institutional_verified'),
    client_type: z.string().optional().describe('客户或机构类型，例如 政府机构/协会/品牌方'),
    target_audience: z.string().optional().describe('目标受众'),
    communication_goal: z.string().optional().describe('传播或创作目标'),
  },
  async (input) => {
    const result = await generateScript({
      entry_names: input.entry_names,
      script_type: input.script_type as ScriptType,
      target_duration: input.target_duration,
      title: input.title,
      creation_use_case: input.creation_use_case,
      truth_mode: input.truth_mode,
      client_type: input.client_type,
      target_audience: input.target_audience,
      communication_goal: input.communication_goal,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_query_index
server.tool(
  'kb_query_index',
  '动态查询索引：按类型/关键词/地区聚合条目',
  {
    query_type: z.string().describe('查询维度：by_type/by_keyword/by_region'),
    filter: z.string().describe('过滤值，如"神话传说"、"端午"、"岳阳"'),
    province: z.string().optional().describe('限定省份范围'),
  },
  async (input) => {
    const result = await queryIndex({
      query_type: input.query_type,
      filter: input.filter,
      province: input.province,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_add_region_entry
server.tool(
  'kb_add_region_entry',
  '按地区分组写入文化条目到省份文件（三级标题分组）',
  {
    name: z.string().describe('条目名称'),
    province: z.string().describe('省份'),
    region: z.string().describe('地区/城市'),
    type: z.string().describe('类型'),
    summary: z.string().describe('简介'),
    story: z.string().describe('故事梗概'),
    culturalSignificance: z.string().describe('文化意义'),
    relatedLocations: z.string().describe('相关地点，JSON数组'),
    keywords: z.string().describe('关键词，逗号分隔'),
    sources: z.string().describe('来源列表，JSON数组'),
    credibility: z.string().describe('可信度'),
    verificationMethod: z.string().optional().describe('核实方法标注'),
    unverifiedPoints: z.string().describe('待核实点，JSON数组'),
  },
  async (input) => {
    const entry: CultureEntry = {
      name: input.name,
      province: input.province,
      region: input.region,
      type: input.type as CultureEntry['type'],
      summary: input.summary,
      story: input.story,
      culturalSignificance: input.culturalSignificance,
      relatedLocations: JSON.parse(input.relatedLocations),
      keywords: input.keywords.split(/[，,、]/),
      sources: JSON.parse(input.sources),
      credibility: input.credibility as CultureEntry['credibility'],
      verificationMethod: input.verificationMethod,
      unverifiedPoints: JSON.parse(input.unverifiedPoints),
    };
    const result = await addRegionEntry(entry);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_ingest_video
server.tool(
  'kb_ingest_video',
  '从B站视频录入内容到素材库：自动获取视频元数据、创建来源记录、写入条目',
  {
    video_url: z.string().describe('B站视频链接或BV号'),
    name: z.string().describe('条目名称'),
    province: z.string().describe('省份'),
    region: z.string().describe('地区/城市'),
    type: z.string().describe('条目类型'),
    summary: z.string().describe('简介（从视频提取的内容）'),
    story: z.string().describe('故事梗概（从视频提取的内容）'),
    culturalSignificance: z.string().describe('文化意义'),
    relatedLocations: z.string().describe('相关地点，JSON数组'),
    keywords: z.string().describe('关键词，逗号分隔'),
    credibility: z.string().describe('可信度'),
    unverifiedPoints: z.string().describe('待核实点，JSON数组'),
    verificationMethod: z.string().optional().describe('核实方法标注'),
  },
  async (input) => {
    const result = await ingestVideo({
      video_url: input.video_url,
      name: input.name,
      province: input.province,
      region: input.region,
      type: input.type,
      summary: input.summary,
      story: input.story,
      culturalSignificance: input.culturalSignificance,
      relatedLocations: input.relatedLocations,
      keywords: input.keywords,
      credibility: input.credibility,
      unverifiedPoints: input.unverifiedPoints,
      verificationMethod: input.verificationMethod,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_collect
server.tool(
  'kb_collect',
  '搜集文化故事和人物传记：创建来源记录+写入素材条目',
  {
    name: z.string().describe('人物/故事名称'),
    province: z.string().describe('省份'),
    region: z.string().describe('地区/城市'),
    type: z.string().describe('条目类型（历史人物/神话传说/民间故事等）'),
    summary: z.string().describe('简介'),
    story: z.string().describe('故事梗概/人物传记'),
    culturalSignificance: z.string().describe('文化意义'),
    relatedLocations: z.string().describe('相关地点，JSON数组'),
    keywords: z.string().describe('关键词，逗号分隔'),
    credibility: z.string().describe('可信度'),
    unverifiedPoints: z.string().describe('待核实点，JSON数组'),
    verificationMethod: z.string().optional().describe('核实方法标注'),
    source_type: z.string().describe('来源类型：article/book/oral'),
    source_url: z.string().optional().describe('来源链接（article时建议提供）'),
    source_title: z.string().describe('来源标题'),
    source_author: z.string().optional().describe('来源作者/讲述人'),
    source_platform: z.string().optional().describe('来源平台（自动识别时可不填）'),
    source_publishDate: z.string().optional().describe('来源发布日期'),
    source_narrator: z.string().optional().describe('讲述人姓名（oral类型）'),
    source_narratorInfo: z.string().optional().describe('讲述人背景（oral类型）'),
    source_location: z.string().optional().describe('讲述地点（oral类型）'),
    source_date: z.string().optional().describe('讲述日期（oral类型）'),
    source_recorder: z.string().optional().describe('记录人（oral类型）'),
  },
  async (input) => {
    const result = await collect({
      name: input.name,
      province: input.province,
      region: input.region,
      type: input.type,
      summary: input.summary,
      story: input.story,
      culturalSignificance: input.culturalSignificance,
      relatedLocations: input.relatedLocations,
      keywords: input.keywords,
      credibility: input.credibility,
      unverifiedPoints: input.unverifiedPoints,
      verificationMethod: input.verificationMethod,
      source_type: input.source_type,
      source_url: input.source_url,
      source_title: input.source_title,
      source_author: input.source_author,
      source_platform: input.source_platform,
      source_publishDate: input.source_publishDate,
      source_narrator: input.source_narrator,
      source_narratorInfo: input.source_narratorInfo,
      source_location: input.source_location,
      source_date: input.source_date,
      source_recorder: input.source_recorder,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// kb_get_entry_detail — retrieve full entry content including story, sources, credibility, unverified points
server.tool(
  'kb_get_entry_detail',
  '获取素材条目的完整详情（包含故事梗概、文化意义、来源、可信度、待核实点等全部字段）。用于故事生成的创意分析。',
  {
    entry_name: z.string().describe('条目名称'),
  },
  async (input) => {
    const result = await getEntryDetail(input.entry_name);
    if (!result) {
      return { content: [{ type: 'text', text: `未找到条目：${input.entry_name}` }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_generate_story — write Claude Code generated story_text to file
server.tool(
  'kb_generate_story',
  '将Claude Code生成的故事文本写入文件。包含故事核心、主角、冲突、转折、结尾、文化元素、不可误写、可信度边界8个元素。',
  {
    title: z.string().describe('故事标题'),
    story_text: z.string().describe('Claude Code生成的完整故事文本（自然语言叙述，包含8个故事元素）'),
    entry_names: z.string().describe('来源条目名称，逗号分隔'),
    script_type: z.string().describe('脚本类型：纪录片|短剧|动画|文化解说'),
    creation_use_case: z.string().optional().describe('创作场景，例如 original_ai_comic/adapted_ai_comic/institutional_promo/documentary_short'),
    truth_mode: z.string().optional().describe('真实度模式，例如 fictional_original/source_adaptation/factual_reconstruction/institutional_verified'),
    client_type: z.string().optional().describe('客户或机构类型，例如 政府机构/协会/品牌方'),
    target_audience: z.string().optional().describe('目标受众'),
    communication_goal: z.string().optional().describe('传播或创作目标'),
  },
  async (input) => {
    const result = await generateStory(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_get_project_context — retrieve Story Agent project metadata, current story, versions, and optional exports
server.tool(
  'kb_get_project_context',
  '读取 Story Agent 故事项目上下文（项目元数据、当前故事、版本摘要，可选完整版本快照和导出列表）。只读，不修改项目文件。',
  {
    project_id: z.string().describe('故事项目 ID，例如 20260614-story-5xim--ai_comic_drama'),
    include_versions: z.boolean().optional().describe('是否返回完整版本快照，默认 false'),
    include_exports: z.boolean().optional().describe('是否返回 exports 文件列表，默认 false'),
  },
  async (input) => {
    const result = await getProjectContext(input);
    if (!result) {
      return { content: [{ type: 'text', text: `未找到项目：${input.project_id}` }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_get_production_readiness — read production command readiness for project or series
server.tool(
  'kb_get_production_readiness',
  '读取单故事项目或 AI 漫剧系列项目的生产 readiness 指挥报告。只读，汇总质量、交付、GEARS 账本、审片返修和下一步动作。',
  {
    project_id: z.string().optional().describe('故事项目 ID，例如 20260614-story-5xim--ai_comic_drama'),
    series_project_id: z.string().optional().describe('AI 漫剧系列项目 ID，例如 20260619-series-r0v5zyag'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = await getProductionReadiness(input);
    if (!result) {
      return { content: [{ type: 'text', text: '未找到项目或系列项目' }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_draft_production_pack — draft a candidate ProductionMaterialPack from reviewed source observations
server.tool(
  'kb_draft_production_pack',
  '为指定 video_type 生成生产素材模板草案。只读正式 packs，可额外传入 JSON 来源观察；返回候选 ProductionMaterialPack、审稿清单和警告，不自动写入正式模板。',
  {
    videoType: z.string().describe('目标成片类型，例如 social_short、explainer_video、ai_comic_drama'),
    label: z.string().optional().describe('可选模板标签'),
    goal: z.string().optional().describe('可选模板目标'),
    sourceObservations: z.string().optional().describe('可选 JSON 数组，元素包含 source_id、applies_to_video_types、usable_takeaways 等字段'),
  },
  async (input) => {
    const additionalObservations = input.sourceObservations
      ? JSON.parse(input.sourceObservations)
      : undefined;
    const result = await draftProductionMaterialPack({
      videoType: input.videoType,
      label: input.label,
      goal: input.goal,
      additionalObservations,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_get_production_readiness_portfolio — read cross-project production command portfolio
server.tool(
  'kb_get_production_readiness_portfolio',
  '读取本地 Story Agent 单故事项目与 AI 漫剧系列项目的 production readiness 组合总览。只读，按阻断、分数、自动化步骤和下一步动作生成优先队列。',
  {
    limit: z.number().int().positive().max(100).optional().describe('最多返回多少个优先目标，默认 30'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = await getProductionReadinessPortfolio(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_get_story_agent_generated_health — read generated Story Agent artifact health
server.tool(
  'kb_get_story_agent_generated_health',
  '读取本地 Story Agent generated 项目健康体检。只读扫描故事项目、AI 漫剧系列、generated stories 和 versions，区分 ready/planned/production_gap/interrupted。',
  {
    limit: z.number().int().positive().max(100).optional().describe('最多返回多少个高风险目标，默认 30'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = await getStoryAgentGeneratedHealth(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_get_story_agent_generated_governance_plan — read generated cleanup/relink plan
server.tool(
  'kb_get_story_agent_generated_governance_plan',
  '读取本地 Story Agent generated 治理计划。只读分桶 relink、archive/rebuild、补合同、单故事引用修复和 GEARS signoff 候选，不修改 generated 文件。',
  {
    limit: z.number().int().positive().max(100).optional().describe('每类动作最多返回多少个样本目标，默认 20'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = await getStoryAgentGeneratedGovernancePlan(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_run_story_agent_generated_governance — build dry-run generated governance manifest
server.tool(
  'kb_run_story_agent_generated_governance',
  '生成 Story Agent generated 治理 dry-run manifest。只读输出预期操作和文件变化；dry_run=false 会被阻断，不修改 generated 文件。',
  {
    dry_run: z.boolean().optional().describe('默认 true；false 会返回 blocked，不执行写入'),
    action_keys: z.array(z.enum([
      'restore_or_relink_series_story_refs',
      'archive_or_rebuild_series_fixtures',
      'generate_first_series_episode',
      'repair_series_command_contracts',
      'repair_story_project_refs',
      'promote_ready_targets_for_gears_signoff',
    ])).max(6).optional().describe('限定要生成 manifest 的动作分桶'),
    project_ids: z.array(z.string().min(1).max(160)).max(100).optional().describe('限定项目 ID 或系列项目 ID 列表'),
    max_targets: z.number().int().positive().max(100).optional().describe('最多返回多少个 manifest 目标，默认 20'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = await runStoryAgentGeneratedGovernance(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_get_production_material_pack_health — read production material pack portfolio health
server.tool(
  'kb_get_production_material_pack_health',
  '只读扫描 ProductionMaterialPack 组合体健康。检查核心/高频成片类型模板覆盖、required_fields 映射、prompt layers、三阶段 gate、补充问题和样板条目下限。',
  {
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = getProductionMaterialPackHealthToolResult(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_get_domain_pack_production_health — read Domain Pack production prompt health
server.tool(
  'kb_get_domain_pack_production_health',
  '只读扫描 Domain Pack 生产提示健康。检查非遗流程、纪录片来源、AI漫剧分镜、朝代服饰器物、讲解知识结构、儿童改写、短视频钩子和宣讲培训结构包的生产提示与审稿边界。',
  {
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = getDomainPackProductionHealthToolResult(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_get_story_agent_mvp_status — read Story Agent MVP command status
server.tool(
  'kb_get_story_agent_mvp_status',
  '读取本地 Story Agent MVP 状态总控。只读组合 generated health、generated governance、生产素材包健康、Domain Pack 健康与 production readiness portfolio，输出生成物、Generated 治理、模板/提示包、质量、修复、交付合同和生产指挥 lane。',
  {
    generated_limit: z.number().int().positive().max(100).optional().describe('generated health 最多返回多少个目标，默认 100'),
    portfolio_limit: z.number().int().positive().max(100).optional().describe('production readiness portfolio 最多返回多少个目标，默认 100'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = await getStoryAgentMvpStatus(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_get_gears_worker_evidence_signoff — read GEARS worker acceptance evidence
server.tool(
  'kb_get_gears_worker_evidence_signoff',
  '读取 GEARS worker acceptance evidence 目录并生成签收摘要。只读，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。',
  {
    evidence_dir: z.string().optional().describe('证据目录；不传时读取 GEARS_EVIDENCE_DIR。允许 /private/tmp、/tmp、TMPDIR 或仓库内路径。'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = await getGearsWorkerEvidenceSignoff(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_run_production_readiness_portfolio_automation — bridge MCP to the safe Web/API portfolio runner
server.tool(
  'kb_run_production_readiness_portfolio_automation',
  '通过 Story Agent Web/API 按 production readiness portfolio 优先队列批量运行安全自动化步骤。只触发 can_auto_execute=true 的指挥层步骤，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。',
  {
    dry_run: z.boolean().optional().describe('是否只演练自动化步骤，默认 true'),
    include_archived_series: z.boolean().optional().describe('是否包含已归档系列，默认 false'),
    max_targets: z.number().int().positive().max(20).optional().describe('最多处理多少个高优先目标，默认 5'),
    per_target_max_steps: z.number().int().positive().max(12).optional().describe('每个目标最多执行/演练多少个安全步骤，默认 4'),
    min_priority_score: z.number().int().min(0).max(300).optional().describe('只处理 priority_score 不低于该值的目标'),
    scopes: z.array(z.enum(['story_project', 'ai_comic_series'])).optional().describe('限定目标范围'),
    project_ids: z.array(z.string()).optional().describe('限定项目 ID 或系列项目 ID 列表'),
    action_keys: z.array(z.string()).optional().describe('限定每个目标要执行的 action_key 列表'),
    stop_on_error: z.boolean().optional().describe('遇到失败目标是否停止，默认 true'),
    story_agent_base_url: z.string().optional().describe('Story Agent Web/API 根地址；不传时读取 STORY_AGENT_BASE_URL'),
    timeout_ms: z.number().int().positive().max(120000).optional().describe('请求 Story Agent API 的超时时间，默认 30000ms'),
    include_portfolio_fallback: z.boolean().optional().describe('Web/API 不可用时是否返回本地 portfolio fallback，默认 true'),
  },
  async (input) => {
    const result = await runProductionReadinessPortfolioAutomationBridge(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_run_production_readiness_automation — bridge MCP to the safe Story Agent Web/API automation runner
server.tool(
  'kb_run_production_readiness_automation',
  '通过 Story Agent Web/API 安全执行单故事或 AI 漫剧系列项目的 production readiness 自动化步骤。只会触发 can_auto_execute=true 的指挥层步骤，不执行 GEARS worker、Seedance SDK、ffmpeg 或最终媒体合成。',
  {
    project_id: z.string().optional().describe('故事项目 ID，例如 20260614-story-5xim--ai_comic_drama'),
    series_project_id: z.string().optional().describe('AI 漫剧系列项目 ID，例如 20260619-series-r0v5zyag'),
    dry_run: z.boolean().optional().describe('是否只演练自动化步骤，默认 true'),
    max_steps: z.number().int().positive().max(20).optional().describe('最多执行/演练多少个步骤，默认 6'),
    action_keys: z.array(z.string()).optional().describe('限定要执行的 action_key 列表；不传则按 readiness runner 排序执行安全步骤'),
    stop_on_error: z.boolean().optional().describe('遇到失败是否停止，默认 true'),
    story_agent_base_url: z.string().optional().describe('Story Agent Web/API 根地址；不传时读取 STORY_AGENT_BASE_URL'),
    timeout_ms: z.number().int().positive().max(120000).optional().describe('请求 Story Agent API 的超时时间，默认 30000ms'),
    include_readiness_fallback: z.boolean().optional().describe('Web/API 不可用时是否返回本地 readiness fallback，默认 true'),
  },
  async (input) => {
    const result = await runProductionReadinessAutomation(input);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_generate_story_blueprint — build genre-aware StoryBlueprint from a knowledge-base entry
server.tool(
  'kb_generate_story_blueprint',
  '根据素材条目生成 Story Agent 类型片蓝图（StoryBlueprint）。只读，不生成正文，不写文件。',
  {
    entry_name: z.string().describe('素材条目名称，例如 周敦颐——理学开山鼻祖'),
    video_type: z.string().optional().describe('成片类型，例如 character_story/historical_drama/ai_comic_drama/heritage_promo'),
    presentation_style: z.string().optional().describe('表现形式，例如 cinematic/ai_comic/documentary'),
    story_structure: z.string().optional().describe('叙事结构，例如 single_event_drama/case_reconstruction/craft_process'),
    target_duration: z.string().optional().describe('目标时长，例如 30秒/1分钟/3分钟/5分钟/10分钟'),
    central_event: z.string().optional().describe('中心事件或本集核心事件'),
    user_outline: z.string().optional().describe('用户大纲或创作方向，只作为创作边界'),
    region_hint: z.string().optional().describe('地方化目标，例如 长沙/岳麓'),
    creation_use_case: z.string().optional().describe('创作场景，例如 original_ai_comic/adapted_ai_comic/institutional_promo/documentary_short'),
    truth_mode: z.string().optional().describe('真实度模式，例如 fictional_original/source_adaptation/factual_reconstruction/institutional_verified'),
    client_type: z.string().optional().describe('客户或机构类型，例如 政府机构/协会/品牌方'),
    target_audience: z.string().optional().describe('目标受众'),
    communication_goal: z.string().optional().describe('传播或创作目标'),
  },
  async (input) => {
    const result = await generateStoryBlueprint({
      entry_name: input.entry_name,
      video_type: input.video_type as Parameters<typeof generateStoryBlueprint>[0]['video_type'],
      presentation_style: input.presentation_style as Parameters<typeof generateStoryBlueprint>[0]['presentation_style'],
      story_structure: input.story_structure as Parameters<typeof generateStoryBlueprint>[0]['story_structure'],
      target_duration: input.target_duration as Parameters<typeof generateStoryBlueprint>[0]['target_duration'],
      central_event: input.central_event,
      user_outline: input.user_outline,
      region_hint: input.region_hint,
      creation_use_case: input.creation_use_case as Parameters<typeof generateStoryBlueprint>[0]['creation_use_case'],
      truth_mode: input.truth_mode as Parameters<typeof generateStoryBlueprint>[0]['truth_mode'],
      client_type: input.client_type,
      target_audience: input.target_audience,
      communication_goal: input.communication_goal,
    });
    if (!result) {
      return { content: [{ type: 'text', text: `未找到条目：${input.entry_name}` }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_validate_genre_story — validate Story Agent output against video-type quality expectations
server.tool(
  'kb_validate_genre_story',
  '校验 Story Agent 结果是否符合所选成片类型要求。只读，可从 project_id、story_id 或 story_json 读取。',
  {
    project_id: z.string().optional().describe('故事项目 ID，优先读取当前版本'),
    story_id: z.string().optional().describe('故事 ID，读取 web/generated/stories 下的故事 JSON'),
    story_json: z.string().optional().describe('直接传入 StoryGenerateResult JSON 字符串'),
    include_repair_actions: z.boolean().optional().describe('是否返回修复建议，默认 true'),
  },
  async (input) => {
    const result = await validateGenreStory(input);
    if (!result) {
      return { content: [{ type: 'text', text: '未找到可校验的故事或项目' }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_generate_story_repair_prompt — generate model prompt package for repaired_story_json
server.tool(
  'kb_generate_story_repair_prompt',
  '生成用于模型产出 repaired_story_json 的只读修复提示包。不会写文件；后续应先校验，再交给 kb_repair_story(auto_apply=true) 安全写入新版本。',
  {
    project_id: z.string().optional().describe('故事项目 ID，优先读取当前版本'),
    story_id: z.string().optional().describe('故事 ID，读取 web/generated/stories 下的故事 JSON'),
    story_json: z.string().optional().describe('直接传入 StoryGenerateResult JSON 字符串'),
    user_instruction: z.string().optional().describe('补充修复要求，会写入提示包但不直接执行'),
    include_story_json: z.boolean().optional().describe('是否在提示包中包含完整原始故事 JSON，默认 true'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
    max_actions: z.number().int().min(1).max(50).optional().describe('最多纳入多少条修复动作，默认 12'),
  },
  async (input) => {
    const result = await generateStoryRepairPrompt(input);
    if (!result) {
      return { content: [{ type: 'text', text: '未找到可生成修复提示包的故事或项目' }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_repair_story — dry-run repair plan generation and optional safe apply
server.tool(
  'kb_repair_story',
  '生成 Story Agent 修复建议。可从 project_id、story_id 或 story_json 读取；auto_apply=true 且提供 repaired_story_json 时，会通过 kb_update_project_version 写入新版本。',
  {
    project_id: z.string().optional().describe('故事项目 ID，优先读取当前版本'),
    story_id: z.string().optional().describe('故事 ID，读取 web/generated/stories 下的故事 JSON'),
    story_json: z.string().optional().describe('直接传入 StoryGenerateResult JSON 字符串'),
    repaired_story_json: z.string().optional().describe('修复后的 StoryGenerateResult JSON；auto_apply=true 时必须提供，工具不会自行虚构修复正文'),
    user_instruction: z.string().optional().describe('修复说明；auto_apply=true 时会保存为版本 note'),
    auto_apply: z.boolean().optional().describe('是否自动写入修复；只有提供 project_id 和 repaired_story_json 时才会新增项目版本'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
    max_actions: z.number().int().min(1).max(50).optional().describe('最多返回多少条修复动作，默认 12'),
  },
  async (input) => {
    const result = await repairStory(input);
    if (!result) {
      return { content: [{ type: 'text', text: '未找到可修复的故事或项目' }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_update_project_version — append a new Story Agent project version
server.tool(
  'kb_update_project_version',
  '将 Agent 产出的 story snapshot 保存为项目新版本。只写 web/generated/projects/<projectId>/versions 和 project.json，不覆盖旧版本，不写底层素材省份文件。',
  {
    project_id: z.string().describe('故事项目 ID，例如 20260614-story-5xim--ai_comic_drama'),
    change_type: z.enum(['scene_regeneration', 'quality_repair', 'production_board_repair']).describe('版本变更类型'),
    change_target: z.object({
      scene_ids: z.array(z.number().int().positive()).optional().describe('本次变更涉及的场景 ID；不传时会根据场景快照差异推断'),
    }).optional().describe('变更目标范围'),
    snapshot_json: z.string().describe('要保存为新版本的 StoryGenerateResult JSON 字符串。可省略部分关键字段，工具会从当前版本补回。'),
    user_instruction: z.string().optional().describe('本次写入说明，会保存到版本 note'),
  },
  async (input) => {
    const result = await updateProjectVersion(input);
    if (!result) {
      return { content: [{ type: 'text', text: `未找到项目：${input.project_id}` }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_generate_gears_delivery — read-only GEARS delivery package generation
server.tool(
  'kb_generate_gears_delivery',
  '生成 GEARS 只读交付包。可从 project_id、story_id 或 story_json 读取，返回 units、assets、validation notes，不写项目文件。',
  {
    project_id: z.string().optional().describe('故事项目 ID，优先读取当前版本'),
    story_id: z.string().optional().describe('故事 ID，读取 web/generated/stories 下的故事 JSON'),
    story_json: z.string().optional().describe('直接传入 StoryGenerateResult JSON 字符串'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = await generateGearsDelivery(input);
    if (!result) {
      return { content: [{ type: 'text', text: '未找到可生成 GEARS 交付包的故事或项目' }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// kb_generate_seedance_prompt — read-only Seedance prompt package generation
server.tool(
  'kb_generate_seedance_prompt',
  '生成 Seedance 2.0 只读提示词包。可从 project_id、story_id 或 story_json 读取，返回 shot_units、asset_references、material_validation，不写项目文件。',
  {
    project_id: z.string().optional().describe('故事项目 ID，优先读取当前版本'),
    story_id: z.string().optional().describe('故事 ID，读取 web/generated/stories 下的故事 JSON'),
    story_json: z.string().optional().describe('直接传入 StoryGenerateResult JSON 字符串'),
    include_markdown: z.boolean().optional().describe('是否返回 Markdown，默认 true'),
  },
  async (input) => {
    const result = await generateSeedancePrompt(input);
    if (!result) {
      return { content: [{ type: 'text', text: '未找到可生成 Seedance 提示词包的故事或项目' }] };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
