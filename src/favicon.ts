/**
 * Talonic favicon, embedded as a base64 PNG.
 *
 * Served at `/favicon.ico` from the hosted MCP server so browsers and
 * Google's favicon scraper (which Anthropic's Connectors Directory uses
 * to fetch the logo shown on directory listings and tool-call previews)
 * see the correct Talonic mark when they hit `mcp.talonic.com`.
 *
 * Inlined as base64 rather than read from disk to keep the build simple:
 * no asset-copy step, no fs reads at boot, no path resolution gymnastics.
 * Source asset is the 32x32 Talonic favicon PNG (1882 bytes on disk).
 */

const FAVICON_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAABGdBTUEAALGPC/xhBQAAACBjSFJN" +
  "AAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAACZ1BMVEUAAABnOrdmOrVnObdn" +
  "OrhrPLhnMrddLbxbLL1ZLL5YK79mPL5fMMZnOrZmOrdnOLtnOrdnOrdnOrdnOrdnOrdnOrdnOrdn" +
  "OrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdn" +
  "OrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdn" +
  "OrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdn" +
  "OrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdn" +
  "OrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdn" +
  "OrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdn" +
  "OrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdn" +
  "OrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdn" +
  "OrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdn" +
  "OrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrdnOrf///8XxPMmAAAAy3RSTlMAAAAAAAAAAAAAAAAA" +
  "AAAABiYQjuSPa/zSbJ75Qp9LWycBeP60eSldTBSo+txDJNr3rBpJ3vunEmGvf/WuBdBKDQi3WXt0" +
  "LubDCsrtQOctcEHu8OCDNfQEL/j94ek5XsTsTTTMZlOJzsBXAgmBUfagDwujUuLLEb2Y62pOODBp" +
  "mxbVaPPyxx1umWeSosatkCzPSL47PeUr6Do2PpZHB92dwg48DKuaFabRG352XLKqWKm5d0TXpaGk" +
  "N22IxWC2uhlQ2SJVc3IDcZwzMnfzOPUAAAABYktHRMwa15PTAAAAB3RJTUUH5woIBjgT3z0wQwAA" +
  "ArZJREFUOMt1U/s/U2Ec3jfdrzMy9m7VHDUmWji5HLk1ZpiN5bKZoSimjiRjUm6bKOUSuVdSU9JF" +
  "N110T7f3n+pdPg4+Pnt/Oc/n+z7P834v58vjrTzA9/TkA8/tAYGXt/dugVsGgI/Q11foB+4YsE6E" +
  "xGIk8YA1SsGevfukAOBPBQRQ+wmQHpAFCjgnCJIH44MhJB56CCsOhxEQHoHpI5GwZBBFRccwsUcJ" +
  "UMTFJ8B6SExiYqKFxziCEienqFLVEJmWnkHkCWJ/jXdmMtZyBF1Wth4fB8jJlecB5AcYsNFYkG0q" +
  "5HLIMxcV0yUAGUiSc6LwJIotLTt1urzCwlUD0sozWAZwlkEsk4Wr1ACWc9Wr2gGB9Hl+zQVUKxLV" +
  "ButrNqy827hp85atYK1j6vW2BiuAtcFWcLHxEtcFsF5u0jYDNLZg1LqNBGF7q6GNtTvM7Vc6Oslc" +
  "+FeNNHWNvBpid1hhUdJFy6+n57bQtPAGn9et6unta9MB3DTUL7oC1KN+qTgO1/X2DNziZQ6mDSVh" +
  "xzCMoNElwigaARhjk4bSBjN54x0US99WqO400XcnFgkTqfZ7AJP3KZZ6kMgDZ/KUMrTzITIaWLPL" +
  "AsCswF3dAI+m5Y+d/wOuQTePxM9oBmZId6pnBlRThicJJGhZ3SupTMP2eXn1sSaZ+qlhbOXdDsgb" +
  "J4JEEWZIaeyznRCFlQAey9qQ57MvXlZUMa/CxeLXiIy8hI54k7H8R+XrWZsRUcIikrxljnkLEINN" +
  "bEQKR3iHlcMq0/uyIPJOoanHCZMfNMNK7McR5qk5bdtHVxqV/Y7gBvL5ZNfO4XmO8HmWwoNfXMVK" +
  "7PjrNwK+2zCuC+MIEFbq30iKhh9UeblxgYCfI9M+7bB2PyRIp0MiD7ebBQuUw0H9AvfL6fydXtwU" +
  "5H69d4H6z1/1aoN/aBK/SawyCYIAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjMtMTAtMDhUMDY6NTY6" +
  "MTkrMDA6MDCmDikuAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDIzLTEwLTA4VDA2OjU2OjE5KzAwOjAw" +
  "11ORkgAAAFd6VFh0UmF3IHByb2ZpbGUgdHlwZSBpcHRjAAB4nOPyDAhxVigoyk/LzEnlUgADIwsu" +
  "YwsTIxNLkxQDEyBEgDTDZAMjs1Qgy9jUyMTMxBzEB8uASKBKLgDqFxF08kI1lQAAAABJRU5ErkJg" +
  "gg=="

export const FAVICON_BYTES: Buffer = Buffer.from(FAVICON_BASE64, "base64")
