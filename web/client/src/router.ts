import { createRouter, createWebHistory } from 'vue-router'
import { PRODUCT_SECONDARY_NAVIGATION, canAccessProductNavigationItem } from '@shared/product-navigation'
import {
  currentProductNavigationAccess,
  productAccessLifecycleState,
  synchronizeProductAccessContext,
} from './product-access'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('./views/Home.vue'),
    },
    {
      path: '/access-denied',
      name: 'AccessDenied',
      component: () => import('./views/AccessDenied.vue'),
    },
    {
      path: '/access-required',
      name: 'AccessRequired',
      component: () => import('./views/AccessRequired.vue'),
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
      path: '/knowledge-writeback-queue',
      name: 'KnowledgeWritebackQueue',
      component: () => import('./views/KnowledgeWritebackQueue.vue'),
    },
    {
      path: '/domain-pack-expansion-queue',
      name: 'DomainPackExpansionQueue',
      component: () => import('./views/DomainPackExpansionQueue.vue'),
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
      path: '/workspace/production',
      name: 'ProductionWorkspace',
      component: () => import('./views/WorkspaceHub.vue'),
      meta: { workspace: 'production' },
    },
    {
      path: '/workspace/review',
      name: 'ReviewWorkspace',
      component: () => import('./views/WorkspaceHub.vue'),
      meta: { workspace: 'review' },
    },
    {
      path: '/story/stage6-revisions',
      name: 'Stage6RevisionWorkspace',
      component: () => import('./views/Stage6RevisionWorkspace.vue'),
    },
    {
      path: '/story/stage6-intake',
      name: 'Stage6OperatorIntake',
      component: () => import('./views/Stage6OperatorIntake.vue'),
    },
    {
      path: '/story/stage6-preflight',
      name: 'Stage6RevisionPreflight',
      component: () => import('./views/Stage6RevisionPreflight.vue'),
    },
    {
      path: '/story/stage6-exit-audit',
      name: 'Stage6ExitAudit',
      component: () => import('./views/Stage6ExitAudit.vue'),
    },
    {
      path: '/story/stage6-package-inspector',
      name: 'Stage6ProfessionalPackageInspector',
      component: () => import('./views/Stage6ProfessionalPackageInspector.vue'),
    },
    {
      path: '/story/stage6-operations',
      name: 'Stage6OperatorControlTower',
      component: () => import('./views/Stage6OperatorControlTower.vue'),
    },
    {
      path: '/story/stage6-table-read-inspector',
      name: 'Stage6TableReadEvidenceInspector',
      component: () => import('./views/Stage6TableReadEvidenceInspector.vue'),
    },
    {
      path: '/story/stage6-exit-review-signature',
      name: 'Stage6ExitReviewSignatureInspector',
      component: () => import('./views/Stage6ExitReviewSignatureInspector.vue'),
    },
    {
      path: '/story/stage7-golden-card-review',
      name: 'Stage7GoldenCardReviewIntake',
      component: () => import('./views/Stage7GoldenCardReviewIntake.vue'),
    },
    {
      path: '/story/stage7-golden-card-expansion',
      name: 'Stage7GoldenCardCandidateExpansion',
      component: () => import('./views/Stage7GoldenCardCandidateExpansion.vue'),
    },
    {
      path: '/story/stage7-golden-card-signature',
      name: 'Stage7GoldenCardReviewSignature',
      component: () => import('./views/Stage7GoldenCardReviewSignature.vue'),
    },
    {
      path: '/story/stage7-operations',
      name: 'Stage7MaterialOperations',
      component: () => import('./views/Stage7MaterialOperations.vue'),
    },
    {
      path: '/story/stage8-blind-review-intake',
      name: 'Stage8BlindReviewIntake',
      component: () => import('./views/Stage8BlindReviewIntake.vue'),
    },
    {
      path: '/story/stage8-blind-review-signature',
      name: 'Stage8BlindReviewSignature',
      component: () => import('./views/Stage8BlindReviewSignature.vue'),
    },
    {
      path: '/story/stage8-finalization-preflight',
      name: 'Stage8FinalizationPreflight',
      component: () => import('./views/Stage8FinalizationPreflight.vue'),
    },
    {
      path: '/story/stage8-durable-release-import',
      name: 'Stage8DurableReleaseImport',
      component: () => import('./views/Stage8DurableReleaseImport.vue'),
    },
    {
      path: '/story/stage8-operations',
      name: 'Stage8Operations',
      component: () => import('./views/Stage8Operations.vue'),
    },
    {
      path: '/ai-comic-series/new',
      name: 'AiComicSeriesStudio',
      component: () => import('./views/AiComicSeriesStudio.vue'),
    },
    {
      path: '/story/:storyId',
      name: 'StoryDetail',
      component: () => import('./views/StoryDetail.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.name === 'AccessRequired') return true
  await synchronizeProductAccessContext()
  if (productAccessLifecycleState.value === 'unauthenticated') {
    return {
      name: 'AccessRequired',
      query: { return_to: to.fullPath },
    }
  }
  if (to.name === 'AccessDenied') return true
  const controlledItems = PRODUCT_SECONDARY_NAVIGATION.filter(item => item.to === to.path)
  if (controlledItems.length === 0) return true
  const access = currentProductNavigationAccess()
  if (controlledItems.some(item => canAccessProductNavigationItem(item, access))) return true
  return {
    name: 'AccessDenied',
    query: { target: to.fullPath },
  }
})
