export function intersectBbox(a, b) {
  const intersection = [
    Math.max(a[0], b[0]), Math.max(a[1], b[1]),
    Math.min(a[2], b[2]), Math.min(a[3], b[3]),
  ];
  return intersection[0] < intersection[2] && intersection[1] < intersection[3]
    ? intersection : null;
}

export function timeWindow(state, offset, seconds) {
  const minimum = Date.parse(state.start);
  const end = Math.min(Date.parse(state.end), minimum + Number(offset) * 1000);
  return [Math.max(minimum, end - Number(seconds) * 1000), end];
}

export function overlaps(product, window) {
  return Date.parse(product.start) <= window[1] && Date.parse(product.end) >= window[0];
}

export async function mapLimited(items, limit, callback) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await callback(items[index]);
    }
  }));
  return results;
}
