import type { RawSection } from "../types"
import { section as dataManagement } from "./groups/data-management"
import { section as events } from "./groups/events"
import { section as aggregate } from "./groups/aggregate"
import { section as admin } from "./groups/admin"
import { section as contractDesk } from "./groups/contract-desk"
import { section as transportFolders } from "./groups/transport-folders"
import { section as compliance } from "./groups/compliance"
import { section as moneyFound } from "./groups/money-found"
import { section as customsDeclaration } from "./groups/customs-declaration"
import { sections as appWorkflows } from "./groups/app-workflows"

/**
 * One page per probe-gated tool group (src/tools/tool-groups.ts). Each group
 * is listed only when it is available to the connection, so these pages say
 * when a customer sees the tools as well as what they do.
 */
export const sections: RawSection[] = [
  dataManagement,
  events,
  aggregate,
  admin,
  contractDesk,
  transportFolders,
  compliance,
  moneyFound,
  customsDeclaration,
  ...appWorkflows,
]
