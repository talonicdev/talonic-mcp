/**
 * JS shared by the Agent-task widgets (list, card, lease, submitted). It is
 * prepended to each widget's `RENDER_BODY`, so these functions are defined
 * inside `render(payload)` and see the shared helpers (`chip`, `idChip`,
 * `relTime`, `kvTiles`, `jsonTree`, `isFlat`, `esc`, `clamp`).
 *
 * - `statusTone(status)`: chip tone for a task status.
 * - `taskTiming(p)`: the six-tile grid (document, pipeline, phase, epoch, lease, timeout). Note the literal space between the `.k` and `.val` spans — flex ignores it visually, but it keeps `textContent` readable ("Execution epoch 4"), which the render tests assert.
 * - `taskSections(p)`: instructions, output contract table, input snapshot, timeout fallthrough.
 *
 * @internal
 */
export const TASK_JS = `
    function statusTone(s) {
      return s === "available" ? "info" : s === "claimed" || s === "submitted" ? "good" : s === "timed_out" ? "bad" : s === "cancelled" ? "warn" : "";
    }
    function taskTiming(p) {
      return '<div class="grid">'
        + '<div class="kv"><span class="k">Document</span> <span class="val">' + idChip(p.document_id) + '</span></div>'
        + '<div class="kv"><span class="k">Pipeline</span> <span class="val">' + idChip(p.pipeline_id) + '</span></div>'
        + '<div class="kv"><span class="k">Phase</span> <span class="val">' + esc(p.phase_index != null ? p.phase_index : "—") + '</span></div>'
        + '<div class="kv"><span class="k">Execution epoch</span> <span class="val">' + esc(p.execution_epoch != null ? p.execution_epoch : "—") + '</span></div>'
        + '<div class="kv"><span class="k">Lease expires</span> <span class="val">' + esc(p.lease_expires_at ? relTime(p.lease_expires_at) : "—") + '</span></div>'
        + '<div class="kv"><span class="k">Times out</span> <span class="val">' + esc(p.timeout_at ? relTime(p.timeout_at) : "—") + '</span></div>'
        + '</div>';
    }
    function taskSections(p) {
      var html = "";
      if (typeof p.instructions === "string" && p.instructions) {
        html += '<div class="plane"><div class="subtitle">Instructions</div><div class="small" style="white-space:pre-wrap">' + esc(clamp(p.instructions, 1200)) + '</div></div>';
      }
      if (Array.isArray(p.output_contract) && p.output_contract.length) {
        html += '<div class="plane"><div class="subtitle">Output contract (' + p.output_contract.length + ')</div>'
          + '<table><thead><tr><th>Field</th><th>Type</th><th>Required</th></tr></thead><tbody>'
          + p.output_contract.map(function (f) {
              f = f && typeof f === "object" ? f : {};
              return '<tr><td class="val mono">' + esc(f.key || "") + '</td><td>' + chip(f.dataType, "") + '</td><td>'
                + (f.required ? chip("required", "warn") : '<span class="muted small">optional</span>') + '</td></tr>';
            }).join("")
          + '</tbody></table></div>';
      }
      var snap = p.input_snapshot;
      if (snap && typeof snap === "object" && !Array.isArray(snap) && Object.keys(snap).length) {
        html += '<div class="plane"><div class="subtitle">Input snapshot</div>' + (isFlat(snap) ? kvTiles(snap) : jsonTree(snap)) + '</div>';
      }
      if (p.timeout_fallthrough) {
        html += '<div class="muted small" style="margin-top:10px">On timeout: ' + esc(String(p.timeout_fallthrough).replace(/_/g, " ")) + '</div>';
      }
      return html;
    }
`
