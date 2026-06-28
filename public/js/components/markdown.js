// Jarvis Cyber — Markdown Renderer Wrapper
let markedConfigured = false;

export function renderMarkdown(text) {
  if (!text) return '';
  try {
    if (typeof marked !== 'undefined') {
      // Configure marked once (avoid deprecated setOptions repeated calls)
      if (!markedConfigured) {
        marked.use({ breaks: true, gfm: true });
        markedConfigured = true;
      }
      
      const rawHtml = marked.parse(text);
      if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(rawHtml);
      }
      return rawHtml;
    }
  } catch (e) {
    console.warn('Markdown parse error:', e);
  }
  // Fallback: basic HTML escaping with linebreaks
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
