import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_pricing`. Renders the credit pricing catalog:
 * the credits-per-EUR conversion, processing-mode multipliers as chips, and a
 * table of per-unit rates (label, credits, EUR, free badge).
 *
 * @internal
 */
export function getPricingWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var currency = payload.currency || "EUR";
    var perEur = typeof payload.credits_per_eur === "number" ? payload.credits_per_eur : null;
    var units = Array.isArray(payload.units) ? payload.units : [];
    var multipliers = (payload.multipliers && typeof payload.multipliers === "object") ? payload.multipliers : {};

    var multiChips = Object.keys(multipliers).map(function (k) {
      return '<span class="chip">' + esc(k) + ' ' + esc(fmt(multipliers[k])) + '×</span>';
    }).join("");

    var rows = units.map(function (u) {
      var credits = typeof u.credits === "number" ? u.credits : null;
      var eur = typeof u.eur === "number" ? u.eur : null;
      var freeBadge = u.free ? '<span class="chip" style="color:var(--good)">free</span>' : '';
      return '<tr>'
        + '<td>' + esc(u.label || u.unit || "") + (u.label ? ' <span class="mono muted small">' + esc(u.unit || "") + '</span>' : '') + '</td>'
        + '<td class="val">' + (credits == null ? "—" : credits.toLocaleString()) + ' ' + freeBadge + '</td>'
        + '<td class="val muted">' + (eur == null ? "—" : '€' + eur.toFixed(eur < 0.01 ? 4 : 2)) + '</td>'
        + '</tr>';
    }).join("");

    root.innerHTML = ''
      + '<div class="header"><div class="title">Talonic pricing</div>'
      + '<span class="chip">' + esc(currency) + '</span></div>'
      + (perEur == null ? "" : '<div class="muted small">' + perEur.toLocaleString() + ' credits ≈ €1</div>')
      + (multiChips ? '<div style="margin-top:10px">' + multiChips + '</div>' : '')
      + '<table><thead><tr><th>Unit</th><th>Credits</th><th>EUR</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="3" class="empty">No pricing units returned.</td></tr>')
      + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Pricing",
  renderBody: RENDER_BODY,
})
