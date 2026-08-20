import { z } from "zod"

/**
 * Convert a (tenant-authored) JSON Schema 2020-12 subset into a Zod raw shape
 * usable as an MCP tool `inputSchema`.
 *
 * Supported subset: `type: object` with `properties`/`required`, `enum`,
 * `const`, scalar types (`string`, `number`, `integer`, `boolean`), `array`
 * with `items`, nested objects, and `nullable`/`type: [X, "null"]`.
 *
 * Tenant schemas are adversarial input. Hard limits keep a hostile or broken
 * schema from exhausting the server or the client's context window:
 *
 * - max nesting depth: {@link MAX_DEPTH}
 * - max properties across the whole schema: {@link MAX_PROPERTIES}
 * - max serialized schema size: {@link MAX_SCHEMA_BYTES}
 *
 * Anything outside the subset or over a limit falls back to a permissive
 * `z.record(z.string(), z.unknown())` — the tool stays callable and the
 * fallback is surfaced in the tool description (see the `fellBack` flag),
 * never silently.
 */
export const MAX_DEPTH = 6
export const MAX_PROPERTIES = 100
export const MAX_SCHEMA_BYTES = 32 * 1024

export interface JsonSchemaConversion {
  /** Raw shape for `registerTool`'s `inputSchema`. */
  shape: Record<string, z.ZodType>
  /** True when limits/unsupported constructs forced the permissive fallback. */
  fellBack: boolean
  /** Human-readable reason for the fallback, for tool descriptions. */
  fallbackReason?: string
}

/** Permissive fallback shape: a single free-form `input` record. */
function fallbackShape(reason: string): JsonSchemaConversion {
  return {
    shape: {
      input: z.record(z.string(), z.unknown()).describe(`Free-form input object. (${reason})`),
    },
    fellBack: true,
    fallbackReason: reason,
  }
}

class ConversionLimitError extends Error {}

interface Budget {
  properties: number
}

function convertNode(node: unknown, depth: number, budget: Budget): z.ZodType {
  if (depth > MAX_DEPTH) throw new ConversionLimitError(`nesting deeper than ${MAX_DEPTH}`)
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    throw new ConversionLimitError("schema node is not an object")
  }
  const schema = node as Record<string, unknown>

  // enum / const first: they constrain independently of `type`.
  if (Array.isArray(schema["enum"])) {
    const values = schema["enum"]
    if (values.length === 0) throw new ConversionLimitError("empty enum")
    if (values.every((v) => typeof v === "string")) {
      return z.enum(values as [string, ...string[]])
    }
    return z.union(values.map((v) => z.literal(v as z.core.util.Literal)))
  }
  if ("const" in schema) {
    return z.literal(schema["const"] as z.core.util.Literal)
  }

  let type = schema["type"]
  let nullable = schema["nullable"] === true
  if (Array.isArray(type)) {
    const nonNull = type.filter((t) => t !== "null")
    nullable = nullable || nonNull.length !== type.length
    if (nonNull.length !== 1) throw new ConversionLimitError("union types are not supported")
    type = nonNull[0]
  }

  let result: z.ZodType
  switch (type) {
    case "string":
      result = z.string()
      break
    case "number":
      result = z.number()
      break
    case "integer":
      result = z.number().int()
      break
    case "boolean":
      result = z.boolean()
      break
    case "array": {
      const items = schema["items"]
      result = z.array(items === undefined ? z.unknown() : convertNode(items, depth + 1, budget))
      break
    }
    case "object": {
      const properties = (schema["properties"] ?? {}) as Record<string, unknown>
      const required = new Set(
        Array.isArray(schema["required"]) ? (schema["required"] as string[]) : [],
      )
      const shape: Record<string, z.ZodType> = {}
      for (const [key, child] of Object.entries(properties)) {
        budget.properties += 1
        if (budget.properties > MAX_PROPERTIES) {
          throw new ConversionLimitError(`more than ${MAX_PROPERTIES} properties`)
        }
        let converted = convertNode(child, depth + 1, budget)
        const description = (child as Record<string, unknown>)?.["description"]
        if (typeof description === "string" && description) {
          converted = converted.describe(description)
        }
        shape[key] = required.has(key) ? converted : converted.optional()
      }
      result = z.object(shape)
      break
    }
    case undefined:
      throw new ConversionLimitError("schema node has no type")
    default:
      throw new ConversionLimitError(`unsupported type '${String(type)}'`)
  }
  return nullable ? result.nullable() : result
}

/**
 * Convert an app's input JSON Schema into an MCP tool raw shape.
 *
 * The top level must be `type: object`; its properties become the tool's
 * arguments. A missing/undecodable/oversized schema falls back permissively —
 * check `fellBack` and say so in the tool description.
 */
export function jsonSchemaToZodShape(schema: unknown): JsonSchemaConversion {
  if (schema === undefined || schema === null) {
    return fallbackShape("the app declares no input schema")
  }
  let bytes: number
  try {
    bytes = JSON.stringify(schema)?.length ?? 0
  } catch {
    return fallbackShape("the app's input schema is not serializable")
  }
  if (bytes > MAX_SCHEMA_BYTES) {
    return fallbackShape(`the app's input schema exceeds ${MAX_SCHEMA_BYTES} bytes`)
  }
  const root = schema as Record<string, unknown>
  if (root["type"] !== "object") {
    return fallbackShape("the app's input schema is not a top-level object schema")
  }
  try {
    const budget: Budget = { properties: 0 }
    const converted = convertNode(root, 1, budget)
    const shape = (converted as z.ZodObject<Record<string, z.ZodType>>).shape
    return { shape: { ...shape }, fellBack: false }
  } catch (error) {
    const reason =
      error instanceof ConversionLimitError
        ? `schema outside the supported subset: ${error.message}`
        : "schema conversion failed"
    return fallbackShape(reason)
  }
}
