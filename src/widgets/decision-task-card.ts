import { DECISION_JS } from "./decision-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/**
 * Metadata card shared by the four decision-task mutations: heartbeat ("Lease
 * extended"), submit ("Decision submitted"), release ("Task released") and
 * fail ("Task failed"). The payload is the platform's task metadata.
 * @internal
 */
export function getDecisionHeartbeatWidgetHtml(): string {
  return HEARTBEAT_HTML
}
/** @internal */
export function getDecisionSubmittedWidgetHtml(): string {
  return SUBMITTED_HTML
}
/** @internal */
export function getDecisionReleasedWidgetHtml(): string {
  return RELEASED_HTML
}
/** @internal */
export function getDecisionFailedWidgetHtml(): string {
  return FAILED_HTML
}

const CARD_BODY = `
    if (!payload || typeof payload !== "object" || !payload.id) { empty("No decision task."); return; }
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + HEADLINE + '</div><div class="subtitle">task ' + idChip(payload.id) + (payload.submitted_at ? ' · ' + esc(relTime(payload.submitted_at)) : "") + '</div></div>'
      + '<div>' + chip(payload.status, decisionTone(payload.status)) + '</div></div>'
      + '<div class="small">' + NOTE + '</div>'
      + decisionMeta(payload);
`

function card(headline: string, note: string, title: string): string {
  return buildWidgetHtml({
    title,
    renderBody:
      DECISION_JS +
      "    var HEADLINE = " +
      JSON.stringify(headline) +
      ";\n" +
      "    var NOTE = " +
      JSON.stringify(note) +
      ";\n" +
      CARD_BODY,
  })
}

const HEARTBEAT_HTML = card(
  "Lease extended",
  "Keep heartbeating before the lease expires; the SLA deadline is the hard stop.",
  "Talonic — Decision Task Lease",
)
const SUBMITTED_HTML = card(
  "Decision submitted",
  "The platform verified the decision and resumes the run.",
  "Talonic — Decision Submitted",
)
const RELEASED_HTML = card(
  "Task released",
  "The task is available again for another claimant; the next claim bumps the epoch.",
  "Talonic — Decision Task Released",
)
const FAILED_HTML = card(
  "Task failed",
  "A Human Review was raised with your reason and the app's fallback policy applies.",
  "Talonic — Decision Task Failed",
)
