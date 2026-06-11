<template>
  <section :class="['gears-webhook-status', `gears-webhook-status--${view.status}`]">
    <div>
      <span class="gears-webhook-status__label">GEARS Webhook</span>
      <strong class="gears-webhook-status__title">{{ view.title }}</strong>
    </div>
    <p class="gears-webhook-status__desc">{{ view.description }}</p>
    <p v-if="status?.webhook_target" class="gears-webhook-status__meta">
      目标: <code>{{ status.webhook_target }}</code>
    </p>
    <p v-if="status?.last_error" class="gears-webhook-status__error">
      最近失败原因：{{ status.last_error }}
    </p>
    <p v-if="status?.attempts || view.timeLabel" class="gears-webhook-status__meta">
      <span v-if="status?.attempts">尝试 {{ status.attempts }} 次</span>
      <span v-if="status?.attempts && view.timeLabel"> · </span>
      <span v-if="view.timeLabel">{{ view.timeLabel }}</span>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GearsWebhookDeliveryStatus, GearsWebhookStatus } from '@shared/types'

const props = defineProps<{
  status?: GearsWebhookStatus | null
}>()

const view = computed(() => {
  const status = props.status?.status ?? 'unknown'
  if (status === 'not_configured') {
    return {
      status,
      title: '未配置',
      description: '当前未设置 GEARS_WEBHOOK_URL，可继续使用拉取配置手动交付。',
      timeLabel: formatStatusTime(props.status),
    }
  }
  if (status === 'pending') {
    return {
      status,
      title: '等待发送',
      description: '故事已生成，后台正在准备通知 GEARS。',
      timeLabel: formatStatusTime(props.status),
    }
  }
  if (status === 'sent') {
    return {
      status,
      title: '已发送',
      description: 'story_ready 通知已发送到 GEARS webhook。',
      timeLabel: formatStatusTime(props.status),
    }
  }
  if (status === 'failed') {
    return {
      status,
      title: '发送失败',
      description: '自动推送没有成功，GEARS 仍可使用拉取配置手动获取素材。',
      timeLabel: formatStatusTime(props.status),
    }
  }
  return {
    status: 'unknown' as GearsWebhookDeliveryStatus | 'unknown',
    title: '未记录',
    description: '旧故事可能没有 webhook 状态记录。',
    timeLabel: '',
  }
})

function formatStatusTime(status?: GearsWebhookStatus | null): string {
  const iso = status?.last_success_at ?? status?.last_error_at ?? status?.last_attempt_at
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const label = status?.last_success_at ? '最近成功' : status?.last_error_at ? '最近失败' : '最近尝试'
  return `${label}：${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.gears-webhook-status {
  margin: 12px 0 0;
  padding: 12px 14px;
  border: 1px solid #d8e1e8;
  border-left-width: 4px;
  border-radius: 6px;
  background: #f8fafb;
  color: #2c3e50;
}

.gears-webhook-status--sent {
  border-left-color: #27ae60;
  background: #f3fbf6;
}

.gears-webhook-status--failed {
  border-left-color: #c0392b;
  background: #fff7f6;
}

.gears-webhook-status--pending {
  border-left-color: #2980b9;
  background: #f5faff;
}

.gears-webhook-status--not_configured,
.gears-webhook-status--unknown {
  border-left-color: #95a5a6;
}

.gears-webhook-status__label {
  display: block;
  margin-bottom: 3px;
  color: #7f8c8d;
  font-size: 12px;
  font-weight: 700;
}

.gears-webhook-status__title {
  color: #2c3e50;
  font-size: 15px;
}

.gears-webhook-status__desc,
.gears-webhook-status__meta,
.gears-webhook-status__error {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.gears-webhook-status__meta {
  color: #60717d;
  overflow-wrap: anywhere;
}

.gears-webhook-status__error {
  color: #a93226;
}

.gears-webhook-status code {
  font-size: 12px;
}
</style>
