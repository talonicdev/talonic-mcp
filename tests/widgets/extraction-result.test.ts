import { describe, expect, it } from "vitest"
import {
  EXTRACTION_RESULT_WIDGET_URI,
  EXTRACTION_RESULT_WIDGET_MIME,
} from "../../src/widgets/types"

describe("widget URI constants", () => {
  it("exports the extraction-result widget URI", () => {
    expect(EXTRACTION_RESULT_WIDGET_URI).toBe("ui://widget/extraction-result.html")
  })

  it("exports the Apps SDK widget MIME type", () => {
    expect(EXTRACTION_RESULT_WIDGET_MIME).toBe("text/html;profile=mcp-app")
  })
})
