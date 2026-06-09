// web/server/src/services/memory-mosaic-service.ts — Memory Mosaic Biography generator
// Implements "回忆拼图式人物故事" structure:
//   现实追寻者 → trigger_object → 多位见证人回忆 → 最终情感揭示
// NOT a biographical chronology — protagonist is seen through others' memories

import type {
  VideoType,
  PresentationStyle,
  SupportedDuration,
  PanelCount,
  EntryDetail,
  StoryScene,
  GearsSegment,
  StoryCharacter,
  ActBeat,
  ProtagonistArc,
  WitnessMemory,
  WitnessEmotionalBias,
  MemoryMosaicStorySeed,
  StoryQualityReport,
  KnowledgePack,
  ReferenceTrace,
} from '@shared/types.js';
import {
  VIDEO_TYPE_CONFIG,
  PRESENTATION_STYLE_CONFIG,
  STORY_STRUCTURE_CONFIG,
} from '@shared/types.js';

// ---------------------------------------------------------------------------
// Duration calculation helpers (same as dramatic-story.ts)
// ---------------------------------------------------------------------------

const DURATION_SEC_MAP: Record<string, number> = {
  '30秒': 30, '1分钟': 60, '3分钟': 180, '5分钟': 300,
  '8分钟': 480, '10分钟': 600, '15分钟': 900, '20分钟': 1200,
};

const PANEL_COUNT_BY_DURATION: Record<number, PanelCount> = {
  12: 6, 15: 6, 20: 6, 25: 8, 30: 9, 36: 10, 43: 10, 45: 10,
  50: 10, 60: 12, 67: 12, 69: 12, 75: 12, 80: 12, 86: 12, 90: 12,
  96: 12, 100: 12, 109: 12, 113: 12, 120: 12,
};

const CAMERA_BY_MOSAIC_FUNCTION: Record<string, string> = {
  '现实钩子': '实景空镜+旁白，制造追问感',
  '物件线索': '实物特写+缓推，物件诉说故事',
  '见证人回忆': '中景+见证人旁白，回忆画面叠加',
  '现实线反应': '追寻者近景特写，情绪变化',
  '最终揭示': '特写+缓推，情感聚焦',
  '结尾画面': '远景拉远+物件回响，留白收束',
};

// ---------------------------------------------------------------------------
// Memory mosaic scene templates (3min / 5min versions)
// ---------------------------------------------------------------------------

interface MosaicSceneTemplate {
  position: number;
  function_label: string;
  function_description: string;
  content_guide: string;
  is_reality_line: boolean; // true = present-day seeker line, false = witness memory
}

const MOSAIC_3MIN: MosaicSceneTemplate[] = [
  { position: 0, function_label: '现实钩子', function_description: '追寻者发现物件和疑问', content_guide: '现实中的追寻者发现一件旧物/残稿/遗迹，提出一个关于主角的核心疑问。不用介绍主角生平，直接制造悬念。物件要有画面感。', is_reality_line: true },
  { position: 1, function_label: '见证人回忆', function_description: '第一位见证人：主角早期选择', content_guide: '第一位见证人讲述主角年轻时做的一个关键选择。不按时间线——聚焦一个场景和一个选择。见证人带着自己的情绪：敬佩、遗憾、困惑。主角通过行动被看见，不自我介绍。', is_reality_line: false },
  { position: 2, function_label: '见证人回忆', function_description: '第二位见证人：主角面临误解/代价', content_guide: '一位对主角有误解或遗憾的见证人——他讲了主角的另一面，不是完美形象。主角付出的代价、承受的误解、留下的亏欠。这个见证人的情绪是复杂的。', is_reality_line: false },
  { position: 3, function_label: '见证人回忆', function_description: '第三位见证人：主角最关键行动', content_guide: '最核心的见证人——他讲了主角最关键的行动。这个行动揭示了主角真正的精神底色。见证人的讲述让追寻者开始理解主角。', is_reality_line: false },
  { position: 4, function_label: '最终揭示', function_description: '主角真正动机揭示', content_guide: '所有碎片拼合——主角做这些选择的真正原因。不是旁白总结，而是通过物件、见证人话语的呼应，让真相自己浮现。主角的精神底色在这里被看见。', is_reality_line: true },
  { position: 5, function_label: '结尾画面', function_description: '物件回响，追寻者完成理解', content_guide: '回到开头的物件——现在追寻者理解了它为什么在这里、它承载了什么。物件有了新的意义。追寻者发生了认知变化。远景+物件特写，留白收束。', is_reality_line: true },
];

