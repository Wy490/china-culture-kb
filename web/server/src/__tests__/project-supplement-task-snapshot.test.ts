import { describe, expect, it } from 'vitest';
import type { ProjectSupplementTaskListItem } from '@shared/types.js';
import { filterProjectSupplementTaskSnapshot } from '../services/project-service.js';

function taskItem(
  taskId: string,
  overrides: Partial<ProjectSupplementTaskListItem> = {},
): ProjectSupplementTaskListItem {
  return {
    project_id: `project-${taskId}`,
    current_story_id: `story-${taskId}`,
    project_title: `项目 ${taskId}`,
    source_domain: 'china-culture',
    source_entry: '苏绣',
    video_type: 'documentary_short',
    knowledge_writeback_eligible: true,
    knowledge_writeback_blockers: [],
    target_province: '江苏',
    suggested_file_path: 'data/provinces/江苏.md',
    suggested_section_heading: '苏绣',
    updated_at: '2026-08-22T08:00:00.000Z',
    task: {
      task_id: taskId,
      need_id: taskId,
      label: taskId,
      description: `补充 ${taskId}`,
      stage: 'script_ready',
      blocking_level: 'blocking',
      status: 'open',
      source: 'knowledge_pack_missing_need',
      created_at: '2026-08-22T08:00:00.000Z',
      knowledge_candidate_review_status: 'approved',
      knowledge_writeback_draft_markdown: `## ${taskId}`,
      knowledge_writeback_status: 'queued',
    },
    ...overrides,
  };
}

describe('project supplement task snapshot filtering', () => {
  it('reuses computed task fields for every list filter while preserving snapshot order', () => {
    const first = taskItem('first');
    const second = taskItem('second', {
      project_id: 'target-project',
      video_type: 'explainer_video',
      target_province: '浙江',
      task: {
        ...taskItem('second').task,
        stage: 'minimum_viable_story',
        blocking_level: 'risk',
        source: 'material_sufficiency_missing_item',
      },
    });
    const third = taskItem('third', {
      project_id: 'target-project',
      video_type: 'explainer_video',
      target_province: '浙江',
      task: {
        ...second.task,
        task_id: 'third',
        need_id: 'third',
        label: 'third',
      },
    });
    const resolved = taskItem('resolved', {
      project_id: 'target-project',
      video_type: 'explainer_video',
      target_province: '浙江',
      task: {
        ...second.task,
        task_id: 'resolved',
        need_id: 'resolved',
        label: 'resolved',
        status: 'resolved',
      },
    });

    const filtered = filterProjectSupplementTaskSnapshot(
      [first, second, third, resolved],
      {
        project_id: 'target-project',
        video_type: 'explainer_video',
        province: '浙江',
        status: 'open',
        stage: 'minimum_viable_story',
        blocking_level: 'risk',
        source: 'material_sufficiency_missing_item',
        knowledge_writeback_ready: true,
        knowledge_writeback_status: 'queued',
      },
    );

    expect(filtered.map(item => item.task.task_id)).toEqual(['second', 'third']);
  });

  it('uses draft_ready as the implicit writeback status and excludes ineligible tasks', () => {
    const eligible = taskItem('eligible', {
      task: {
        ...taskItem('eligible').task,
        knowledge_writeback_status: undefined,
      },
    });
    const ineligible = taskItem('ineligible', {
      knowledge_writeback_eligible: false,
      task: {
        ...taskItem('ineligible').task,
        knowledge_writeback_status: undefined,
      },
    });
    const unreviewed = taskItem('unreviewed', {
      task: {
        ...taskItem('unreviewed').task,
        knowledge_candidate_review_status: 'pending_review',
        knowledge_writeback_status: undefined,
      },
    });

    expect(filterProjectSupplementTaskSnapshot(
      [eligible, ineligible, unreviewed],
      { knowledge_writeback_status: 'draft_ready' },
    ).map(item => item.task.task_id)).toEqual(['eligible']);
  });
});
