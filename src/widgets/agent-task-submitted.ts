import { TASK_JS } from "./agent-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline confirmation for `talonic_submit_agent_task`: the declared outputs
 * were accepted and the parked document resumed its pipeline.
 *
 * @internal
 */
export function getAgentTaskSubmittedWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY =
  TASK_JS +
  `
    if (!payload || typeof payload !== "object" || !payload.id) { empty("No submission recorded."); return; }
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Outputs submitted</div><div class="subtitle">Task ' + idChip(payload.id)
      + (payload.submitted_at ? ' · ' + esc(relTime(payload.submitted_at)) : "") + '</div></div>'
      + '<div>' + chip(payload.status, statusTone(payload.status)) + '</div></div>'
      + '<div class="small">The parked document resumes its pipeline from this stage.</div>'
      + taskTiming(payload);
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Agent Task Submitted",
  renderBody: RENDER_BODY,
})