const MOSAIC_5MIN: MosaicSceneTemplate[] = [
  { position: 0, function_label: '现实钩子', function_description: '追寻者发现物件', content_guide: '追寻者在现实中发现一件与主角有关的物件——残缺案牍、旧书信、遗留器物。物件制造悬念，引出核心疑问。', is_reality_line: true },
  { position: 1, function_label: '物件线索', function_description: '物件背后的故事开始', content_guide: '追问这件物件的来历——它从何而来、为什么残缺、为什么被留下。物件本身开始诉说故事。', is_reality_line: true },
  { position: 2, function_label: '见证人回忆', function_description: '见证人A：温柔侧面', content_guide: '最亲近的见证人——家人、挚友、同窗。他讲了主角温柔的一面、日常中的选择。但这个温柔的选择背后有什么代价？', is_reality_line: false },
  { position: 3, function_label: '见证人回忆', function_description: '见证人B：冲突侧面', content_guide: '一位与主角有冲突的人——他不完全理解主角的选择，觉得主角固执、不近人情、甚至得罪过他。这个视角让主角不是圣人。', is_reality_line: false },
  { position: 4, function_label: '见证人回忆', function_description: '见证人C：亏欠或误解', content_guide: '一位主角亏欠或误解的人——主角的选择伤害了他、辜负了他、或者他从未真正理解主角。这种情绪是故事中最真实的。', is_reality_line: false },
  { position: 5, function_label: '见证人回忆', function_description: '见证人D：关键选择', content_guide: '最核心的见证人——他目睹了主角最关键的选择，那个定义了主角一生的时刻。他的讲述让所有碎片开始拼合。', is_reality_line: false },
  { position: 6, function_label: '现实线反应', function_description: '追寻者的认知变化', content_guide: '追寻者在现实中停下来——他听到的所有碎片改变了他的理解。主角不是他最初想象的那个人。追问的意义也在变化。', is_reality_line: true },
  { position: 7, function_label: '最终揭示', function_description: '真相浮现', content_guide: '碎片拼合——主角真正的动机和精神底色。不是旁白总结，而是通过见证人话语的呼应自然浮现。', is_reality_line: true },
  { position: 8, function_label: '结尾画面', function_description: '物件回响+追寻者理解完成', content_guide: '回到开头的物件——它现在有了完全不同的意义。追寻者理解了主角。远景+物件特写，留白收束。', is_reality_line: true },
];

// ---------------------------------------------------------------------------
// Witness extraction from entry — identify people, relationships, events
// ---------------------------------------------------------------------------

interface ExtractedWitness {
  name: string;
  relationship_hint: string;
  event_hint: string;
  emotional_bias_hint: WitnessEmotionalBias;
}

function extractWitnessesFromEntry(entry: EntryDetail): ExtractedWitness[] {
  const protagonist = entry.name.split('——')[0].trim();
  const storyText = entry.story;
  const witnesses: ExtractedWitness[] = [];

  // Extract character names from story (same heuristic as dramatic-story)
  const namePattern = /[^\x00-\x7F]{2,4}(?:公|君|卿|帅|将|帝|王|侯|臣|官|郎|翁|生|师|僧|仙|道|妇|女|郎|军|守|尹|丞)/g;
  const counts = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = namePattern.exec(storyText)) !== null) {
    const name = m[0];
    if (name !== protagonist) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  // Also extract names that appear near relationship keywords
  const relationshipPatterns = [
    /同(.{0,4})([^\x00-\x7F]{2,4})/,  // 同窗、同年
    /([^\x00-\x7F]{2,4})之(.{0,4})/,  // XX之友、XX之师
    /([^\x00-\x7F]{2,4})(?:妻|子|女|父|母|兄|弟|师|徒|友|敌|对)/, // relationship suffix
    /(?:妻|子|女|父|母|兄|弟|师|徒|友|敌|对)([^\x00-\x7F]{2,4})/, // relationship prefix
  ];

  // Build witnesses from extracted characters
  const sortedChars = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const biasOptions: WitnessEmotionalBias[] = ['admiration', 'gratitude', 'regret', 'misunderstanding', 'conflict', 'nostalgia'];

  for (const [name, count] of sortedChars.slice(0, 6)) {
    // Determine relationship from story context
    const nameParagraphs = storyText.split(/\n\n+/).filter(p => p.includes(name));
    const context = nameParagraphs.length > 0 ? nameParagraphs[0] : '';

    let relationship = '相关人物';
    let emotionalBias: WitnessEmotionalBias = 'admiration';

    // Heuristic relationship detection
    if (context.includes('师') || context.includes('教') || context.includes('授')) {
      relationship = '师长';
    } else if (context.includes('友') || context.includes('同') || context.includes('伴')) {
      relationship = '同窗挚友';
    } else if (context.includes('妻') || context.includes('配') || context.includes('妇')) {
      relationship = '家人';
    } else if (context.includes('对') || context.includes('敌') || context.includes('反') || context.includes('争')) {
      relationship = '对立者';
      emotionalBias = 'conflict';
    } else if (context.includes('怨') || context.includes('恨') || context.includes('不解')) {
      relationship = '误解者';
      emotionalBias = 'misunderstanding';
    } else if (context.includes('谢') || context.includes('恩') || context.includes('救')) {
      relationship = '受恩者';
      emotionalBias = 'gratitude';
    } else if (context.includes('上官') || context.includes('知军') || context.includes('知府')) {
      relationship = '上级官员';
      emotionalBias = count >= 3 ? 'conflict' : 'admiration';
    } else if (count >= 4) {
      // High frequency → likely adversary or key figure
      relationship = '关键见证人';
      emotionalBias = 'regret';
    } else {
      relationship = '旁观见证人';
    }

    // Ensure at least one witness has complex emotion (not pure admiration)
    // For the first 3 witnesses, force diversity
    if (witnesses.length === 0) emotionalBias = 'admiration';
    if (witnesses.length === 1) emotionalBias = witnesses[1]?.emotional_bias_hint === 'admiration' ? 'gratitude' : emotionalBias;
    if (witnesses.length === 2) {
      // Force at least one negative/complex emotion
      const hasNegative = witnesses.some(w =>
        w.emotional_bias_hint === 'conflict' || w.emotional_bias_hint === 'misunderstanding' || w.emotional_bias_hint === 'regret'
      );
      if (!hasNegative) emotionalBias = 'misunderstanding';
    }

    // Extract the event this witness would remember
    const eventHint = nameParagraphs.length > 0
      ? nameParagraphs[0].replace(/\*\*/g, '').substring(0, 60).trim()
      : `与${protagonist}的交集事件`;

    witnesses.push({
      name,
      relationship_hint: relationship,
      event_hint: eventHint,
      emotional_bias_hint: emotionalBias,
    });
  }

  // If fewer than 3 witnesses extracted, add synthetic witnesses from story events
  if (witnesses.length < 3) {
    const boldEvents = extractBoldEventsFromStory(storyText);
    const biasCycle: WitnessEmotionalBias[] = ['admiration', 'nostalgia', 'regret', 'misunderstanding', 'gratitude', 'conflict'];

    for (let i = witnesses.length; i < Math.min(4, boldEvents.length + witnesses.length); i++) {
      const event = boldEvents[i - witnesses.length] || `${protagonist}的关键事件`;
      witnesses.push({
        name: `见证人${i + 1}`,
        relationship_hint: i === witnesses.length ? '后人/研究者' : '历史见证人',
        event_hint: event,
        emotional_bias_hint: biasCycle[i % biasCycle.length],
      });
    }
  }

  return witnesses;
}

