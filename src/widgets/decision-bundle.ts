import { DECISION_JS } from "./decision-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/** Claim bundle card for `talonic_claim_decision_task`. @internal */
export function getDecisionBundleWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY =
  DECISION_JS +
  `
    var task = payload && payload.task && typeof payload.task === "object" ? payload.task : null;
    if (!task || !task.id) { empty("No decision task was claimed."); return; }
    var contract = payload.output_contract;
    var precedents = Array.isArray(payload.precedents) ? payload.precedents : [];
    var pkg = payload.package && typeof payload.package === "object" ? payload.package : {};
    var docs = Array.isArray(pkg.documents) ? pkg.documents : [];
    var contractHtml = contract && typeof contract === "object" ? (isFlat(contract) ? kvTiles(contract) : jsonTree(contract)) : '<div class="muted small">No output contract on this task.</div>';
    var precHtml = precedents.length ? '<div class="plane"><div class="subtitle">Precedents (' + precedents.length + ')</div>' + precedents.slice(0, 5).map(function (p) {
      p = p && typeof p === "object" ? p : {};
      return '<div class="kv"><span class="val mono">' + esc(clamp(fmt(p.outcome), 100)) + '</span><span class="muted small">' + esc(clamp(p.rationale || "", 160)) + (p.task_id ? ' · task ' + esc(shortId(p.task_id)) : "") + '</span></div>';
    }).join("") + '</div>' : "";
    var docHtml = docs.length ? '<div class="plane"><div class="subtitle">Source documents (' + docs.length + ')</div>' + docs.slice(0, 20).map(function (d) { d = d && typeof d === "object" ? d : {}; return chip(d.filename || shortId(d.document_id), ""); }).join("") + '</div>' : "";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Decision task claimed</div><div class="subtitle">task ' + idChip(task.id) + '</div></div><div>' + chip(task.status, decisionTone(task.status)) + '</div></div>'
      + '<div class="big">' + esc(task.execution_epoch != null ? task.execution_epoch : "—") + ' <span class="muted small">execution epoch</span></div>'
      + '<div class="muted small">Keep this epoch for heartbeat, submit, release or fail.' + (task.lease_expires_at ? ' Lease expires ' + esc(relTime(task.lease_expires_at)) + '.' : "") + '</div>'
      + decisionMeta(task)
      + '<div class="plane"><div class="subtitle">Output contract</div>' + contractHtml + '</div>'
      + '<div class="plane"><div class="subtitle">Input package</div><div class="grid">'
      + '<div class="kv"><span class="k">Kind</span> <span class="val">' + esc(pkg.package_kind || "—") + '</span></div>'
      + '<div class="kv"><span class="k">Records</span> <span class="val">' + esc(pkg.record_count != null ? pkg.record_count : "—") + '</span></div>'
      + '<div class="kv"><span class="k">Page size</span> <span class="val">' + esc(pkg.page_size != null ? pkg.page_size : "—") + '</span></div>'
      + '<div class="kv"><span class="k">First cursor</span> <span class="val mono">' + esc(pkg.first_cursor ? clamp(pkg.first_cursor, 24) : "—") + '</span></div>'
      + '</div>' + (pkg.first_cursor ? '<div class="small" style="margin-top:6px">Read the records with talonic_read_decision_package starting at first_cursor.</div>' : "") + '</div>'
      + precHtml + docHtml;
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Decision Task Claimed",
  renderBody: RENDER_BODY,
})
