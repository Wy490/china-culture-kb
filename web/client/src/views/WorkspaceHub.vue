<template>
  <section class="workspace-hub">
    <header class="workspace-hub__hero">
      <p class="workspace-hub__eyebrow">{{ workspace.label }}工作区</p>
      <h1>{{ workspace.label }}</h1>
      <p>{{ workspace.description }}</p>
      <small>{{ productRoleDefinition.label }} · {{ productRoleDefinition.description }}</small>
    </header>

    <p v-if="standardItems.length === 0" class="workspace-hub__empty">当前角色在此工作区没有可执行任务。</p>
    <div class="workspace-hub__grid">
      <RouterLink
        v-for="item in standardItems"
        :key="item.id"
        class="workspace-hub__card"
        :to="item.to"
      >
        <strong>{{ item.label }}</strong>
        <span>{{ item.description }}</span>
        <b>进入任务 →</b>
      </RouterLink>
    </div>

    <details v-if="internalItems.length" class="workspace-hub__internal">
      <summary>内部工具</summary>
      <p>仅用于已授权的运营、检查和发布治理，不代表真人通过或正式发布。</p>
      <div class="workspace-hub__grid workspace-hub__grid--internal">
        <RouterLink v-for="item in internalItems" :key="item.id" class="workspace-hub__card" :to="item.to">
          <strong>{{ item.label }}</strong>
          <span>{{ item.description }}</span>
          <b>打开工具 →</b>
        </RouterLink>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  PRODUCT_WORKSPACE_NAVIGATION,
  productNavigationForWorkspace,
  type ProductWorkspaceId,
} from '@shared/product-navigation';
import { productNavigationAccess, productRoleDefinition } from '@/product-access';

const route = useRoute();
const workspaceId = computed(() => route.meta.workspace as ProductWorkspaceId);
const workspace = computed(() => (
  PRODUCT_WORKSPACE_NAVIGATION.find(item => item.id === workspaceId.value)
  ?? PRODUCT_WORKSPACE_NAVIGATION[0]
));
const workspaceItems = computed(() => productNavigationForWorkspace(workspaceId.value, productNavigationAccess.value));
const standardItems = computed(() => workspaceItems.value.filter(item => !item.feature_flag));
const internalItems = computed(() => workspaceItems.value.filter(item => item.feature_flag === 'internal_story_tools'));
</script>

<style scoped>
.workspace-hub {
  max-width: 1120px;
  margin: 0 auto;
  color: #18212b;
}

.workspace-hub__hero {
  padding: 48px;
  border-radius: 24px;
  color: #f7fbff;
  background: linear-gradient(135deg, #173956, #26706d);
  box-shadow: 0 20px 48px rgba(28, 63, 84, 0.18);
}

.workspace-hub__eyebrow {
  margin: 0;
  color: #b7f0dc;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.workspace-hub__hero h1 {
  margin: 8px 0;
  font-size: clamp(38px, 7vw, 68px);
}

.workspace-hub__hero > p:not(.workspace-hub__eyebrow) {
  max-width: 680px;
  margin: 0;
  color: #d8e8ee;
  font-size: 17px;
}

.workspace-hub__hero small {
  display: inline-block;
  margin-top: 18px;
  color: #b7d6d5;
}

.workspace-hub__empty {
  margin: 22px 0 0;
  padding: 18px;
  border: 1px dashed #b8c5cb;
  border-radius: 14px;
  color: #687780;
  background: #f6f8f9;
}

.workspace-hub__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-top: 22px;
}

.workspace-hub__card {
  display: flex;
  min-height: 132px;
  padding: 22px;
  flex-direction: column;
  gap: 10px;
  border: 1px solid #d8e2e8;
  border-radius: 18px;
  color: inherit;
  background: #fff;
  text-decoration: none;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.workspace-hub__card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(31, 61, 77, 0.12);
}

.workspace-hub__card strong {
  font-size: 20px;
}

.workspace-hub__card span {
  color: #667581;
  line-height: 1.6;
}

.workspace-hub__card b {
  margin-top: auto;
  color: #186e68;
  font-size: 13px;
}

.workspace-hub__internal {
  margin-top: 28px;
  padding: 20px;
  border: 1px dashed #a8b5bd;
  border-radius: 18px;
  background: #f4f7f8;
}

.workspace-hub__internal summary {
  cursor: pointer;
  font-weight: 800;
}

.workspace-hub__internal > p {
  color: #6b7780;
}

.workspace-hub__grid--internal .workspace-hub__card {
  background: #fbfcfc;
}

@media (max-width: 720px) {
  .workspace-hub__hero {
    padding: 30px 24px;
  }
}
</style>
