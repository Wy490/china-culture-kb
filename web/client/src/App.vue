<template>
  <div id="app-root">
    <header class="app-header">
      <h1 class="app-title">AI影视工作台</h1>
      <nav class="app-nav">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/knowledge">素材库</RouterLink>
        <RouterLink to="/projects">项目指挥</RouterLink>
        <RouterLink to="/supplement-tasks">素材补充</RouterLink>
        <RouterLink to="/knowledge-writeback-queue">写回队列</RouterLink>
        <RouterLink to="/search">素材搜索</RouterLink>
        <RouterLink to="/story/new">单片短片</RouterLink>
        <RouterLink to="/story/stage6-revisions">修订工作台</RouterLink>
        <RouterLink to="/story/stage6-intake">真实输入接入</RouterLink>
        <RouterLink to="/story/stage6-preflight">批次预检</RouterLink>
        <RouterLink to="/story/stage6-exit-audit">退出审计</RouterLink>
        <RouterLink to="/story/stage6-package-inspector">初始包检查</RouterLink>
        <RouterLink to="/story/stage6-operations">Stage 6 总控</RouterLink>
        <RouterLink to="/story/stage6-table-read-inspector">桌读证据</RouterLink>
        <RouterLink to="/story/stage6-exit-review-signature">退出签名</RouterLink>
        <RouterLink to="/story/stage7-golden-card-review">黄金卡审稿</RouterLink>
        <RouterLink to="/story/stage7-golden-card-expansion">候选补齐</RouterLink>
        <RouterLink to="/story/stage7-golden-card-signature">黄金卡签名</RouterLink>
        <RouterLink to="/story/stage7-operations">Stage 7 总控</RouterLink>
        <RouterLink to="/story/stage8-blind-review-intake">Stage 8 盲评</RouterLink>
        <RouterLink to="/story/stage8-blind-review-signature">盲评签名</RouterLink>
        <RouterLink to="/story/stage8-finalization-preflight">终局预检</RouterLink>
        <RouterLink to="/story/stage8-durable-release-import">Release 导入</RouterLink>
        <RouterLink to="/story/stage8-operations">Stage 8 总控</RouterLink>
        <RouterLink to="/ai-comic-series/new">漫剧系列</RouterLink>
      </nav>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

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
.app-nav a.router-link-active {
  background: rgba(255, 255, 255, 0.15);
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
  .app-main {
    padding: 16px;
  }
}
</style>
