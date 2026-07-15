import { computed, ref } from 'vue';
import {
  PRODUCT_ROLES,
  isProductRoleId,
  type ProductFeatureFlag,
  type ProductNavigationAccess,
  type ProductRoleId,
} from '@shared/product-navigation';
import type { ProductAccessContext } from '@shared/product-access';
import { getCurrentProductAccessContext } from '@/api/system';
import { setApiAccessFailureHandler } from '@/api/client';

const ROLE_PREVIEW_STORAGE_KEY = 'story-agent.product-role-preview';
export const productRolePreviewEnabled = import.meta.env.VITE_ENABLE_ROLE_PREVIEW === 'true';

function configuredRole(): ProductRoleId {
  if (productRolePreviewEnabled && typeof sessionStorage !== 'undefined') {
    const previewRole = sessionStorage.getItem(ROLE_PREVIEW_STORAGE_KEY) ?? undefined;
    if (isProductRoleId(previewRole)) return previewRole;
  }
  const environmentRole = import.meta.env.VITE_STORY_AGENT_ROLE;
  if (isProductRoleId(environmentRole)) return environmentRole;
  return 'creator';
}

function configuredFeatureFlags(): ProductFeatureFlag[] {
  return import.meta.env.VITE_ENABLE_INTERNAL_STORY_TOOLS === 'true'
    ? ['internal_story_tools']
    : [];
}

export const productRole = ref<ProductRoleId>(configuredRole());
export const serverProductAccessContext = ref<ProductAccessContext | null>(null);
export const serverProductAccessError = ref('');
export type ProductAccessLifecycleState = 'unknown' | 'authenticated' | 'local_bypass' | 'unauthenticated' | 'error';
export const productAccessLifecycleState = ref<ProductAccessLifecycleState>('unknown');
let synchronizationPromise: Promise<ProductAccessContext | null> | null = null;
export const productRoleDefinition = computed(() => (
  PRODUCT_ROLES.find(role => role.id === productRole.value) ?? PRODUCT_ROLES[0]
));
export const productNavigationAccess = computed<ProductNavigationAccess>(() => ({
  role: productRole.value,
  enabled_feature_flags: productRolePreviewEnabled
    ? configuredFeatureFlags()
    : serverProductAccessContext.value?.mode === 'required'
    ? serverProductAccessContext.value.actor?.enabled_feature_flags ?? []
    : configuredFeatureFlags(),
}));

export function setProductRolePreview(role: ProductRoleId): void {
  if (!productRolePreviewEnabled) return;
  productRole.value = role;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(ROLE_PREVIEW_STORAGE_KEY, role);
  }
}

export function currentProductNavigationAccess(): ProductNavigationAccess {
  return productNavigationAccess.value;
}

export function invalidateProductAccessContext(message = '登录状态已失效，请重新登录'): void {
  serverProductAccessContext.value = null;
  serverProductAccessError.value = message;
  productAccessLifecycleState.value = 'unauthenticated';
}

setApiAccessFailureHandler((response) => {
  invalidateProductAccessContext(response.error?.message ?? '登录状态已失效，请重新登录');
});

export async function synchronizeProductAccessContext(force = false): Promise<ProductAccessContext | null> {
  if (!force && productAccessLifecycleState.value !== 'unknown') return serverProductAccessContext.value;
  if (synchronizationPromise) return synchronizationPromise;
  synchronizationPromise = (async () => {
    const response = await getCurrentProductAccessContext();
    if (!response.ok || !response.data) {
      serverProductAccessContext.value = null;
      serverProductAccessError.value = response.error?.message ?? '服务端身份上下文读取失败';
      if (response.error?.code !== 'ACCESS_UNAUTHENTICATED') {
        productAccessLifecycleState.value = 'error';
      }
      return null;
    }
    serverProductAccessContext.value = response.data;
    serverProductAccessError.value = '';
    productAccessLifecycleState.value = response.data.mode === 'required'
      ? 'authenticated'
      : 'local_bypass';
    if (
      !productRolePreviewEnabled
      && response.data.mode === 'required'
      && response.data.authenticated
      && response.data.actor
    ) {
      productRole.value = response.data.actor.role;
    }
    return response.data;
  })();
  try {
    return await synchronizationPromise;
  } finally {
    synchronizationPromise = null;
  }
}
