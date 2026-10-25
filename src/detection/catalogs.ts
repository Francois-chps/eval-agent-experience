/**
 * Detection catalogs by experiment category: the tools bench report looks
 * for in the diffs. The schema only accepts a category listed here, so an
 * experiment without a catalog fails when it is loaded, before any run.
 *
 * A new category needs a catalog file (like email-tools.ts) and one entry.
 */
import { EMAIL_TOOLS, type EmailTool } from "./email-tools.js";

export type Catalog = readonly EmailTool[];

// A Map, not an object: "constructor" is a valid slug but must not resolve.
export const CATALOGS: ReadonlyMap<string, Catalog> = new Map([["email", EMAIL_TOOLS]]);

export function catalogFor(category: string): Catalog {
  const catalog = CATALOGS.get(category);
  if (catalog === undefined) throw new Error(`no detection catalog for category ${category}`);
  return catalog;
}
