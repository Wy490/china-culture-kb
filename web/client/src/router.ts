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
      path: '/province/:name',
      name: 'Province',
      component: () => import('./views/Province.vue'),
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