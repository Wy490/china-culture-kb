<template>
  <section v-if="video" :class="['gears-video-status', `gears-video-status--${video.status}`]">
    <div class="gears-video-status__body">
      <div>
        <span class="gears-video-status__label">GEARS 成片</span>
        <strong class="gears-video-status__title">{{ view.title }}</strong>
      </div>
      <p class="gears-video-status__desc">{{ view.description }}</p>
      <p class="gears-video-status__meta">
        {{ formatTime(video.updated_at) }}
      </p>
      <div v-if="video.video_url" class="gears-video-status__actions">
        <a class="gears-video-status__link" :href="video.video_url" target="_blank" rel="noopener noreferrer">
          打开成片
        </a>
        <a
          v-if="video.thumbnail_url"
          class="gears-video-status__link gears-video-status__link--secondary"
          :href="video.thumbnail_url"
          target="_blank"
          rel="noopener noreferrer"
        >
          查看封面
        </a>
      </div>
    </div>
    <img
      v-if="video.thumbnail_url"
      class="gears-video-status__thumb"
      :src="video.thumbnail_url"
      alt="GEARS 成片封面"
      loading="lazy"
    >
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GearsVideoResult } from '@shared/types'

const props = defineProps<{
  video?: GearsVideoResult | null
}>()

const view = computed(() => {
  if (props.video?.status === 'ready') {
    return {
      title: '成片已就绪',
      description: 'GEARS 已回传成片地址，可打开查看或下载。',
    }
  }
  if (props.video?.status === 'failed') {
    return {
      title: '生成未完成',
      description: 'GEARS 回传了失败状态，可根据制作端日志继续处理。',
    }
  }
  return {
    title: '制作中',
    description: 'GEARS 已接收任务，正在处理成片。',
  }
})

function formatTime(iso: string): string {
  if (!iso) return '未记录更新时间'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '更新时间格式异常'
  return `更新时间：${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.gears-video-status {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  margin: 12px 0 0;
  padding: 12px 14px;
  border: 1px solid #d8e1e8;
  border-left-width: 4px;
  border-radius: 6px;
  background: #f8fafb;
  color: #2c3e50;
}

.gears-video-status--ready {
  border-left-color: #27ae60;
  background: #f3fbf6;
}

.gears-video-status--failed {
  border-left-color: #c0392b;
  background: #fff7f6;
}

.gears-video-status--processing {
  border-left-color: #2980b9;
  background: #f5faff;
}

.gears-video-status__body {
  min-width: 0;
}

.gears-video-status__label {
  display: block;
  margin-bottom: 3px;
  color: #7f8c8d;
  font-size: 12px;
  font-weight: 700;
}

.gears-video-status__title {
  color: #2c3e50;
  font-size: 15px;
}

.gears-video-status__desc,
.gears-video-status__meta {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.gears-video-status__meta {
  color: #60717d;
}

.gears-video-status__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.gears-video-status__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 6px 10px;
  border: 1px solid #2474a6;
  border-radius: 4px;
  background: #2980b9;
  color: #fff;
  font-size: 13px;
  text-decoration: none;
}

.gears-video-status__link--secondary {
  border-color: #cfd9e1;
  background: #fff;
  color: #314252;
}

.gears-video-status__thumb {
  width: 116px;
  aspect-ratio: 16 / 9;
  border-radius: 4px;
  border: 1px solid #d7dee5;
  object-fit: cover;
  background: #eef2f5;
}

@media (max-width: 640px) {
  .gears-video-status {
    grid-template-columns: 1fr;
  }

  .gears-video-status__thumb {
    width: 100%;
    max-width: 260px;
  }
}
</style>
