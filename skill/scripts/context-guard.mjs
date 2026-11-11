#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Admission decision for ONE request, supplied by a runtime adapter before submission.
 * occupiedTokens includes system, tools, history and cache hits; never lifetime usage.
 * Reservations are conservative upper bounds, including reasoning and tool responses.
 */
export function admitContext(sample, now = Date.now()) {
  const fail = (reason) => ({ allowed: false, action: "checkpoint_and_replace", reason });
  if (!sample || typeof sample !== "object") return fail("missing telemetry");
  for (const key of ["effectiveWindowTokens", "occupiedTokens", "nextInputTokens", "reservedOutputTokens", "reservedToolTokens"]) {
    if (!Number.isSafeInteger(sample[key]) || sample[key] < 0) return fail(`invalid ${key}`);
  }
  if (typeof sample.sessionId !== "string" || !sample.sessionId.trim() || typeof sample.requestId !== "string" || !sample.requestId.trim()) return fail("missing session/request identity");
  const measuredAt = Date.parse(sample.measuredAt);
  if (!Number.isFinite(measuredAt) || measuredAt > now || now - measuredAt > 60000) return fail("stale or missing telemetry");
  if (sample.effectiveWindowTokens === 0 || sample.reservedOutputTokens === 0) return fail("unknown window or unreserved generation");
  if (sample.toolsEnabled !== false && sample.reservedToolTokens === 0) return fail("tool output must be reserved when tools may run");
  if (sample.measurement !== "runtime" && sample.measurement !== "tokenizer_upper_bound") return fail("unverified token measurement");
  const projectedTokens = sample.occupiedTokens + sample.nextInputTokens + sample.reservedOutputTokens + sample.reservedToolTokens;
  if (!Number.isSafeInteger(projectedTokens)) return fail("token total overflow");
  const ceilingTokens = Math.floor(sample.effectiveWindowTokens * 0.6);
  if (projectedTokens > ceilingTokens) return { ...fail("60% ceiling would be exceeded"), projectedTokens, ceilingTokens };
  return { allowed: true, action: projectedTokens >= sample.effectiveWindowTokens * 0.5 ? "checkpoint_then_handoff" : "continue", projectedTokens, ceilingTokens };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const sample = JSON.parse(readFileSync(process.argv[2] ?? 0, "utf8"));
    const result = admitContext(sample);
    console.log(JSON.stringify(result));
    process.exitCode = result.allowed ? 0 : 2;
  } catch (error) {
    console.error(JSON.stringify({ allowed: false, reason: error.message }));
    process.exitCode = 2;
  }
}
