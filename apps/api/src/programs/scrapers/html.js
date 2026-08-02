export function htmlToFlatText(html) {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<(strong|b|h[1-6])(\s[^>]*)?>/gi, "\u0001");
  text = text.replace(/<\/(strong|b|h[1-6])>/gi, "\u0002");
  text = text.replace(/<(\/p|\/li|\/div|\/tr|\/h[1-6]|br\s*\/?)>/gi, "\n");
  text = text.replace(/<li(\s[^>]*)?>/gi, "\n• ");
  text = text.replace(/<[^>]+>/g, "");

  const entities = {
    "&amp;": "&",
    "&quot;": '"',
    "&#x27;": "'",
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&mdash;": "—",
    "&ndash;": "–",
    "&lt;": "<",
    "&gt;": ">",
  };
  text = text.replace(
    /&#x27;|&#39;|&amp;|&quot;|&apos;|&nbsp;|&mdash;|&ndash;|&lt;|&gt;/g,
    (entity) => entities[entity] || entity,
  );
  return text.replace(/&#(\d+);/g, (_, codePoint) =>
    String.fromCharCode(Number(codePoint)));
}

export function looksLikeHeading(text) {
  const candidate = text.trim();
  if (!candidate || candidate.length > 90) return false;
  return !/\d{2}:\d{2,3}:\d{3}/.test(candidate);
}