// ---------------------------------------------------------------------------
// Extract bold events from story text
// ---------------------------------------------------------------------------

function extractBoldEventsFromStory(storyText: string): string[] {
  const events: string[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  const skipFields = ['省份', '地区', '类型', '简介', '故事梗概', '文化意义', '相关地点', '关键词', '来源', '可信度', '核实方法', '待核实点'];
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(storyText)) !== null) {
    const name = match[1].trim();
    if (!skipFields.includes(name)) events.push(name);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Determine trigger object from entry
// ---------------------------------------------------------------------------

function determineTriggerObject(entry: EntryDetail): string {
  const protagonist = entry.name.split('——')[0].trim();
  const storyText = entry.story;

  // Look for physical objects mentioned in the story
  const objectPatterns = [
    /([^\x00-\x7F]{2,6}(?:书|稿|牍|卷|册|碑|铭|印|剑|琴|棋|画|砚|笔|墨|纸|帛|瓷|器|盏|壶|炉|案|案牍|牍文|札|简|信|尺素))/g,
    /(?:一(?:份|卷|本|封|块|件|柄|座|方|面))(?:旧|残|破|遗|古|老)([^\x00-\x7F]{2,8})/g,
  ];

  const objects: string[] = [];
  for (const pattern of objectPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(storyText)) !== null) {
      objects.push(m[0]);
    }
  }

  if (objects.length > 0) {
    return objects[0];
  }

  // Fallback: create a generic trigger object based on entry type
  const typeFallbacks: Record<string, string> = {
    '历史人物': `一卷残缺的${protagonist}相关案牍`,
    '名胜古迹': `一块残碑上的模糊字迹`,
    '非遗': `一件传承人留下的旧工具`,
    '地方掌故': `一条被遗忘的旧巷传说`,
    '传统工艺': `一件半成品的老器物`,
  };

  return typeFallbacks[entry.type] || `一件与${protagonist}有关的旧物`;
}

// ---------------------------------------------------------------------------
// Determine present-day seeker from entry
// ---------------------------------------------------------------------------

function determinePresentDaySeeker(entry: EntryDetail): string {
  const typeSeekers: Record<string, string> = {
    '历史人物': '年轻策展人/研究者',
    '名胜古迹': '回乡寻根的旅行者',
    '非遗': '想了解手艺来源的学徒',
    '地方掌故': '对家乡往事好奇的年轻人',
    '传统工艺': '寻找匠人精神的新手艺人',
  };

  return typeSeekers[entry.type] || '追寻真相的探访者';
}

// ---------------------------------------------------------------------------
// Determine central question from entry
// ---------------------------------------------------------------------------

function determineCentralQuestion(entry: EntryDetail, centralEvent: string): string {
  const protagonist = entry.name.split('——')[0].trim();

  // If we have a specific central event, build question from it
  if (centralEvent && centralEvent !== protagonist && centralEvent !== '整体故事') {
    const questionPatterns: Record<string, string> = {
      '拒': `为什么${protagonist}敢拒绝？他到底在守护什么？`,
      '冤': `这桩冤案背后，${protagonist}看到了什么别人看不见的？`,
      '辞': `${protagonist}为什么宁愿辞去也不妥协？`,
      '抗': `${protagonist}到底在反抗什么？代价是什么？`,
      '悟': `${protagonist}悟到了什么？为什么那一刻改变了他？`,
    };

    for (const [keyword, pattern] of Object.entries(questionPatterns)) {
      if (centralEvent.includes(keyword)) return pattern;
    }

    return `${protagonist}为什么做出这个选择？他的真正动机是什么？`;
  }

  // Fallback: generic central question
  return `${protagonist}到底是一个怎样的人？为什么他做了那些选择？`;
}

