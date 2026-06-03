import fs from 'node:fs/promises';
import path from 'node:path';
import { VideoSource, ArticleSource, OralSource } from '../types.js';
import { getKbRoot } from './provinces.js';

export function getSourcesRoot(): string {
  const kbRoot = getKbRoot();
  return path.resolve(kbRoot, '..', 'sources');
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, '-');
}

export async function writeVideoSourceFile(
  source: VideoSource,
  contentSummary: string,
  entryName: string
): Promise<string> {
  const dir = path.join(getSourcesRoot(), 'videos');
  await fs.mkdir(dir, { recursive: true });
  const fileName = sanitizeFileName(source.bvId) + '.md';
  const filePath = path.join(dir, fileName);

  const content = [
    `# ${source.title}`,
    '',
    '## 视频信息',
    `- **BV号**：${source.bvId}`,
    `- **链接**：${source.url}`,
    `- **UP主**：${source.upOwner}`,
    `- **发布日期**：${source.publishDate}`,
    `- **时长**：待补充`,
    '',
    '## 内容摘要',
    contentSummary || '（待补充）',
    '',
    '## 关联条目',
    `- [[${entryName}]]`,
    '',
  ].join('\n');

  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

export async function writeArticleSourceFile(
  source: { url: string; title: string; author: string; platform: string; publishDate: string },
  contentSummary: string,
  entryName: string
): Promise<string> {
  const dir = path.join(getSourcesRoot(), 'articles');
  await fs.mkdir(dir, { recursive: true });
  const fileName = sanitizeFileName(source.title) + '.md';
  const filePath = path.join(dir, fileName);

  const content = [
    `# ${source.title}`,
    '',
    '## 文章信息',
    `- **链接**：${source.url || '未提供'}`,
    `- **作者**：${source.author || '未知'}`,
    `- **平台**：${source.platform || '其他'}`,
    `- **发布日期**：${source.publishDate || '未知'}`,
    '',
    '## 内容摘要',
    contentSummary || '（待补充）',
    '',
    '## 关联条目',
    `- [[${entryName}]]`,
    '',
  ].join('\n');

  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

export async function writeBookSourceFile(
  source: { title: string; author: string },
  contentSummary: string,
  entryName: string
): Promise<string> {
  const dir = path.join(getSourcesRoot(), 'books');
  await fs.mkdir(dir, { recursive: true });
  const fileName = sanitizeFileName(source.title) + '.md';
  const filePath = path.join(dir, fileName);

  const content = [
    `# ${source.title}`,
    '',
    '## 书籍信息',
    `- **标题**：${source.title}`,
    `- **作者**：${source.author || '未知'}`,
    '',
    '## 内容摘要',
    contentSummary || '（待补充）',
    '',
    '## 关联条目',
    `- [[${entryName}]]`,
    '',
  ].join('\n');

  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

export async function writeOralSourceFile(
  source: { narrator: string; narratorInfo: string; location: string; date: string; recorder: string },
  storyName: string,
  entryName: string
): Promise<string> {
  const dir = path.join(getSourcesRoot(), 'oral');
  await fs.mkdir(dir, { recursive: true });
  const fileName = sanitizeFileName(`${source.narrator}-${storyName}`) + '.md';
  const filePath = path.join(dir, fileName);

  const content = [
    `# ${storyName}——口述来源`,
    '',
    '## 口述信息',
    `- **讲述人**：${source.narrator}`,
    `- **讲述人背景**：${source.narratorInfo || '待补充'}`,
    `- **地点**：${source.location || '待补充'}`,
    `- **日期**：${source.date || '待补充'}`,
    `- **记录人**：${source.recorder || '待补充'}`,
    '',
    '## 内容摘要',
    '（待补充）',
    '',
    '## 关联条目',
    `- [[${entryName}]]`,
    '',
  ].join('\n');

  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}