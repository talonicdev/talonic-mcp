import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  jsonSchemaToZodShape,
  MAX_DEPTH,
  MAX_PROPERTIES,
  MAX_SCHEMA_BYTES,
} from "../../src/tools/json-schema-to-zod"

function parseWith(shape: Record<string, z.ZodType>, value: unknown) {
  return z.object(shape).safeParse(value)
}

describe("jsonSchemaToZodShape", () => {
  it("converts objects with required/optional, enum, and typed scalars", () => {
    const { shape, fellBack } = jsonSchemaToZodShape({
      type: "object",
      properties: {
        decision: { enum: ["approve", "hold"] },
        amount: { type: "number", description: "Load amount." },
        note: { type: "string" },
        count: { type: "integer" },
        flags: { type: "array", items: { type: "boolean" } },
      },
      required: ["decision", "amount"],
    })
    expect(fellBack).toBe(false)
    expect(parseWith(shape, { decision: "approve", amount: 12.5 }).success).toBe(true)
    expect(parseWith(shape, { decision: "reject", amount: 1 }).success).toBe(false)
    expect(parseWith(shape, { decision: "hold" }).success).toBe(false) // amount required
    expect(parseWith(shape, { decision: "hold", amount: 1, count: 1.5 }).success).toBe(false)
    expect(parseWith(shape, { decision: "hold", amount: 1, flags: [true, false] }).success).toBe(
      true,
    )
  })

  it("supports nested objects, const, and nullable via type arrays", () => {
    const { shape, fellBack } = jsonSchemaToZodShape({
      type: "object",
      properties: {
        kind: { const: "billing" },
        carrier: {
          type: "object",
          properties: { name: { type: ["string", "null"] } },
          required: ["name"],
        },
      },
      required: ["kind"],
    })
    expect(fellBack).toBe(false)
    expect(parseWith(shape, { kind: "billing", carrier: { name: null } }).success).toBe(true)
    expect(parseWith(shape, { kind: "other" }).success).toBe(false)
  })

  it("falls back when nesting exceeds the depth limit", () => {
    let node: Record<string, unknown> = { type: "string" }
    for (let i = 0; i <= MAX_DEPTH; i++) {
      node = { type: "object", properties: { child: node } }
    }
    const result = jsonSchemaToZodShape(node)
    expect(result.fellBack).toBe(true)
    expect(result.fallbackReason).toContain(`${MAX_DEPTH}`)
    expect(result.shape["input"]).toBeDefined()
  })

  it("falls back when the property budget is exceeded", () => {
    const properties: Record<string, unknown> = {}
    for (let i = 0; i <= MAX_PROPERTIES; i++) properties[`p${i}`] = { type: "string" }
    const result = jsonSchemaToZodShape({ type: "object", properties })
    expect(result.fellBack).toBe(true)
    expect(result.fallbackReason).toContain(`${MAX_PROPERTIES}`)
  })

  it("falls back on oversized schemas", () => {
    const result = jsonSchemaToZodShape({
      type: "object",
      properties: { a: { type: "string", description: "x".repeat(MAX_SCHEMA_BYTES) } },
    })
    expect(result.fellBack).toBe(true)
    expect(result.fallbackReason).toContain("bytes")
  })

  it("falls back on missing schema, non-object roots, and unsupported constructs", () => {
    expect(jsonSchemaToZodShape(undefined).fellBack).toBe(true)
    expect(jsonSchemaToZodShape({ type: "string" }).fellBack).toBe(true)
    expect(
      jsonSchemaToZodShape({ type: "object", properties: { a: { type: "weird" } } }).fellBack,
    ).toBe(true)
    // the permissive fallback still parses a free-form input record
    const fb = jsonSchemaToZodShape(undefined)
    expect(parseWith(fb.shape, { input: { anything: 1 } }).success).toBe(true)
  })
})
