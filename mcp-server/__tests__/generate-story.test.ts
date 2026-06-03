import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateStory } from '../src/tools/generate-story.js';

const tmpDir = path.join(os.tmpdir(), 'kb-story-test-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(path.join(tmpDir, 'provinces'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'provinces', '湖南.md'), '# 湖南\n\n## 待整理条目\n\n## 已整理条目\n');
  fs.mkdirSync(path.join(tmpDir, '..', 'scripts', '短剧'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kb_generate_story', () => {
  it('should generate story file with natural language text', async () => {
    process.env.KB_ROOT = tmpDir;
    const storyText = `## 故事核心
屈原投江殉国，从个人悲剧衍生出全民端午习俗。

## 主角
屈原——楚国诗人和政治家，忠于理想而不妥协。

## 冲突
理想与现实——屈原坚守"举世皆浊我独清"，但国破家亡的现实令其绝望。

## 转折
屈原在汨罗江畔遇渔父问答，最终选择以身殉国而非随波逐流。

## 结尾
百姓争相划船寻找遗体，龙舟竞渡从此诞生——悲壮化为全民纪念。

## 文化元素
汨罗江、龙舟、粽子、五彩丝线、楚国

## 不可误写
屈原投江年份（公元前278年）、秦国将领白起攻郢都——这些有正史佐证

## 可信度边界
- 史实：屈原投江殉国（A级《史记》交叉佐证）
- 传说：屈原托梦告知缠五彩线（仅D级口述来源，可虚构）
- 可虚构：屈原与渔父对话的具体内容（多个版本有差异，可改编）

## 来源条目
- 屈原投江汨罗——端午节起源：湖南→汨罗→神话传说`;

    const result = await generateStory({
      title: '屈原投江——悲壮化为纪念',
      story_text: storyText,
      entry_names: '屈原投江汨罗——端午节起源',
      script_type: '短剧',
    });

    expect(result.filePath).toContain('scripts');
    expect(result.title).toBe('屈原投江——悲壮化为纪念');
    expect(result.scriptType).toBe('短剧');
    expect(result.entryNames).toContain('屈原投江汨罗——端午节起源');
    expect(result.storyText).toContain('## 故事核心');
    expect(result.storyText).toContain('## 可信度边界');
    expect(result.storyText).toContain('A级《史记》交叉佐证');

    // Verify file was written
    const fileContent = fs.readFileSync(result.filePath, 'utf-8');
    expect(fileContent).toContain('屈原投江——悲壮化为纪念');
    expect(fileContent).toContain('短剧');
  });
});