<template>
  <div id="app-root">
    <header class="app-header">
      <RouterLink class="app-title" to="/">AI影视工作台</RouterLink>
      <nav class="app-nav" aria-label="一级导航" data-testid="primary-navigation">
        <RouterLink
          v-for="item in primaryNavigation"
          :key="item.id"
          :to="item.to"
          :class="{ 'app-nav__link--active': item.id === activeWorkspace }"
          :aria-current="item.id === activeWorkspace ? 'page' : undefined"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="app-role" data-testid="product-role">
        <span>{{ productRoleDefinition.label }}</span>
        <select v-if="productRolePreviewEnabled" :value="productRole" aria-label="角色视图" @change="changeRolePreview">
          <option v-for="roleOption in productRoles" :key="roleOption.id" :value="roleOption.id">
            {{ roleOption.label }}
          </option>
        </select>
      </div>
    </header>
    <nav v-if="secondaryNavigation.length" class="app-subnav" aria-label="二级导航">
      <span class="app-subnav__label">{{ activeWorkspaceLabel }}</span>
      <RouterLink v-for="item in standardSecondaryNavigation" :key="item.id" :to="item.to">
        {{ item.label }}
      </RouterLink>
      <details v-if="internalSecondaryNavigation.length" class="app-subnav__internal">
        <summary>内部工具</summary>
        <div>
          <RouterLink v-for="item in internalSecondaryNavigation" :key="item.id" :to="item.to">
            {{ item.label }}
          </RouterLink>
        </div>
      </details>
    </nav>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  PRODUCT_ROLES,
  PRODUCT_WORKSPACE_NAVIGATION,
  productNavigationForWorkspace,
  productWorkspaceForPath,
  type ProductRoleId,
} from '@shared/product-navigation';
import {
  productNavigationAccess,
  productAccessLifecycleState,
  productRole,
  productRoleDefinition,
  productRolePreviewEnabled,
  setProductRolePreview,
} from '@/product-access';

const route = useRoute();
const router = useRouter();
const primaryNavigation = PRODUCT_WORKSPACE_NAVIGATION;
const productRoles = PRODUCT_ROLES;
const activeWorkspace = computed(() => productWorkspaceForPath(route.path));
const activeWorkspaceLabel = computed(() => (
  PRODUCT_WORKSPACE_NAVIGATION.find(item => item.id === activeWorkspace.value)?.label ?? '创作'
));
const secondaryNavigation = computed(() => productNavigationForWorkspace(
  activeWorkspace.value,
  productNavigationAccess.value,
));
const standardSecondaryNavigation = computed(() => secondaryNavigation.value.filter(item => !item.feature_flag));
const internalSecondaryNavigation = computed(() => secondaryNavigation.value.filter(item => item.feature_flag));

watch(productAccessLifecycleState, (state) => {
  if (state === 'unauthenticated' && route.name !== 'AccessRequired') {
    void router.replace({ name: 'AccessRequired', query: { return_to: route.fullPath } });
  }
});

async function changeRolePreview(event: Event) {
  const role = (event.target as HTMLSelectElement).value as ProductRoleId;
  setProductRolePreview(role);
  const destination = PRODUCT_ROLES.find(item => item.id === role)?.default_route ?? '/projects';
  await router.push(destination);
}
</script>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 32px;
}

.app-title {
  font-size: 22px;
  margin: 0;
  white-space: nowrap;
  color: inherit;
  text-decoration: none;
}

.app-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
}

.app-nav a {
  color: #ecf0f1;
  text-decoration: none;
  font-size: 15px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.app-nav a:hover,
.app-nav a.app-nav__link--active {
  background: rgba(255, 255, 255, 0.15);
}

.app-role {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #c7d7e0;
  font-size: 12px;
  white-space: nowrap;
}

.app-role span {
  padding: 5px 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
}

.app-role select {
  padding: 5px 7px;
  border: 1px solid #6d8291;
  border-radius: 6px;
  color: #eff6f8;
  background: #263946;
}

.app-subnav {
  min-height: 46px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #d9e1e6;
  background: #f8fafb;
}

.app-subnav__label {
  margin-right: 8px;
  color: #63717d;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.app-subnav a,
.app-subnav summary {
  padding: 7px 10px;
  border-radius: 7px;
  color: #344652;
  font-size: 13px;
  text-decoration: none;
}

.app-subnav a:hover,
.app-subnav a.router-link-exact-active {
  color: #145f5b;
  background: #e4f0ee;
}

.app-subnav__internal {
  position: relative;
  margin-left: auto;
}

.app-subnav__internal summary {
  cursor: pointer;
  list-style: none;
}

.app-subnav__internal > div {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  right: 0;
  width: 230px;
  padding: 8px;
  display: grid;
  gap: 4px;
  border: 1px solid #d2dce1;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 16px 32px rgba(26, 49, 62, 0.18);
}

.app-main {
  flex: 1;
  padding: 24px;
}

/* ===== Mobile Responsive ===== */
@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }
  .app-nav {
    flex-wrap: wrap;
    justify-content: center;
  }
  .app-role {
    margin-left: 0;
  }
  .app-subnav {
    padding: 8px 12px;
    flex-wrap: wrap;
  }
  .app-subnav__internal {
    margin-left: 0;
  }
  .app-main {
    padding: 16px;
  }
}
</style>