// ---------------------------------------------------------------------------
// Determine final reveal from entry
// ---------------------------------------------------------------------------

function determineFinalReveal(entry: EntryDetail): string {
  const protagonist = entry.name.split('——')[0].trim();
  const sig = entry.culturalSignificance || '';

  // Extract key phrases from cultural significance that reveal the "true self"
  if (sig.length > 20) {
    // Look for revealing phrases
    const revealPatterns = [
      new RegExp(`${protagonist}的(?:精神|品格|底色|信念|坚持|担当|追求)是[^，。]{4,20}`, 'g'),
      /他(?:真正|最|始终)(?:坚守|追求|在乎|信|守)的是[^，。]{4,20}/g,
      /不是[^，。]{4,15}而是[^，。]{4,20}/g,
    ];

    for (const pattern of revealPatterns) {
      const match = pattern.exec(sig);
      if (match) return match[0];
    }
  }

  // Fallback based on entry type
  const typeReveals: Record<string, string> = {
    '历史人物': `${protagonist}真正守护的不是官位和名望，而是良知和公正——这才是他所有选择的底色`,
    '名胜古迹': `这座古迹承载的不是砖石，而是无数人选择坚守的精神`,
    '非遗': `这门技艺背后不是技巧，而是对完美的执着和对传承的承诺`,
    '地方掌故': `这段掌故照见的不只是往事，而是这个地方的人一直以来的选择`,
  };

  return typeReveals[entry.type] || `${protagonist}真正的精神底色，比他的事迹更值得被记住`;
}

// ---------------------------------------------------------------------------
// Build MemoryMosaicStorySeed from entry
// ---------------------------------------------------------------------------

export function buildMemoryMosaicSeed(
  entry: EntryDetail,
  centralEvent: string,
  knowledgePack?: KnowledgePack,
): MemoryMosaicStorySeed {
  const protagonist = entry.name.split('——')[0].trim();
  const extractedWitnesses = extractWitnessesFromEntry(entry);

  // Build WitnessMemory array from extracted witnesses
  const witnesses: WitnessMemory[] = extractedWitnesses.map((w, idx) => {
    const subjectChoices = [
      `${protagonist}选择了坚守原则而非妥协`,
      `${protagonist}宁可承受代价也要做对的事`,
      `${protagonist}在那个时刻做出了别人不敢做的决定`,
      `${protagonist}放弃了安逸选择了担当`,
      `${protagonist}做出了看似吃亏但内心笃定的选择`,
    ];

    return {
      witness_name: w.name,
      relationship_to_subject: w.relationship_hint,
      remembered_event: w.event_hint,
      subject_choice: subjectChoices[idx % subjectChoices.length],
      emotional_bias: w.emotional_bias_hint,
      object_or_phrase: idx === 0 ? `${w.name}记得的那句话` : `一件与${w.name}有关的旧物`,
      scene_location: entry.region,
      scene_time: ['数十年前', '当年', '那个冬天', '某日黄昏', '雨夜'][idx % 5],
      present_day_effect: `追寻者从${w.name}的讲述中开始理解${protagonist}的另一面`,
      factual_basis: entry.story.substring(0, 40).replace(/\*\*/g, ''),
      fictionalized_elements: [`对${w.name}情绪的想象性补充`, `场景细节的虚构化处理`],
    };
  });

  // Ensure at least one witness has negative/complex emotion
  const hasComplex = witnesses.some(w =>
    w.emotional_bias === 'conflict' || w.emotional_bias === 'misunderstanding' || w.emotional_bias === 'regret'
  );
  if (!hasComplex && witnesses.length >= 2) {
    witnesses[1].emotional_bias = 'misunderstanding';
    witnesses[1].relationship_to_subject = '曾经误解主角的人';
  }

  const triggerObject = determineTriggerObject(entry);
  const presentDaySeeker = determinePresentDaySeeker(entry);
  const centralQuestion = determineCentralQuestion(entry, centralEvent);
  const finalReveal = determineFinalReveal(entry);

  // Ending image: the trigger object echoing back
  const endingImage = `${triggerObject}回到当下——追寻者理解了它承载的意义。远景收束，${entry.region}的光影留白。`;

  return {
    subject: protagonist,
    present_day_seeker: presentDaySeeker,
    seeker_goal: centralQuestion,
    trigger_object: triggerObject,
    central_question: centralQuestion,
    witnesses,
    final_reveal: finalReveal,
    ending_image: endingImage,
  };
}

// ---------------------------------------------------------------------------
// Generate memory mosaic content (full_text, scene_breakdown, gears_segments)
// ---------------------------------------------------------------------------

