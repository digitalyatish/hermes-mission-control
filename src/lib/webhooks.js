import { supabase } from './supabase'

// ── Webhooks ──
export const getWebhooks = () =>
  supabase.from('webhooks').select('*').order('created_at', { ascending: false })

export const getWebhook = (id) =>
  supabase.from('webhooks').select('*').eq('id', id).single()

export const updateWebhookStatus = (id, status) =>
  supabase.from('webhooks').update({ status }).eq('id', id)

export const deleteWebhook = (id) =>
  supabase.from('webhooks').delete().eq('id', id)

// ── Webhook Events ──
export const getWebhookEvents = (webhookId, limit = 50) =>
  supabase
    .from('webhook_events')
    .select('*')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(limit)

// ── Webhook Functions ──
export const getWebhookFunctions = (webhookId) =>
  supabase
    .from('webhook_functions')
    .select('*')
    .eq('webhook_id', webhookId)
    .order('execution_order')

export async function createFunction(webhookId, data) {
  // Get next execution_order
  const { data: existing } = await supabase
    .from('webhook_functions')
    .select('execution_order')
    .eq('webhook_id', webhookId)
    .order('execution_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.execution_order ?? -1) + 1

  return supabase
    .from('webhook_functions')
    .insert({ webhook_id: webhookId, ...data, execution_order: nextOrder })
    .select()
    .single()
}

export const updateFunction = (id, data) =>
  supabase.from('webhook_functions').update(data).eq('id', id)

export const deleteFunction = (id) =>
  supabase.from('webhook_functions').delete().eq('id', id)

export async function reorderFunctions(webhookId, orderedIds) {
  const updates = orderedIds.map((id, index) =>
    supabase.from('webhook_functions').update({ execution_order: index }).eq('id', id)
  )
  await Promise.all(updates)
}

// ── Aggregate Stats ──
export async function getWebhookStats() {
  const { data: webhooks } = await getWebhooks()
  if (!webhooks) return { total: 0, active: 0, totalEvents: 0, totalFunctions: 0 }

  const active = webhooks.filter(w => w.status === 'active').length
  const totalEvents = webhooks.reduce((sum, w) => sum + (w.event_count || 0), 0)

  const { count } = await supabase
    .from('webhook_functions')
    .select('*', { count: 'exact', head: true })

  return {
    total: webhooks.length,
    active,
    totalEvents,
    totalFunctions: count || 0,
  }
}
