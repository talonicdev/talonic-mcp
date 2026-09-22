import { TASK_JS } from "./agent-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/**
 * Lease card shared by `talonic_claim_agent_task` ("Task claimed") and
 * `talonic_heartbeat_agent_task` ("Lease extended"): the execution epoch to
 * keep, lease expiry, timing tiles, and — when the payload carries them (the
 * claim route returns the full task) — instructions, output contract and
 * input snapshot.
 *
 * @internal
 */
export function getAgentTaskClaimWidgetHtml(): string {
  return CLAIM_HTML
}

/** @internal */
export function getAgentTaskHeartbeatWidgetHtml(): string {
  return HEARTBEAT_HTML
}

const LEASE_BODY = `
    if (!payload || typeof payload !== "object" || !payload.id) { empty("No lease information."); return; }
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + HEADLINE + '</div><div class="subtitle">Task ' + idChip(payload.id) + '</div></div>'
      + '<div>' + chip(payload.status, statusTone(payload.status)) + '</div></div>'
      + '<div class="big">' + esc(payload.execution_epoch != null ? payload.execution_epoch : "—") + ' <span class="muted small">execution epoch</span></div>'
      + '<div class="muted small">Keep this epoch for heartbeat and submit.' + (payload.lease_expires_at ? ' Lease expires ' + esc(relTime(payload.lease_expires_at)) + '.' : "") + '</div>'
      + taskTiming(payload) + taskSections(payload);
`

function leaseWidget(headline: string, title: string): string {
  return buildWidgetHtml({
    title,
    renderBody: TASK_JS + "    var HEADLINE = " + JSON.stringify(headline) + ";\n" + LEASE_BODY,
  })
}

const CLAIM_HTML = leaseWidget("Task claimed", "Talonic — Agent Task Claimed")
const HEARTBEAT_HTML = leaseWidget("Lease extended", "Talonic — Agent Task Lease")
