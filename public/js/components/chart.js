// Jarvis Cyber — SVG Chart Utilities
export class Chart {

  /**
   * Horizontal bar chart
   * @param {Array<{label, value, color, max}>} data
   * @param {Object} opts
   * @returns {string} SVG HTML
   */
  static horizontalBar(data, opts = {}) {
    const { width = 400, barHeight = 24, gap = 8, showValues = true } = opts;
    if (!data || data.length === 0) return '<div class="empty-state"><span class="empty-icon">📊</span><span class="empty-title">No data</span></div>';

    const maxVal = opts.max || Math.max(...data.map(d => d.value), 1);
    const height = data.length * (barHeight + gap);
    const labelWidth = 120;
    const barArea = width - labelWidth - 60;

    let svg = `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">`;

    data.forEach((item, i) => {
      const y = i * (barHeight + gap);
      const barWidth = (item.value / maxVal) * barArea;
      const color = item.color || '#00f0ff';

      // Label
      svg += `<text x="0" y="${y + barHeight / 2 + 4}" fill="#94a3b8" font-size="11" font-family="Inter, sans-serif">${item.label.slice(0, 18)}</text>`;

      // Bar background
      svg += `<rect x="${labelWidth}" y="${y + 2}" width="${barArea}" height="${barHeight - 4}" rx="4" fill="rgba(255,255,255,0.03)"/>`;

      // Bar fill
      if (barWidth > 0) {
        svg += `<rect x="${labelWidth}" y="${y + 2}" width="${Math.max(barWidth, 4)}" height="${barHeight - 4}" rx="4" fill="${color}" opacity="0.8">
          <animate attributeName="width" from="0" to="${Math.max(barWidth, 4)}" dur="0.6s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1"/>
        </rect>`;
      }

      // Value
      if (showValues) {
        svg += `<text x="${labelWidth + barArea + 8}" y="${y + barHeight / 2 + 4}" fill="#64748b" font-size="11" font-family="JetBrains Mono, monospace">${item.value}</text>`;
      }
    });

    svg += '</svg>';
    return svg;
  }

  /**
   * Donut chart
   * @param {Array<{label, value, color}>} data
   * @param {Object} opts
   * @returns {string} SVG HTML
   */
  static donut(data, opts = {}) {
    const { size = 160, strokeWidth = 20, centerLabel = '' } = opts;
    if (!data || data.length === 0) return '';

    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return '';

    const cx = size / 2;
    const cy = size / 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;

    // Background circle
    svg += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="${strokeWidth}"/>`;

    data.forEach((item) => {
      const pct = item.value / total;
      const dashLength = pct * circumference;
      const dashGap = circumference - dashLength;
      const color = item.color || '#00f0ff';

      svg += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
        stroke-dasharray="${dashLength} ${dashGap}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round" opacity="0.85">
        <animate attributeName="stroke-dasharray" from="0 ${circumference}" to="${dashLength} ${dashGap}" dur="0.8s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1"/>
      </circle>`;

      offset += dashLength;
    });

    // Center text
    if (centerLabel) {
      svg += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="#e2e8f0" font-size="22" font-weight="800" font-family="JetBrains Mono, monospace">${total}</text>`;
      svg += `<text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="#64748b" font-size="10" font-family="Inter, sans-serif">${centerLabel}</text>`;
    }

    svg += '</svg>';
    return svg;
  }

  /**
   * Simple sparkline
   * @param {Array<number>} values
   * @param {Object} opts
   * @returns {string} SVG HTML
   */
  static sparkline(values, opts = {}) {
    const { width = 120, height = 30, color = '#00f0ff' } = opts;
    if (!values || values.length < 2) return '';

    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const step = width / (values.length - 1);

    const points = values.map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
    </svg>`;
  }
}
