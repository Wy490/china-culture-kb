import type {
  EntryDetail,
  StoryGenerateResult,
  VideoType,
} from '@shared/types.js';
import type { StoryAssembly } from '../../platform/story-model-output-merge.js';
import { extractQuotes } from '../../services/dramatic-story.js';
import type { StoryGenerationModelOutput } from '../../services/story-generation-prompt.js';

function extractChinaCultureProcessFromStory(storyText: string): string | null {
  const processKeywords = [
    '制作', '制造', '工序', '步骤', '流程', '工艺', '技法', '手法',
    '过程', '编制', '织造', '雕刻', '酿造', '烧制', '铸造',
  ];
  const paragraphs = storyText.split(/\n\n+/).filter(paragraph => paragraph.trim());
  const processParagraph = paragraphs.find(paragraph => (
    processKeywords.some(keyword => paragraph.includes(keyword))
  ));
  if (!processParagraph) return null;

  return `核心技艺流程：${processParagraph.replace(/\*\*/g, '').substring(0, 80)}`;
}

function relatedLocationNames(entry: EntryDetail): string[] {
  return entry.relatedLocations
    .map(location => typeof location === 'string' ? location : location.name ?? '')
    .filter(Boolean);
}

function uniqueStrings(items: string[]): string[] {
  return items.filter((item, index) => item.trim() && items.indexOf(item) === index);
}

function firstSentence(text: string | undefined): string | undefined {
  return text?.split(/[。！？!?]/).map(item => item.trim()).find(Boolean);
}

