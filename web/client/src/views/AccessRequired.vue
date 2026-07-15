<template>
  <section class="access-required" data-testid="access-required">
    <p class="access-required__eyebrow">登录状态</p>
    <h1>需要重新登录</h1>
    <p>{{ serverProductAccessError || '当前会话不存在、已过期或已被撤销。' }}</p>

    <div v-if="loading" class="access-required__status">正在读取受控登录配置…</div>
    <div v-else-if="handoff?.provider_valid && handoff.redirect_url" class="access-required__actions">
      <a :href="handoff.redirect_url" data-testid="login-handoff-link" rel="noreferrer">前往身份提供方</a>
      <button type="button" @click="recheckSession">我已登录，重新检测</button>
    </div>
    <div v-else class="access-required__blocked" data-testid="login-handoff-blocked">
      <strong>登录提供方尚未配置</strong>
      <p>请由管理员配置受控登录 URL 与 session issuer；请求角色头、页面角色预览和本地准备状态都不能替代登录。</p>
      <code v-for="blocker in handoff?.blockers ?? []" :key="blocker">{{ blocker }}</code>
      <button type="button" @click="recheckSession">重新检测会话</button>
    </div>

    <dl>
      <div>
        <dt>登录后返回</dt>
        <dd><code>{{ safeReturnTo }}</code></dd>
      </div>
      <div>
        <dt>会话边界</dt>
        <dd>HttpOnly · SameSite=Lax · 生产环境 Secure</dd>
      </div>
    </dl>
    <p class="access-required__credit">登录 handoff 和测试会话均不授予真人审核、真实回片、signed release 或 professional pass 信用。</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ProductLoginHandoff } from '@shared/product-access';
import { getProductLoginHandoff } from '@/api/system';
import {
  productAccessLifecycleState,
  serverProductAccessError,
  synchronizeProductAccessContext,
} from '@/product-access';

const route = useRoute();
const router = useRouter();
const handoff = ref<ProductLoginHandoff | null>(null);
const loading = ref(true);

function safeLocalReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/';
  const candidate = value.trim();
  if (
    !candidate.startsWith('/')
    || candidate.startsWith('//')
    || candidate.includes('\\')
    || candidate.length > 1000
    || candidate.startsWith('/access-required')
  ) return '/';
  try {
    const decodedPath = decodeURIComponent(candidate.split(/[?#]/, 1)[0]);
    if (decodedPath.startsWith('//') || decodedPath.includes('\\')) return '/';
  } catch {
    return '/';
  }
  return candidate;
}

const safeReturnTo = computed(() => safeLocalReturnTo(route.query.return_to));

async function loadHandoff(): Promise<void> {
  loading.value = true;
  const response = await getProductLoginHandoff(safeReturnTo.value);
  handoff.value = response.ok ? response.data : null;
  loading.value = false;
}

async function recheckSession(): Promise<void> {
  await synchronizeProductAccessContext(true);
  if (productAccessLifecycleState.value === 'authenticated' || productAccessLifecycleState.value === 'local_bypass') {
    await router.replace(safeReturnTo.value);
  }
}

watch(() => route.query.return_to, () => {
  void loadHandoff();
});

onMounted(() => {
  void loadHandoff();
});
</script>

<style scoped>
.access-required {
  max-width: 720px;
  margin: 64px auto;
  padding: 38px;
  border: 1px solid #c9d9e1;
  border-radius: 22px;
  background: #f8fbfc;
  color: #263b46;
}

.access-required__eyebrow {
  margin: 0;
  color: #23736d;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.15em;
}

.access-required h1 {
  margin: 8px 0;
}

.access-required p,
.access-required dd {
  color: #586c76;
  line-height: 1.7;
}

.access-required__actions,
.access-required__blocked {
  margin: 24px 0;
  padding: 18px;
  border-radius: 14px;
  background: #eaf3f2;
}

.access-required__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.access-required a,
.access-required button {
  display: inline-flex;
  padding: 10px 14px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: #176b65;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.access-required__blocked code {
  display: block;
  margin: 6px 0;
  color: #8a4d20;
}

.access-required dl {
  display: grid;
  gap: 10px;
}

.access-required dl > div {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px;
}

.access-required dt {
  font-weight: 800;
}

.access-required dd {
  margin: 0;
}

.access-required__credit {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #dbe5e9;
  font-size: 13px;
}
</style>