export function generateMemoryMosaicContent(input: {
  entry: EntryDetail;
  centralEvent: string;
  videoType: VideoType;
  presentationStyle: PresentationStyle;
  targetDuration: SupportedDuration;
  tone: string;
  memorySeed: MemoryMosaicStorySeed;
  knowledgePack?: KnowledgePack;
  originalUserQuery?: string;
}): {
  title: string;
  logline: string;
  theme: string;
  full_text: string;
  scene_breakdown: StoryScene[];
  gears_segments: GearsSegment[];
  cultural_constraints: string[];
  credibility_note: string;
  characters: StoryCharacter[];
  act_structure: ActBeat[];
  protagonist_arc: ProtagonistArc[];
} {
  const { entry, centralEvent, videoType, presentationStyle, targetDuration, tone, memorySeed, knowledgePack } = input;
  const protagonist = entry.name.split('——')[0].trim();

  const totalSeconds = DURATION_SEC_MAP[targetDuration] ?? 180;

  // Select scene template set based on duration
  const templates = totalSeconds <= 180 ? MOSAIC_3MIN : MOSAIC_5MIN;
  const sceneCount = templates.length;

  const perSceneDuration = Math.round(totalSeconds / sceneCount);

  // ---- Build scene_breakdown ----
  const scenes: StoryScene[] = templates.map((tmpl, idx) => {
    // Determine witness for memory scenes
    let witness: WitnessMemory | undefined;
    if (!tmpl.is_reality_line) {
      // Assign witnesses to memory scenes (round-robin if more scenes than witnesses)
      const memorySceneIndices = templates.filter(t => !t.is_reality_line).map(t => t.position);
      const witnessIndex = memorySceneIndices.indexOf(tmpl.position);
      witness = memorySeed.witnesses[witnessIndex % memorySeed.witnesses.length];
    }

    const location = witness?.scene_location ?? entry.region;
    const timeOfDay = witness?.scene_time ?? ['清晨', '白天', '黄昏', '夜晚'][idx % 4];

    // Build plot text
    let plot: string;
    if (tmpl.is_reality_line) {
      if (tmpl.function_label === '现实钩子') {
        plot = `现实中，${memorySeed.present_day_seeker}发现${memorySeed.trigger_object}，追问：${memorySeed.central_question}`;
      } else if (tmpl.function_label === '物件线索') {
        plot = `这件${memorySeed.trigger_object}从何而来？它背后的故事开始浮现。`;
      } else if (tmpl.function_label === '现实线反应') {
        plot = `追寻者停下脚步——他听到的一切改变了他对${protagonist}的理解。追问的意义也在变化。`;
      } else if (tmpl.function_label === '最终揭示') {
        plot = `碎片拼合——${memorySeed.final_reveal}`;
      } else if (tmpl.function_label === '结尾画面') {
        plot = `${memorySeed.trigger_object}回到当下，追寻者理解了它承载的意义。${memorySeed.ending_image}`;
      } else {
        plot = `现实线推进——追寻者继续追寻${protagonist}的真相。`;
      }
    } else {
      // Witness memory scene
      const w = witness!;
      const biasLabels: Record<WitnessEmotionalBias, string> = {
        admiration: '敬佩',
        regret: '遗憾',
        misunderstanding: '误解',
        gratitude: '感恩',
        conflict: '冲突',
        nostalgia: '怀念',
      };
      plot = `${w.witness_name}（${w.relationship_to_subject}，${biasLabels[w.emotional_bias]}）回忆：${w.remembered_event}——${w.subject_choice}`;
    }

    // Build visual prompt
    const keyVisuals = tmpl.is_reality_line
      ? `${memorySeed.trigger_object}、${entry.region}`
      : `${witness!.scene_location}、${protagonist}、${witness!.witness_name}`;

    const visualPrompt = tmpl.is_reality_line
      ? `${entry.region}，${tmpl.function_label}。${keyVisuals}构成核心画面`
      : `${witness!.scene_location}，回忆画面。${keyVisuals}构成核心画面`;

    // Build key action
    const keyAction = tmpl.is_reality_line
      ? (tmpl.function_label === '现实钩子' ? '发现物件，制造追问' : tmpl.function_label === '结尾画面' ? '物件回响，理解完成' : '现实线推进追问')
      : `${witness!.witness_name}讲述${protagonist}的一个关键选择`;

    // Characters
    const characters = tmpl.is_reality_line
      ? [memorySeed.present_day_seeker]
      : [protagonist, witness!.witness_name];

    // Camera suggestion
    const cameraSuggestion = CAMERA_BY_MOSAIC_FUNCTION[tmpl.function_label] ?? '中景固定镜头';

    // Cultural note
    const culturalNote = tmpl.is_reality_line
      ? '现实线基于知识库条目背景虚构'
      : `基于${entry.name}中${witness!.witness_name}的交集，部分细节经虚构化处理`;

    // Dialogue or narration
    const dialogueOrNarration = tmpl.is_reality_line
      ? (tmpl.function_label === '现实钩子'
        ? `${memorySeed.present_day_seeker}（旁白）：${memorySeed.trigger_object}……这是谁的？他为什么留下这个？`
        : tmpl.function_label === '结尾画面'
          ? `${memorySeed.present_day_seeker}（旁白）：现在我明白了。${memorySeed.trigger_object}不是遗物——它是答案。`
          : `追寻者旁白推进`)
      : `${witness!.witness_name}（回忆）：${witness!.object_or_phrase}……我记得那一天。`;

    // Conflict
    const conflict = tmpl.is_reality_line
      ? undefined
      : witness!.emotional_bias === 'conflict' || witness!.emotional_bias === 'misunderstanding'
        ? `${witness!.witness_name}与${protagonist}之间的${witness!.emotional_bias === 'conflict' ? '冲突' : '误解'}`
        : undefined;

    return {
      scene_id: idx + 1,
      title: tmpl.function_label,
      duration_sec: perSceneDuration,
      location,
      time_of_day: timeOfDay,
      dramatic_function: tmpl.function_label,
      plot,
      key_action: keyAction,
      characters,
      visual_prompt: visualPrompt,
      camera_suggestion: cameraSuggestion,
      cultural_note: culturalNote,
      conflict,
      dialogue_or_narration: dialogueOrNarration,
      factual_basis: tmpl.is_reality_line ? undefined : witness?.factual_basis,
      fictionalized_elements: tmpl.is_reality_line ? undefined : witness?.fictionalized_elements,
      source_entries: tmpl.is_reality_line ? undefined : [entry.name],
    };
  });

  // ---- Build gears_segments ----
  const gearsSegments: GearsSegment[] = scenes.map((scene) => {
    const panelCount = PANEL_COUNT_BY_DURATION[scene.duration_sec] ?? 6;
    const vtMeta = VIDEO_TYPE_CONFIG[videoType];
    const psMeta = PRESENTATION_STYLE_CONFIG[presentationStyle];
    const ssMeta = STORY_STRUCTURE_CONFIG.memory_mosaic_biography;

    // Determine line type for segment_prompt_hint
    const tmpl = templates[scene.scene_id - 1];
    const lineType = tmpl.is_reality_line ? '现实线' : '回忆线';
    const focusTarget = tmpl.is_reality_line
      ? (tmpl.function_label === '现实钩子' || tmpl.function_label === '结尾画面' ? memorySeed.trigger_object : memorySeed.present_day_seeker)
      : scene.characters[1] || protagonist;

    const segmentPromptHint = `${vtMeta.label}/${psMeta.label}/${ssMeta.label}: ${lineType}段落，聚焦${focusTarget}。${psMeta.description}`;

    const scriptText = `【${scene.dramatic_function}·${lineType}】${scene.location}，${scene.time_of_day}。${scene.visual_prompt}。${scene.key_action}——${scene.plot.substring(0, 60)}。${scene.camera_suggestion}。`;

    const visualFocus = [
      scene.location,
      ...scene.visual_prompt.split(/[，、。]/).filter(s => s.length > 1 && s.length < 8).slice(0, 2),
    ];

    return {
      segment_id: scene.scene_id,
      source_scene_id: scene.scene_id,
      duration_sec: scene.duration_sec,
      panel_count: panelCount,
      script_text: scriptText,
      purpose: `${scene.dramatic_function}（${lineType}）`,
      visual_focus: visualFocus.slice(0, 3),
      cultural_constraints: scene.cultural_note ? [scene.cultural_note] : [],
      video_type: videoType,
      presentation_style: presentationStyle,
      segment_prompt_hint: segmentPromptHint,
      source_entries: scene.source_entries,
    };
  });

  // ---- Build full_text ----
  const fullTextParagraphs: string[] = [];

  for (const scene of scenes) {
    const tmpl = templates[scene.scene_id - 1];
    if (tmpl.is_reality_line) {
      if (tmpl.function_label === '现实钩子') {
        fullTextParagraphs.push(
          `【现实】${memorySeed.present_day_seeker}在${entry.region}发现${memorySeed.trigger_object}。`,
          `这件物件看起来不起眼——残缺、陈旧、被遗忘。但${memorySeed.present_day_seeker}翻过它，手指停在一个模糊的字迹上。`,
          `一个问题浮上来：${memorySeed.central_question}`,
        );
      } else if (tmpl.function_label === '物件线索') {
        fullTextParagraphs.push(
          `这件${memorySeed.trigger_object}，不是随便留下的。它背后有一个故事——${protagonist}的故事。`,
          `但它为什么不完整？为什么只有碎片？好像有人故意留下了线索，又好像时间本身在筛选——只留下最重要的，抹去其余。`,
        );
      } else if (tmpl.function_label === '现实线反应') {
        fullTextParagraphs.push(
          `${memorySeed.present_day_seeker}停下脚步。他听到的这些碎片，拼出了一个他没想到的${protagonist}。`,
          `不是那个教科书上的${protagonist}，不是那个年表里的${protagonist}。而是一个被误解过、亏欠过、但始终选择了某条路的人。`,
        );
      } else if (tmpl.function_label === '最终揭示') {
        fullTextParagraphs.push(
          `所有碎片终于拼合。`,
          `${memorySeed.final_reveal}`,
          `这个真相不是旁白告诉你的——而是从每一个见证人的讲述中，自然浮现的。`,
        );
      } else if (tmpl.function_label === '结尾画面') {
        fullTextParagraphs.push(
          `回到那件${memorySeed.trigger_object}。`,
          `现在它不再只是残缺的旧物——它承载了${protagonist}的选择、代价和精神底色。`,
          `${memorySeed.present_day_seeker}把它放回原处。但他自己已经不一样了。`,
          `远景拉远。${entry.region}的光影留白。`,
        );
      }
    } else {
      // Witness memory
      const w = memorySeed.witnesses[(templates.filter(t => !t.is_reality_line).indexOf(tmpl)) % memorySeed.witnesses.length];
      const biasNarration: Record<WitnessEmotionalBias, string> = {
        admiration: `${w.witness_name}至今记得那个场面。他说：`,
        gratitude: `${w.witness_name}的语气里有深深的感恩：`,
        regret: `${w.witness_name}叹了口气。他说：`,
        misunderstanding: `${w.witness_name}皱眉。他至今不完全理解：`,
        conflict: `${w.witness_name}直言不讳：`,
        nostalgia: `${w.witness_name}眼里有了光：`,
      };

      fullTextParagraphs.push(
        `【${w.witness_name}的回忆·${biasNarration[w.emotional_bias]}】`,
        `${w.remembered_event}。`,
        `${w.subject_choice}。`,
        `${w.witness_name}说：${w.object_or_phrase}……我记得那一天。`,
      );
    }
  }

  const full_text = fullTextParagraphs.join('\n\n');

  // ---- Build title ----
  const title = `${protagonist}——被回忆拼出的人`;

  // ---- Build logline ----
  const logline = `通过${memorySeed.present_day_seeker}的追问和多位见证人的回忆，拼出${protagonist}真正的精神底色——${memorySeed.central_question}`;

  // ---- Build theme ----
  const theme = `人物精神底色、选择代价、他人记忆中的真实`;

  // ---- Build characters ----
  const characters: StoryCharacter[] = [
    { name: protagonist, role: 'subject', description: `被追寻的主角，通过他人记忆被看见`, arc: `从被误解到被真正理解` },
    { name: memorySeed.present_day_seeker, role: 'seeker', description: `现实线追寻者，因回忆发生认知变化` },
    ...memorySeed.witnesses.slice(0, 4).map(w => ({
      name: w.witness_name,
      role: 'witness' as const,
      description: `${w.relationship_to_subject}，${w.emotional_bias}视角`,
    })),
  ];

  // ---- Build act_structure ----
  const actStructure: ActBeat[] = [
    { act: 1, beat: '现实钩子+物件线索', scene_ids: templates.filter(t => t.is_reality_line && t.position <= 1).map(t => t.position + 1), purpose: '建立追问和物件' },
    { act: 2, beat: '见证人回忆', scene_ids: templates.filter(t => !t.is_reality_line).map(t => t.position + 1), purpose: '通过他人记忆拼出主角' },
    { act: 3, beat: '现实线揭示+结尾', scene_ids: templates.filter(t => t.is_reality_line && t.position > 1).map(t => t.position + 1), purpose: '真相浮现+物件回响' },
  ];

  // ---- Build protagonist_arc ----
  const protagonistArc: ProtagonistArc[] = [
    {
      starting_state: `被年表和教科书定义的${protagonist}`,
      turning_point: `见证人回忆揭示了不同的${protagonist}`,
      resolution: `${memorySeed.final_reveal}`,
    },
  ];

  // ---- Cultural constraints & credibility ----
  const culturalConstraints = [
    ...entry.unverifiedPoints.slice(0, 3).map(p => `待核实：${p}`),
    '回忆拼图式叙事中见证人情绪和场景细节经虚构化处理',
    '主角选择的核心事实基于知识库条目，但呈现方式为创作性叙事',
  ];

  const credibilityNote = entry.credibility === '可靠'
    ? `核心事实有交叉佐证（${entry.credibility}），见证人视角和情绪为创作性虚构`
    : entry.credibility === '基本可靠'
      ? `核心事实基本可靠，部分细节待核实，见证人视角为创作性虚构`
      : `条目可信度${entry.credibility}，回忆拼图叙事将核心事实创作化呈现，需核实关键细节`;

  return {
    title,
    logline,
    theme,
    full_text,
    scene_breakdown: scenes,
    gears_segments: gearsSegments,
    cultural_constraints: culturalConstraints,
    credibility_note: credibilityNote,
    characters,
    act_structure: actStructure,
    protagonist_arc: protagonistArc,
  };
}

