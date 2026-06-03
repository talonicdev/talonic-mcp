import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_balance`. Shows the workspace credit balance
 * prominently plus tier, 30-day burn, projected runway, and reset date.
 *
 * @internal
 */
export function getBalanceWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var credits = typeof payload.balance_credits === "number" ? payload.balance_credits : null;
    var eur = typeof payload.balance_eur === "number" ? payload.balance_eur : null;
    var runway = payload.projected_runway_days;
    var runwayText = (typeof runway === "number" && runway >= 0) ? (runway + " days") : "n/a";
    var reset = payload.tier_resets_at ? String(payload.tier_resets_at).replace("T", " ").replace(/\\..*/, " UTC") : "—";

    root.innerHTML = ''
      + '<div class="header"><div class="title">Talonic balance</div>'
      + (payload.tier ? '<span class="chip">' + esc(payload.tier) + '</span>' : '') + '</div>'
      + '<div class="big">' + (credits == null ? "—" : credits.toLocaleString()) + ' <span class="muted small">credits</span></div>'
      + (eur == null ? "" : '<div class="muted small">≈ €' + eur.toFixed(2) + '</div>')
      + '<div class="grid">'
      + '  <div class="kv"><span class="k">30-day burn</span><span class="val">' + esc(fmt(payload.burn_rate_30d_credits)) + ' credits</span></div>'
      + '  <div class="kv"><span class="k">Projected runway</span><span class="val">' + runwayText + '</span></div>'
      + '  <div class="kv"><span class="k">Tier</span><span class="val">' + esc(payload.tier || "—") + '</span></div>'
      + '  <div class="kv"><span class="k">Tier resets</span><span class="val">' + esc(reset) + '</span></div>'
      + '</div>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Balance",
  renderBody: RENDER_BODY,
})
