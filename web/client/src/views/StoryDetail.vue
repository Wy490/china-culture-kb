<template>
  <div class="story-detail-page">
    <div v-if="loading" class="story-detail-page__loading">
      <div class="story-detail-page__spinner" />
      <p>正在加载故事详情…</p>
    </div>

    <div v-else-if="error" class="story-detail-page__error">{{ error }}</div>

    <div v-else-if="story">
      <StoryResult :result="story" />

      <!-- GEARS 操作区（独立突出展示） -->
      <GearsActions
        v-if="story.gears_segments && story.gears_segments.length > 0"
        :segments="story.gears_segments"
        :gears-segments-url="story.gears_segments_url"
        :story-id="story.storyId"
      />

      <!-- Back link -->
      <div class="story-detail-page__back">
        <RouterLink
          v-if="story.project_id"
          class="btn btn--back"
          :to="`/projects/${story.project_id}`"
        >
          进入故事项目
        </RouterLink>
        <RouterLink v-else class="btn btn--back" to="/projects">返回故事项目</RouterLink>
        <RouterLink class="btn btn--back" to="/story/new">继续生成故事</RouterLink>
      </div>
    </div>

    <!-- No storyId -->
    <div v-if="!storyIdParam" class="story-detail-page__empty">
      <p>请从故事工坊或首页进入故事详情。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getStory } from '@/api/stories'
import type { StoryGenerateResult } from '@shared/types'
import StoryResult from '@/components/StoryResult.vue'
import GearsActions from '@/components/GearsActions.vue'

const route = useRoute()

const storyIdParam = ref('')
const story = ref<StoryGenerateResult | null>(null)
const loading = ref(false)
const error = ref('')

async function loadStory(storyId: string) {
  if (!storyId) return
  storyIdParam.value = storyId
  loading.value = true
  error.value = ''
  story.value = null

  const res = await getStory(storyId)
  if (res.ok && res.data) {
    story.value = res.data
  } else {
    error.value = res.error?.message ?? '加载故事失败'
  }
  loading.value = false
}

onMounted(() => {
  const id = route.params.storyId as string | undefined
  if (id) loadStory(id)
})
</script>

<style scoped>
.story-detail-page {
  max-width: 800px;
  margin: 0 auto;
}

/* Loading */
.story-detail-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #7f8c8d;
}

.story-detail-page__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #ecf0f1;
  border-top: 3px solid #2980b9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Error */
.story-detail-page__error {
  padding: 10px 14px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 4px;
  font-size: 14px;
}

/* Back */
.story-detail-page__back {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-size: 15px;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.2s;
  display: inline-flex;
  align-items: center;
}

.btn--back {
  background: #ecf0f1;
  color: #2c3e50;
}

.btn--back:hover {
  opacity: 0.85;
}

/* Empty */
.story-detail-page__empty {
  text-align: center;
  padding: 40px 20px;
  color: #95a5a6;
  font-size: 16px;
}
</style>