// ---------------------------------------------------------------------------
// Validate memory mosaic story quality
// ---------------------------------------------------------------------------

export function validateMemoryMosaicStory(result: {
  full_text: string;
  scene_breakdown: StoryScene[];
  memory_seed?: MemoryMosaicStorySeed;
}): StoryQualityReport {
  const issues: string[] = [];
  const seed = result.memory_seed;

  // ---- Must-have checks ----

  // 1. Has present-day seeker
  if (!seed?.present_day_seeker) {
    issues.push('缺少现实追寻者——回忆拼图必须有现实线人物');
  }

  // 2. Has trigger object
  if (!seed?.trigger_object) {
    issues.push('缺少触发物件——回忆拼图必须由物件或线索开场');
  }

  // 3. At least 3 witnesses
  if (!seed || seed.witnesses.length < 3) {
    issues.push(`见证人不足3位（当前${seed?.witnesses.length ?? 0}位）——回忆拼图需要至少3位见证人`);
  }

  // 4. At least 3 memory scenes
  const memoryScenes = result.scene_breakdown.filter(s =>
    s.dramatic_function === '见证人回忆' || s.characters.some(c => c !== seed?.present_day_seeker && c !== seed?.subject)
  );
  if (memoryScenes.length < 3) {
    issues.push(`回忆场景不足3个（当前${memoryScenes.length}个）——需要更多见证人回忆片段`);
  }

  // 5. At least 1 complex emotion witness
  if (seed && !seed.witnesses.some(w =>
    w.emotional_bias === 'conflict' || w.emotional_bias === 'misunderstanding' || w.emotional_bias === 'regret'
  )) {
    issues.push('所有见证人情绪都是正面——回忆拼图必须至少有一位误解、遗憾或冲突视角的见证人');
  }

  // 6. Ending echoes the opening object
  const lastScene = result.scene_breakdown[result.scene_breakdown.length - 1];
  if (seed && lastScene && !lastScene.plot.includes(seed.trigger_object.substring(0, 4))) {
    issues.push('结尾未呼应开头的触发物件——回忆拼图结尾必须回到开场物件');
  }

  // ---- Forbidden pattern checks ----

  // 7. No biography-style year listing
  const yearPattern = /\d{3,4}年[，。]/g;
  const yearMatches = result.full_text.match(yearPattern);
  if (yearMatches && yearMatches.length >= 3) {
    issues.push('full_text中出现3个以上年份开头段落——这是年表式传记，不是回忆拼图');
  }

  // 8. No "他的一生" / "生平事迹" / 年谱式 expressions
  const biographyPhrases = ['他的一生', '生平事迹', '年谱式', '生平简介', '一生充满传奇', '波澜壮阔的一生', '传奇人生'];
  for (const phrase of biographyPhrases) {
    if (result.full_text.includes(phrase)) {
      issues.push(`出现传记腔表达"${phrase}"——回忆拼图不允许空泛传记式语言`);
    }
  }

  // 9. Each memory scene must have subject_choice
  if (seed) {
    for (const w of seed.witnesses) {
      if (!w.subject_choice || w.subject_choice.length < 5) {
        issues.push(`见证人"${w.witness_name}"缺少subject_choice——每个回忆场景必须聚焦主角的一个选择`);
      }
    }
  }

  // 10. gears_segments script_text shouldn't be just knowledge explanation
  // (This is a content quality check, not strictly enforceable without AI review)

  // ---- Compute pass/fail ----
  const hasSeeker = !!seed?.present_day_seeker;
  const hasObject = !!seed?.trigger_object;
  const hasWitnesses = !!seed && seed.witnesses.length >= 3;
  const hasComplexEmotion = !!seed && seed.witnesses.some(w =>
    w.emotional_bias === 'conflict' || w.emotional_bias === 'misunderstanding' || w.emotional_bias === 'regret'
  );
  const hasObjectEcho = !!seed && !!lastScene && lastScene.plot.includes(seed.trigger_object.substring(0, 4));
  const isNotBiographySummary = !biographyPhrases.some(p => result.full_text.includes(p)) && (!yearMatches || yearMatches.length < 3);
  const hasCentralEvent = !!seed?.central_question;
  const hasSceneAction = result.scene_breakdown.some(s => s.key_action.length > 5);
  const hasClimax = result.scene_breakdown.some(s => s.dramatic_function === '最终揭示');
  const hasEndingTheme = !!seed?.final_reveal;

  const passed = hasSeeker && hasObject && hasWitnesses && hasComplexEmotion
    && hasObjectEcho && isNotBiographySummary && hasCentralEvent;

  return {
    hasCentralEvent,
    hasConflict: hasComplexEmotion,
    hasProtagonistChoice: hasWitnesses,
    hasSceneAction,
    hasClimax,
    hasEndingTheme,
    isNotBiographySummary,
    passed,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Recommend story structures for an entry type + video type
// ---------------------------------------------------------------------------

export function recommendStoryStructures(
  entryType: string,
  videoType: VideoType,
): { story_structure: string; reason: string; priority: number }[] {
  // Routing table: which story structures suit which entry type
  const routing: Record<string, string[]> = {
    '历史人物': ['single_event_drama', 'memory_mosaic_biography', 'witness_testimony', 'three_act_drama'],
    '神话传说': ['single_event_drama', 'object_clue_journey', 'three_act_drama'],
    '民间故事': ['single_event_drama', 'three_act_drama'],
    '非遗': ['object_clue_journey', 'memory_mosaic_biography', 'before_after_transformation'],
    '地方戏曲': ['single_event_drama', 'three_act_drama'],
    '节庆习俗': ['single_event_drama', 'object_clue_journey'],
    '饮食文化': ['object_clue_journey', 'single_event_drama'],
    '传统工艺': ['object_clue_journey', 'before_after_transformation'],
    '名胜古迹': ['object_clue_journey', 'witness_testimony', 'single_event_drama'],
    '地方掌故': ['case_reconstruction', 'witness_testimony', 'single_event_drama'],
    '宗教信仰': ['object_clue_journey', 'single_event_drama'],
    '民俗活动': ['single_event_drama', 'before_after_transformation'],
  };

  const candidates = routing[entryType] || ['single_event_drama'];

  // Filter by video_type compatibility
  const compatible = candidates.filter(ss => {
    const meta = STORY_STRUCTURE_CONFIG[ss as keyof typeof STORY_STRUCTURE_CONFIG];
    return meta && meta.compatible_video_types.includes(videoType);
  });

  // If nothing compatible, fall back to single_event_drama
  if (compatible.length === 0) return [{ story_structure: 'single_event_drama', reason: '默认叙事结构', priority: 1 }];

  return compatible.map((ss, idx) => {
    const meta = STORY_STRUCTURE_CONFIG[ss as keyof typeof STORY_STRUCTURE_CONFIG];
    return {
      story_structure: ss,
      reason: `"${entryType}"条目适合${meta?.label ?? ss}——${meta?.description ?? ''}`,
      priority: idx + 1,
    };
  });
}