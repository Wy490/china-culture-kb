<template>
  <div id="app-root">
    <header class="app-header">
      <h1 class="app-title">中国传统文化知识库</h1>
      <nav class="app-nav">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/search">搜索</RouterLink>
        <RouterLink to="/story/new">故事生成</RouterLink>
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
  gap: 20px;
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
  .app-main {
    padding: 16px;
  }
}
</style>