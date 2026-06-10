import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('./views/Home.vue'),
    },
    {
      path: '/search',
      name: 'Search',
      component: () => import('./views/Search.vue'),
    },
    {
      path: '/projects',
      name: 'Projects',
      component: () => import('./views/Projects.vue'),
    },
    {
      path: '/supplement-tasks',
      name: 'SupplementTasks',
      component: () => import('./views/SupplementTasks.vue'),
    },
    {
      path: '/projects/:projectId',
      name: 'ProjectDetail',
      component: () => import('./views/ProjectDetail.vue'),
    },
    {
      path: '/knowledge',
      name: 'Knowledge',
      component: () => import('./views/Knowledge.vue'),
    },
    {
      path: '/knowledge/:province',
      name: 'KnowledgeProvince',
      component: () => import('./views/Knowledge.vue'),
    },
    {
      path: '/province/:name',
      name: 'Province',
      redirect: to => ({
        name: 'KnowledgeProvince',
        params: { province: to.params.name },
      }),
    },
    {
      path: '/entry',
      name: 'Entry',
      component: () => import('./views/Entry.vue'),
    },
    {
      path: '/story/new',
      name: 'StoryStudio',
      component: () => import('./views/StoryStudio.vue'),
    },
    {
      path: '/story/:storyId',
      name: 'StoryDetail',
      component: () => import('./views/StoryDetail.vue'),
    },
  ],
})
