# Security Policy

Thank you for taking the time to investigate and report security issues responsibly. This policy describes how to disclose vulnerabilities in the Talonic MCP server (`@talonic/mcp`) and the hosted endpoint at `https://mcp.talonic.com`.

## Reporting a vulnerability

Email **security@talonic.ai** with:

- A clear description of the issue.
- Step-by-step reproduction details (URL, request, payload, expected vs. actual behaviour).
- An assessment of the impact (data exposure, privilege escalation, denial of service, etc.) and any conditions required to trigger it.
- Your name or handle if you would like to be credited in the fix announcement.

Please do not file a public GitHub issue for a security vulnerability. Public issues will be redirected to this private channel and the underlying report may be removed.

## Response timeline

- We acknowledge new reports within **two business days** of receipt.
- We provide a substantive response (triage outcome, expected fix window, request for more information) within **ten business days**.
- For confirmed issues that affect production, we aim to ship a fix or a documented mitigation within **30 days** of confirmation, faster for higher-severity issues.

## Scope

In scope:

- `@talonic/mcp` source on GitHub at `https://github.com/talonicdev/talonic-mcp`.
- The hosted MCP endpoint at `https://mcp.talonic.com/mcp`, including the `/health`, `/.well-known/oauth-protected-resource`, and `/` discovery endpoints.
- The OAuth 2.1 connector flow that runs against `https://app.talonic.com` and issues bearer tokens for the MCP server.
- The `@talonic/node` SDK used internally by the MCP server.

Out of scope:

- The Talonic web dashboard at `https://app.talonic.com` and the Talonic API at `https://api.talonic.com`. Report issues affecting those surfaces to **security@talonic.ai** as well; this policy applies to all Talonic infrastructure.
- Findings that require physical access to a user's device, social-engineering attacks against Talonic staff, or attacks that violate applicable law.
- Denial-of-service attacks that depend on overwhelming volumes of traffic rather than a specific vulnerability.
- Reports about missing security best practices (rate-limit headers, HSTS preloading, etc.) without a concrete exploit path. We welcome these as feedback but do not treat them as vulnerabilities.

## Safe harbour

We will not pursue legal action against researchers who:

- Make a good-faith effort to follow this policy.
- Do not access or modify other users' data beyond the minimum required to demonstrate the issue.
- Do not exploit the issue beyond the proof-of-concept needed to report it.
- Give us a reasonable opportunity to investigate and fix before any public disclosure.

If you are unsure whether a particular activity falls within this safe harbour, email **security@talonic.ai** in advance and we will work with you.

## Coordinated disclosure

We follow a coordinated-disclosure model. Once a fix is shipped, we will (with your permission) publish a brief advisory acknowledging the report and crediting the researcher. We ask that researchers refrain from public disclosure until the fix is live, typically no more than 90 days after the initial report.

## Contact

- Primary: **security@talonic.ai**
- Fallback (non-security): info@talonic.ai
- Public issues (non-security only): https://github.com/talonicdev/talonic-mcp/issues
