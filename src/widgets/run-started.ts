import { buildWidgetHtml } from "./shared.js"

/** Confirmation card for `talonic_run_spec`. @internal */
export function getRunStartedWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    if (!payload || typeof payload !== "object" || (!payload.pipeline_id && !payload.run_id)) { empty("No run was started."); return; }
    function kb(n) { return typeof n === "number" ? (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB") : "—"; }
    var kind = payload.run_kind === "run" ? "run" : "pipeline";
    var docs = Array.isArray(payload.documents) ? payload.documents : [];
    var pollArg = kind === "pipeline" && payload.pipeline_id ? "pipeline_id " + shortId(payload.pipeline_id) : "run_id " + shortId(payload.run_id);
    var docHtml = docs.length ? '<div class="plane"><div class="subtitle">Documents (' + docs.length + ')</div><table><thead><tr><th>File</th><th>Size</th><th></th></tr></thead><tbody>'
      + docs.slice(0, 20).map(function (d) { d = d && typeof d === "object" ? d : {}; return '<tr><td class="val">' + esc(d.filename || shortId(d.document_id)) + '</td><td class="val">' + esc(kb(d.size_bytes)) + '</td><td>' + (d.deduplicated ? chip("deduplicated", "info") : "") + '</td></tr>'; }).join("")
      + '</tbody></table>' + (docs.length > 20 ? '<div class="muted small">+' + (docs.length - 20) + ' more</div>' : "") + '</div>' : "";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + (payload.appended ? "Documents appended" : "Run started") + '</div><div class="subtitle">' + esc(payload.spec_name || shortId(payload.spec_id)) + '</div></div>'
      + '<div>' + chip(kind, "info") + chip(payload.status, payload.status === "failed" ? "bad" : payload.status === "completed" ? "good" : "") + '</div></div>'
      + '<div class="big">' + esc(typeof payload.input_count === "number" ? payload.input_count : docs.length || "—") + ' <span class="muted small">documents</span></div>'
      + '<div class="grid">'
      + '<div class="kv"><span class="k">Spec</span> <span class="val">' + idChip(payload.spec_id) + '</span></div>'
      + '<div class="kv"><span class="k">Pipeline</span> <span class="val">' + idChip(payload.pipeline_id) + '</span></div>'
      + '<div class="kv"><span class="k">Run</span> <span class="val">' + idChip(payload.run_id) + '</span></div>'
      + '<div class="kv"><span class="k">Enqueued</span> <span class="val">' + esc(payload.enqueued_documents != null ? payload.enqueued_documents : "—") + '</span></div>'
      + '</div>'
      + (payload.message ? '<div class="muted small" style="margin-top:8px">' + esc(payload.message) + '</div>' : "")
      + '<div class="small" style="margin-top:8px">Poll with talonic_get_run (' + esc(pollArg) + ') every 5–10 s, then talonic_get_run_results.</div>'
      + docHtml;
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Run Started", renderBody: RENDER_BODY })
