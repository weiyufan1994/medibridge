type CounterMap = Map<string, number>;

const counters: CounterMap = new Map();

export function incrementMetric(name: string, tags?: Record<string, string | number | boolean>) {
  const key = buildMetricKey(name, tags);
  const current = counters.get(key) ?? 0;
  counters.set(key, current + 1);
}

export function getMetricsSnapshot() {
  return Array.from(counters.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));
}

export function clearMetricsForTests() {
  counters.clear();
}

function buildMetricKey(
  name: string,
  tags?: Record<string, string | number | boolean>
) {
  if (!tags || Object.keys(tags).length === 0) {
    return name;
  }

  const normalizedTags = Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tagKey, tagValue]) => `${tagKey}=${String(tagValue)}`)
    .join(",");

  return `${name}{${normalizedTags}}`;
}
