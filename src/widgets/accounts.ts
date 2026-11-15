import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_accounts`: the companies the workspace keeps
 * apart, one row each with its aliases.
 *
 * @internal
 */
export function getAccountListWidgetHtml(): string {
  return LIST_HTML
}

/**
 * Inline card for `talonic_create_account`: the account just created.
 *
 * @internal
 */
export function getAccountCreatedWidgetHtml(): string {
  return CREATED_HTML
}

const LIST_HTML = buildWidgetHtml({
  title: "Talonic — Accounts",
  renderBody: `
    var rows = Array.isArray(payload.data) ? payload.data : [];
    root.innerHTML = ''
      + '<div class="header"><div class="title">Accounts</div><span class="chip">' + rows.length + '</span></div>'
      + (rows.length === 0
        ? '<div class="muted small">No accounts yet. Create one with talonic_create_account.</div>'
        : rows.map(function (a) {
            var aliases = Array.isArray(a.aliases) && a.aliases.length ? a.aliases.join(", ") : "";
            return '<div class="kv"><span class="k">' + esc(a.name || "—") + '</span><span class="val muted small">' + esc(aliases) + '</span></div>';
          }).join(""));
`,
})

const CREATED_HTML = buildWidgetHtml({
  title: "Talonic — Account created",
  renderBody: `
    var aliases = Array.isArray(payload.aliases) && payload.aliases.length ? payload.aliases.join(", ") : "—";
    root.innerHTML = ''
      + '<div class="header"><div class="title">Account created</div></div>'
      + '<div class="big">' + esc(payload.name || "—") + '</div>'
      + '<div class="grid"><div class="kv"><span class="k">Also known as</span><span class="val">' + esc(aliases) + '</span></div></div>';
`,
})
