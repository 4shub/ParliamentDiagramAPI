// Translated from slashme/parliamentdiagram and Gouvernathor/parliamentarch.
// See LICENSE, licenses/parliamentarch-LICENSE, and NOTICE.
export const escapeXml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export const roundEven = n => {
  const floor = Math.floor(n);
  return n - floor === 0.5 ? floor + (floor % 2) : Math.round(n);
};
export const mod = (n, d) => ((n % d) + d) % d;
export function header(width, height, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${escapeXml(title)}</title>\n<!-- Translated into Node.js from Python: https://github.com/slashme/parliamentdiagram and https://github.com/Gouvernathor/parliamentarch -->\n`;
}
export function group(party, index, body) {
  return `<g id="party-${index}" fill="${party.color}" data-seats="${party.size}"><title>${escapeXml(party.name)}</title>${body}</g>\n`;
}
