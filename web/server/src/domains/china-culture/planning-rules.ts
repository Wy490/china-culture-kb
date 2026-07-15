import type { EntryDetail, KnowledgePackMissing } from '@shared/types.js';

export function computeChinaCulturePlanningRisks(entry: EntryDetail): string[] {
  const risks: string[] = [];
  if (entry.credibility === '存疑') risks.push('条目整体可信度存疑，需大量核实方可用于创作');
  if (entry.credibility === '待核实') risks.push('条目可信度待核实，核心情节可能缺乏佐证');
  for (const point of entry.unverifiedPoints) risks.push(`待核实：${point}`);
  return risks;
}

export function buildChinaCulturePlanSupplementNeeds(entry: EntryDetail): KnowledgePackMissing[] {
  const needs: KnowledgePackMissing[] = [];
  if (entry.credibility === '存疑' || entry.credibility === '待核实') {
    needs.push({
      need_id: 'credibility_review',
      label: '可信度复核',
      message: `条目可信度为“${entry.credibility}”，生成前建议补充来源说明或核验结论。`,
    });
  }
  if (!entry.verificationMethod?.trim()) {
    needs.push({
      need_id: 'verification_method',
      label: '核验方式',
      message: '条目缺少核验方式说明，建议补充资料来源、地方志、馆藏说明或实地记录。',
    });
  }
  for (const point of entry.unverifiedPoints.slice(0, 5)) {
    needs.push({
      need_id: `unverified_${needs.length + 1}`,
      label: '待核实内容',
      message: point,
    });
  }
  if (entry.story.trim().length < 120) {
    needs.push({
      need_id: 'story_detail',
      label: '故事细节',
      message: '词条故事材料较短，建议补充关键事件过程、人物选择、场景地点或可视化细节。',
    });
  }
  return needs;
}
