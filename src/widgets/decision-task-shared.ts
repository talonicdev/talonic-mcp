/**
 * JS shared by the decision-task widgets; prepended to each RENDER_BODY so it
 * runs inside render(payload) with the shared helpers in scope.
 * - decisionTone(status): chip tone incl. released / failed.
 * - decisionMeta(p): the metadata tile grid (run, app, epoch, claimant, lease, SLA).
 * @internal
 */
export const DECISION_JS = `
    function decisionTone(s) {
      return s === "available" ? "info" : s === "claimed" || s === "submitted" ? "good" : s === "failed" || s === "timed_out" ? "bad" : s === "released" || s === "cancelled" ? "warn" : "";
    }
    function decisionMeta(p) {
      return '<div class="grid">'
        + '<div class="kv"><span class="k">Run</span> <span class="val">' + idChip(p.run_id) + '</span></div>'
        + '<div class="kv"><span class="k">App</span> <span class="val">' + idChip(p.app_id) + '</span></div>'
        + '<div class="kv"><span class="k">Execution epoch</span> <span class="val">' + esc(p.execution_epoch != null ? p.execution_epoch : "—") + '</span></div>'
        + '<div class="kv"><span class="k">Claimed by</span> <span class="val">' + esc(p.claimed_by || "—") + '</span></div>'
        + '<div class="kv"><span class="k">Lease expires</span> <span class="val">' + esc(p.lease_expires_at ? relTime(p.lease_expires_at) : "—") + '</span></div>'
        + '<div class="kv"><span class="k">SLA deadline</span> <span class="val">' + esc(p.sla_deadline_at ? relTime(p.sla_deadline_at) : "—") + '</span></div>'
        + '</div>';
    }
`
