import { randomUUID } from "node:crypto";

/**
 * Creates a short, readable, session-local id with a typed prefix.
 * Not globally unique across restarts — by design for this MVP.
 */
export const createId = <P extends string>(prefix: P): `${P}_${string}` =>
  `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
