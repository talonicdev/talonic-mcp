import { describe, expect, it, vi } from "vitest"
import { Talonic, TalonicAuthError } from "@talonic/node"
import { handleListSchemas } from "../../src/tools/list-schemas"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function makeTalonic(responseBody: unknown, status = 200): Talonic {
  const fetchFn = vi.fn().mockResolvedValue(jsonResponse(responseBody, status))
  return new Talonic({
    apiKey: "tlnc_test",
    fetch: fetchFn as unknown as typeof fetch,
    maxRetries: 0,
  })
}

describe("talonic_list_schemas handler", () => {
  it("returns schemas as a single JSON text item on success", async () => {
    const talonic = makeTalonic({
      data: [
        { id: "sch_1", name: "Invoice", version: 2, definition: {} },
        { id: "sch_2", name: "Contract", version: 1 },
      ],
      pagination: { total: 2, limit: 20, has_more: false, next_cursor: null },
    })

    const result = await handleListSchemas(talonic)

    expect("isError" in result).toBe(false)
    expect(result.content).toHaveLength(1)
    expect(result.content[0]?.type).toBe("text")
    const parsed = JSON.parse(result.content[0]?.text ?? "") as {
      data: Array<{ id: string; name: string }>
    }
    expect(parsed.data).toHaveLength(2)
    expect(parsed.data[0]?.id).toBe("sch_1")
    expect(parsed.data[1]?.name).toBe("Contract")
  })

  it("returns an isError result on auth failure with code/status/request_id", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          statusCode: 401,
          code: "AUTH_REQUIRED",
          error: "Unauthorized",
          message: "Invalid API key",
          request_id: "req_xyz",
        },
        401,
      ),
    )
    const talonic = new Talonic({
      apiKey: "tlnc_bad",
      fetch: fetchFn as unknown as typeof fetch,
      maxRetries: 0,
    })

    const result = await handleListSchemas(talonic)

    expect("isError" in result).toBe(true)
    expect((result as { isError: boolean }).isError).toBe(true)
    const text = result.content[0]?.text ?? ""
    expect(text).toContain("AUTH_REQUIRED")
    expect(text).toContain("Invalid API key")
    expect(text).toContain("status: 401")
    expect(text).toContain("request_id: req_xyz")
  })

  it("uses TalonicAuthError instanceof correctly (regression)", async () => {
    // Ensures that the SDK error wrapper actually arrives as a
    // TalonicError subclass at the tool boundary.
    const fetchFn = vi.fn().mockRejectedValue(
      new TalonicAuthError({
        code: "unauthorized",
        message: "no",
        status: 401,
        retryable: false,
      }),
    )
    const talonic = new Talonic({
      apiKey: "k",
      fetch: fetchFn as unknown as typeof fetch,
      maxRetries: 0,
    })
    const result = await handleListSchemas(talonic)
    expect((result as { isError?: boolean }).isError).toBe(true)
  })
})