export function deriveChinaCultureTypeSpecificStoryFields(input: {
  videoType: VideoType;
  storyResult: StoryAssembly;
  modelOutput?: StoryGenerationModelOutput | null;
  entry: EntryDetail;
}): Partial<StoryGenerateResult> {
  const { videoType, storyResult, modelOutput, entry } = input;
  if (videoType === 'culture_promo' || videoType === 'heritage_promo'
    || videoType === 'city_brand_promo' || videoType === 'social_short') {
    const quotes = extractQuotes(entry.story);
    const visualSymbols = uniqueStrings([
      ...relatedLocationNames(entry).slice(0, 2),
      ...entry.keywords.filter(keyword => !['人物', '故事', '历史'].includes(keyword)).slice(0, 3),
    ]);
    const modernScene = storyResult.scene_breakdown.find(scene => (
      scene.dramatic_function === '现代传承'
      || (videoType === 'city_brand_promo' && /人文风貌|生活气息/.test(scene.dramatic_function))
    ));
    const endingNarration = storyResult.scene_breakdown.at(-1)?.dialogue_or_narration
      ?.replace(/^旁白[：:]/, '')
      .trim();
    const cultureSubject = entry.name.split('——')[0]?.trim() || entry.name;
    const cultureTheme = firstSentence(entry.culturalSignificance);
    return {
      visual_symbols: modelOutput?.visual_symbols ?? visualSymbols,
      craft_or_ritual_process: modelOutput?.craft_or_ritual_process
        ?? extractChinaCultureProcessFromStory(entry.story)
        ?? (videoType === 'heritage_promo'
          ? `核心技艺流程：${entry.keywords.slice(0, 3).join('→')}`
          : undefined),
      modern_connection: modelOutput?.modern_connection
        ?? (videoType === 'culture_promo' || videoType === 'city_brand_promo' ? modernScene?.plot : undefined)
        ?? entry.culturalSignificance?.substring(0, 80)
        ?? `${entry.name}在现代的文化传承与创新`,
      core_message: modelOutput?.core_message
        ?? (videoType === 'culture_promo' && cultureTheme
          ? `让观众从${visualSymbols.slice(0, 2).join('与') || cultureSubject}看见：${cultureTheme}`
          : videoType === 'city_brand_promo'
            ? '让文化游客与本地市民沿岳麓书院到城市日常的路线，看见长沙如何把文脉继续变成学习与提问。'
          : storyResult.logline),
      slogan_or_key_sentence: modelOutput?.slogan_or_key_sentence
        ?? ((videoType === 'culture_promo' || videoType === 'city_brand_promo')
          && endingNarration && endingNarration.length <= 72
          ? endingNarration
          : quotes.length > 0 ? quotes[0] : `${entry.type}之光——${cultureSubject}`),
    };
  }

  if (videoType === 'scene_short' || videoType === 'landscape_mood') {
    return {
      spatial_identity: modelOutput?.spatial_identity
        ?? `${entry.region}·${relatedLocationNames(entry).slice(0, 2).join('、')}`,
      visual_route: modelOutput?.visual_route
        ?? storyResult.scene_breakdown.map(scene => `${scene.title}：${scene.visual_prompt}`),
      time_layer: modelOutput?.time_layer
        ?? (videoType === 'landscape_mood'
          ? `${storyResult.scene_breakdown.map(scene => scene.time_of_day).join(' → ')}；光线与天气为拍摄方案，须按实拍记录核验。`
          : entry.culturalSignificance?.substring(0, 60) ?? `${entry.name}的古今变迁与时空叠加`),
      atmosphere: modelOutput?.atmosphere ?? (videoType === 'landscape_mood'
        ? (/张家界|武陵源/.test(entry.name)
          ? '山风、滴水、鸟鸣、脚步与留白组成由近到远的自然声景。'
          : entry.keywords.filter(keyword => (
              ['山', '水', '云', '雾', '日', '月', '风', '雨', '春', '夏', '秋', '冬']
                .some(word => keyword.includes(word))
            )).join('、') || `${entry.region}的自然意境`)
        : `${entry.region}的场景氛围`),
    };
  }

  if (videoType === 'ai_comic_drama') {
    return {
      dialogue: storyResult.scene_breakdown.map(scene => ({
        scene_id: scene.scene_id,
        lines: scene.characters.map(character => ({
          character,
          text: scene.dialogue_or_narration ?? scene.key_action,
          emotion: scene.dramatic_function === '高潮'
            ? '激烈'
            : scene.dramatic_function === '钩子开场' ? '紧张' : '克制',
        })),
      })),
    };
  }

  if (videoType === 'explainer_video' || videoType === 'lecture_video'
    || videoType === 'education_training') {
    return {
      argument_points: modelOutput?.argument_points
        ?? storyResult.scene_breakdown.slice(0, 4).map(scene => scene.key_action),
      knowledge_outline: modelOutput?.knowledge_outline
        ?? storyResult.scene_breakdown.map(
          scene => `${scene.scene_id}. ${scene.title}：${scene.plot.substring(0, 40)}`,
        ),
    };
  }

  if (videoType === 'documentary_short') {
    return {
      source_quotes: modelOutput?.source_quotes ?? extractQuotes(entry.story).slice(0, 3),
      field_notes: modelOutput?.field_notes ?? [
        ...relatedLocationNames(entry).map(name => `${name}待实地核验清单`).slice(0, 2),
        ...entry.unverifiedPoints
          .filter(point => point.includes('实地') || point.includes('考察') || point.includes('遗迹'))
          .slice(0, 1),
      ],
    };
  }

  return {};
}

export function applyChinaCultureStoryAssemblyToStoryData(input: {
  storyData: StoryGenerateResult;
  storyResult: StoryAssembly;
  modelOutput?: StoryGenerationModelOutput | null;
  entry: EntryDetail;
  videoType: VideoType;
  outputGearsSegments: boolean;
}): void {
  Object.assign(input.storyData, {
    title: input.storyResult.title,
    logline: input.storyResult.logline,
    theme: input.storyResult.theme,
    full_text: input.storyResult.full_text,
    scene_breakdown: input.storyResult.scene_breakdown,
    gears_segments: input.outputGearsSegments ? input.storyResult.gears_segments : [],
    cultural_constraints: input.storyResult.cultural_constraints,
    credibility_note: input.storyResult.credibility_note,
    characters: input.storyResult.characters,
    act_structure: input.storyResult.act_structure,
    protagonist_arc: input.storyResult.protagonist_arc,
    ...deriveChinaCultureTypeSpecificStoryFields({
      videoType: input.videoType,
      storyResult: input.storyResult,
      modelOutput: input.modelOutput,
      entry: input.entry,
    }),
  });
}
