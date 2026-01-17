import type { TraceSample } from "@shared/replay";
import type { Span } from "@shared/trace";

export const sortSpans = (spans: Span[]) =>
  [...spans].sort((a, b) => a.startTime - b.startTime);

export const upsertSpan = (spans: Span[], incoming: Span) => {
  let replaced = false;
  const next = spans.map((span) => {
    if (span.spanId === incoming.spanId) {
      replaced = true;
      return { ...span, ...incoming };
    }
    return span;
  });
  if (!replaced) {
    next.push(incoming);
  }
  return sortSpans(next);
};

export const findPreviousNode = (spans: Span[], current: Span) => {
  const ordered = sortSpans(spans);
  let previous: Span | null = null;
  for (const span of ordered) {
    if (span.startTime >= current.startTime) break;
    previous = span;
  }
  return previous?.nodeId ?? null;
};

export const normalizeTraceSample = (sample: TraceSample): TraceSample => {
  const baseSample = sample.spans.reduce(
    (min, span) => Math.min(min, span.startTime),
    Number.POSITIVE_INFINITY,
  );
  const base = Number.isFinite(baseSample) ? baseSample : 0;
  return {
    traceId: sample.traceId,
    spans: sample.spans.map((span) => ({
      ...span,
      startTime: span.startTime - base,
      endTime: span.endTime !== null ? span.endTime - base : null,
    })),
  };
};
