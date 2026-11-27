// Wells table: "name, x, y, environment" (tab, semicolon, comma or space separated; a header line or a bad line is skipped and reported).
const NUM = '(-?\\d+(?:[.,]\\d+)?(?:e[+-]?\\d+)?)';
const RE = [new RegExp('^\\s*([^\\t;]+?)\\s*[\\t;]\\s*' + NUM + '\\s*[\\t;]\\s*' + NUM + '\\s*[\\t;]\\s*(.+?)\\s*$', 'i'),
  new RegExp('^\\s*([^,]+?)\\s*,\\s*' + NUM + '\\s*,\\s*' + NUM + '\\s*,\\s*(.+?)\\s*$', 'i'),
  new RegExp('^\\s*(\\S+)\\s+' + NUM + '\\s+' + NUM + '\\s+(.+?)\\s*$', 'i')];

export function parseWells(text) {
  const wells = [], skipped = [];
  String(text || '').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    for (const re of RE) {
      const m = re.exec(line);
      if (m) { wells.push({ name: m[1].trim(), x: parseFloat(m[2].replace(',', '.')), y: parseFloat(m[3].replace(',', '.')), env: m[4].trim() }); return; }
    }
    if (i > 0 || /\d/.test(line)) skipped.push(i + 1);   // the first line is allowed to be a header
  });
  return { wells, skipped };
}

export const wellsToText = wells => wells.map(w => [w.name, Math.round(w.x), Math.round(w.y), w.env].join(', ')).join('\n');

// map extent (square, metres) around the wells with a margin; null when there are no wells
export function fitExtent(wells, margin = 0.45) {
  if (!wells.length) return null;
  const xs = wells.map(w => w.x), ys = wells.map(w => w.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const half = Math.max(x1 - x0, y1 - y0, 1000) * (0.5 + margin), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { xmin: Math.round(cx - half), xmax: Math.round(cx + half), ymin: Math.round(cy - half), ymax: Math.round(cy + half) };
}
