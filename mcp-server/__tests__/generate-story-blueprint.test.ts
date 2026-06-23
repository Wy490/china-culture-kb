import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateStoryBlueprint } from '../src/tools/generate-story-blueprint.js';

const tmpDir = path.join(os.tmpdir(), 'kb-blueprint-test-' + Date.now());

beforeEach(() => {
  process.env.KB_ROOT = tmpDir;
  fs.mkdirSync(path.join(tmpDir, 'provinces'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'provinces', '湖南.md'), `# 湖南

## 待整理条目

## 已整理条目

---

## 周敦颐——理学开山鼻祖

- **省份**：湖南
- **地区**：永州→道县
- **类型**：历史人物

### 简介

周敦颐，字茂叔，号濂溪先生。

### 故事梗概

周敦颐在南安军任职时，面对冤案坚持不肯草率签署死刑文书。

### 文化意义

体现士人良知与理学精神。

### 相关地点

- 道县：出生地

### 关键词

周敦颐、濂溪、理学、拒签

### 来源

- 地方志资料（B级）

### 可信度与核实

基本可靠（地方志与研究资料互证）

### 待核实点

- 具体对白为后世转述`);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.KB_ROOT;
});

describe('kb_generate_story_blueprint', () => {
  it('builds a genre-aware blueprint from an entry', async () => {
    const result = await generateStoryBlueprint({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'historical_drama',
      central_event: '南安军拒签冤案',
      target_duration: '3分钟',
    });

    expect(result).not.toBeNull();
    expect(result!.blueprint.schema_version).toBe('story-blueprint/v1');
    expect(result!.blueprint.video_type).toBe('historical_drama');
    expect(result!.blueprint.presentation_style).toBe('cinematic');
    expect(result!.blueprint.story_structure).toBe('case_reconstruction');
    expect(result!.blueprint.central_question).toContain('南安军拒签冤案');
    expect(result!.blueprint.protagonist).toBe('周敦颐');
    expect(result!.blueprint.genre_beats.length).toBeGreaterThanOrEqual(5);
    expect(result!.blueprint.evidence_boundaries.some(boundary => boundary.boundary_id === 'unverified-points')).toBe(true);
    expect(result!.warnings.length).toBeGreaterThan(0);
  });

  it('infers video type from entry type when not provided', async () => {
    const result = await generateStoryBlueprint({
      entry_name: '周敦颐——理学开山鼻祖',
    });

    expect(result!.blueprint.video_type).toBe('character_story');
    expect(result!.profile_summary.must_include).toContain('主角目标');
  });

  it('returns null for missing entry', async () => {
    const result = await generateStoryBlueprint({ entry_name: '不存在的条目' });
    expect(result).toBeNull();
  });

  it('warns when region hint differs from entry region', async () => {
    const result = await generateStoryBlueprint({
      entry_name: '周敦颐——理学开山鼻祖',
      region_hint: '长沙',
      user_outline: '写成长沙地方化短片',
    });

    expect(result!.warnings.some(warning => warning.includes('长沙'))).toBe(true);
    expect(result!.blueprint.evidence_boundaries.some(boundary => boundary.boundary_id === 'user-outline')).toBe(true);
  });

  it('returns creation contract and material sufficiency for institutional blueprint requests', async () => {
    const result = await generateStoryBlueprint({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'culture_promo',
      presentation_style: 'voiceover_montage',
      story_structure: 'problem_solution_explainer',
      creation_use_case: 'institutional_promo',
      truth_mode: 'institutional_verified',
      client_type: '政府机构',
      target_audience: '青少年研学群体',
      communication_goal: '稳妥表达廉洁文化',
    });

    expect(result).not.toBeNull();
    expect(result!.blueprint.creation_contract.truth_mode).toBe('institutional_verified');
    expect(result!.blueprint.creation_contract.client_type).toBe('政府机构');
    expect(result!.blueprint.material_sufficiency.schema_version).toBe('material-sufficiency/v1');
    expect(result!.blueprint.material_sufficiency.stage).toBe('script_ready');
    expect(result!.blueprint.material_sufficiency.active_stage).toBe('minimum_viable_story');
    expect(result!.blueprint.material_sufficiency.generation_posture).toBe('blocked_until_input');
    expect(result!.blueprint.material_sufficiency.stage_reports?.map(report => report.stage)).toEqual([
      'minimum_viable_story',
      'script_ready',
      'production_ready',
    ]);
    expect(result!.blueprint.material_sufficiency.stage_reports?.find(report => report.stage === 'script_ready')?.status).toBe('blocked');
    expect(result!.blueprint.material_sufficiency.missing_items.map(item => item.item_id)).toContain('unverified_points');
    expect(result!.blueprint.material_sufficiency.next_stage).toBe('script_ready');
    expect(result!.blueprint.type_specific_requirements.join('\n')).toContain('真实度模式：institutional_verified');
    expect(result!.blueprint.type_specific_requirements.join('\n')).toContain('素材阶段 gate：script_ready=blocked');
    expect(result!.blueprint.type_specific_requirements.join('\n')).toContain('禁止表达：未核实数据');
  });

  it('keeps promo blueprints script-ready when production assets are pending', async () => {
    const result = await generateStoryBlueprint({
      entry_name: '周敦颐——理学开山鼻祖',
      video_type: 'culture_promo',
      creation_use_case: 'institutional_promo',
      truth_mode: 'inspired_by_material',
      client_type: '政府机构',
      user_outline: '只写周敦颐廉洁精神，具体对白都标成影视化处理，不把后世转述写成原话。',
    });

    expect(result).not.toBeNull();
    expect(result!.blueprint.material_sufficiency.stage).toBe('script_ready');
    expect(result!.blueprint.material_sufficiency.active_stage).toBe('script_ready');
    expect(result!.blueprint.material_sufficiency.can_generate).toBe(true);
    expect(result!.blueprint.material_sufficiency.generation_posture).toBe('script_ready_production_pending');
    expect(result!.blueprint.material_sufficiency.stage_reports?.find(report => report.stage === 'production_ready')?.status).toBe('needs_input');
    expect(result!.blueprint.material_sufficiency.recommended_next_questions.join('\n')).toContain('视觉规范');
  });
});
