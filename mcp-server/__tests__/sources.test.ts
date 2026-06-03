import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getSourcesRoot, writeVideoSourceFile, writeArticleSourceFile, writeBookSourceFile, writeOralSourceFile } from '../src/lib/sources.js';
import { VideoSource } from '../src/types.js';

const tmpDir = path.join(os.tmpdir(), 'kb-sources-test-' + Date.now());

beforeEach(() => {
  fs.mkdirSync(path.join(tmpDir, 'provinces'), { recursive: true });
  // Minimal province file for KB_ROOT resolution
  fs.writeFileSync(path.join(tmpDir, 'provinces', '北京.md'), '# 北京\n\n## 待整理条目\n\n## 已整理条目\n');
});

afterEach(() => {
  // Clean up tmpDir first (test-specific)
  fs.rmSync(tmpDir, { recursive: true, force: true });
  // Clean up sources dir (shared across tests on Windows — retry to handle race)
  const sourcesRoot = path.join(tmpDir, '..', 'sources');
  if (fs.existsSync(sourcesRoot)) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.rmSync(sourcesRoot, { recursive: true, force: true });
        break;
      } catch {
        // Windows may fail with ENOTEMPTY if other parallel tests still hold files
        // Wait briefly and retry
        if (attempt < 2) {
          // Small delay to let other tests finish writing
          const start = Date.now();
          while (Date.now() - start < 50) { /* busy wait 50ms */ }
        }
      }
    }
  }
});

describe('sources lib', () => {
  it('should resolve sources root path', () => {
    process.env.KB_ROOT = tmpDir;
    const sourcesRoot = getSourcesRoot();
    expect(sourcesRoot).toContain('sources');
  });

  it('should write video source file', async () => {
    process.env.KB_ROOT = tmpDir;
    const source: VideoSource = {
      bvId: 'BV19dGb66ERy',
      url: 'https://www.bilibili.com/video/BV19dGb66ERy',
      title: '中国传统文化故事',
      upOwner: '文化频道',
      publishDate: '2026-01-01',
      topic: '传统文化',
      status: '待整理',
    };
    const filePath = await writeVideoSourceFile(source, '讲述屈原的故事', '屈原投江汨罗');
    expect(filePath).toContain('videos');
    expect(filePath).toContain('BV19dGb66ERy.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('BV19dGb66ERy');
    expect(content).toContain('屈原投江汨罗');
  });

  it('should write article source file', async () => {
    process.env.KB_ROOT = tmpDir;
    const filePath = await writeArticleSourceFile(
      { url: 'https://example.com/article', title: '非遗故事', author: '张三', platform: '其他', publishDate: '2026-03-15' },
      '关于端午节的起源',
      '端午节起源'
    );
    expect(filePath).toContain('articles');
    expect(filePath).toContain('非遗故事.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('非遗故事');
    expect(content).toContain('端午节起源');
  });

  it('should write book source file', async () => {
    process.env.KB_ROOT = tmpDir;
    const filePath = await writeBookSourceFile(
      { title: '中国民间故事集', author: '冯骥才' },
      '民间故事概述',
      '民间故事'
    );
    expect(filePath).toContain('books');
    expect(filePath).toContain('中国民间故事集.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('冯骥才');
  });

  it('should write oral source file', async () => {
    process.env.KB_ROOT = tmpDir;
    const filePath = await writeOralSourceFile(
      { narrator: '李大爷', narratorInfo: '当地老人', location: '岳阳汨罗', date: '2026-05-20', recorder: '王记者' },
      '屈原传说',
      '屈原投江汨罗'
    );
    expect(filePath).toContain('oral');
    expect(filePath).toContain('李大爷-屈原传说.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('李大爷');
    expect(content).toContain('屈原投江汨罗');
  });

  it('should sanitize file names with special characters', async () => {
    process.env.KB_ROOT = tmpDir;
    const filePath = await writeArticleSourceFile(
      { url: '', title: '故事:传说/版本', author: '', platform: '其他', publishDate: '' },
      '内容',
      '测试条目'
    );
    expect(filePath).toContain('故事-传说-版本.md');
  });
});