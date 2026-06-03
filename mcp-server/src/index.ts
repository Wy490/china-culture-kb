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
import { CultureEntry, SourceType, ScriptType } from './types.js';

const server = new McpServer({
  name: 'china-culture-kb',
  version: '0.3.0',
});

// kb_search
server.tool(
  'kb_search',
  '按关键词、类型、省份、地区检索知识库',
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
  '语义匹配知识库条目，返回条目供Claude Code做语义分析',
  {
    storyText: z.string().describe('用户上传的故事或观点文本'),
    provinceHints: z.string().optional().describe('地理线索省份，逗号分隔'),
    typeHint: z.string().optional().describe('类型判断'),
  },
  async (input) => {
    const result = await matchEntries({
      storyText: input.storyText,
      provinceHints: input.provinceHints?.split(/[，,]/) ?? undefined,
      typeHint: input.typeHint,
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
    keywords: z.string().optional().describe('关键词，逗号分隔'),
    type: z.string().optional().describe('条目类型'),
  },
  async (input) => {
    const result = await supplement({
      entryName: input.entryName,
      storyText: input.storyText,
      province: input.province,
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
    internalEvidenceCount: z.number().optional().describe('知识库内佐证条目数量'),
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
  '从知识库条目生成脚本骨架（纪录片/短剧/动画/文化解说），供Claude Code填充内容',
  {
    entry_names: z.string().describe('条目名称列表，逗号或顿号分隔'),
    script_type: z.string().describe('脚本类型：纪录片/短剧/动画/文化解说'),
    target_duration: z.string().optional().describe('目标时长，如"30分钟"'),
    title: z.string().optional().describe('脚本标题'),
  },
  async (input) => {
    const result = await generateScript({
      entry_names: input.entry_names,
      script_type: input.script_type as ScriptType,
      target_duration: input.target_duration,
      title: input.title,
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
  '从B站视频录入内容到知识库：自动获取视频元数据、创建来源记录、写入条目',
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
  '搜集文化故事和人物传记：创建来源记录+写入知识库条目',
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
  '获取知识库条目的完整详情（包含故事梗概、文化意义、来源、可信度、待核实点等全部字段）。用于故事生成的创意分析。',
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);