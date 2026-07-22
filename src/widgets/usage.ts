import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_usage`. Shows total credits consumed over the
 * trailing window prominently, then a per-function breakdown table (operation
 * type, operations, credits) with a proportion bar, highest spend first.
 *
 * @internal
 */
export function getUsageWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var days = typeof payload.period_days === "number" ? payload.period_days : null;
    var total = typeof payload.total_credits === "number" ? payload.total_credits : null;
    var funcs = Array.isArray(payload.by_function) ? payload.by_function : [];

    var max = funcs.reduce(function (m, f) {
      return (typeof f.credits === "number" && f.credits > m) ? f.credits : m;
    }, 0);

    var rows = funcs.map(function (f) {
      var credits = typeof f.credits === "number" ? f.credits : 0;
      var pct = max > 0 ? Math.round((credits / max) * 100) : 0;
      return '<tr>'
        + '<td>' + esc(f.operation_type || "—") + '</td>'
        + '<td class="val muted">' + esc(fmt(f.operations)) + '</td>'
        + '<td class="val">' + credits.toLocaleString()
        + ' <span class="bar"><span style="width:' + pct + '%"></span></span></td>'
        + '</tr>';
    }).join("");

    root.innerHTML = ''
      + '<div class="header"><div class="title">Credit usage</div>'
      + (days == null ? "" : '<span class="chip">last ' + esc(days) + ' days</span>') + '</div>'
      + '<div class="big">' + (total == null ? "—" : total.toLocaleString()) + ' <span class="muted small">credits</span></div>'
      + '<table><thead><tr><th>Function</th><th>Operations</th><th>Credits</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="3" class="empty">No credit usage in this window yet.</td></tr>')
      + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Usage",
  renderBody: RENDER_BODY,
})
