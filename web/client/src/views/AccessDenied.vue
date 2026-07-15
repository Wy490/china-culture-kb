<template>
  <section class="access-denied">
    <p>受控工作区</p>
    <h1>当前角色无权打开此任务</h1>
    <span>{{ productRoleDefinition.label }} · {{ productRoleDefinition.description }}</span>
    <p>目标：<code>{{ target }}</code></p>
    <p>内部检查器还必须同时开启对应 feature flag，并由服务端身份注册表与 RBAC 再次校验；本地角色预览本身不授予 API 权限。</p>
    <RouterLink :to="fallbackRoute">返回可用工作区</RouterLink>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { productRoleDefinition } from '@/product-access';

const route = useRoute();
const target = computed(() => String(route.query.target ?? '/'));
const fallbackRoute = computed(() => productRoleDefinition.value.default_route);
</script>

<style scoped>
.access-denied {
  max-width: 720px;
  margin: 72px auto;
  padding: 38px;
  border: 1px solid #e1c9a6;
  border-radius: 22px;
  background: #fffaf2;
  color: #3d3428;
}

.access-denied > p:first-child {
  color: #9b5d21;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.15em;
}

.access-denied h1 {
  margin: 8px 0;
}

.access-denied span,
.access-denied p {
  color: #6f6253;
  line-height: 1.7;
}

.access-denied a {
  display: inline-flex;
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  color: #fff;
  background: #805326;
  text-decoration: none;
}
</style>
