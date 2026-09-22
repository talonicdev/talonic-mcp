import { TASK_JS } from "./agent-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_agent_task`: one Agent-stage task — status,
 * timing tiles, instructions, the declared output contract and the immutable
 * input snapshot.
 *
 * @internal
 */
export function getAgentTaskWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY =
  TASK_JS +
  `
    if (!payload || typeof payload !== "object" || !payload.id) { empty("No agent task."); return; }
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Agent task ' + idChip(payload.id) + '</div>'
      + '<div class="subtitle">' + esc(payload.created_at ? "created " + relTime(payload.created_at) : "") + '</div></div>'
      + '<div>' + chip(payload.status, statusTone(payload.status)) + '</div></div>'
      + taskTiming(payload) + taskSections(payload);
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Agent Task",
  renderBody: RENDER_BODY,
})
