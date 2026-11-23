"""Natural Earth 110m land GeoJSON -> docs/assets/world-land.svg (equirectangular).

Usage: python scripts/world_svg.py path/to/ne_110m_land.geojson
Source: https://github.com/nvkelso/natural-earth-vector (public domain).
The CV map (hooks/cv.py) places dots with the same projection: x = lon + 180, y = TOP - lat.
"""
import json
import sys
from pathlib import Path

TOP, BOTTOM = 84, -58  # ponytail: crop Antarctica and the far Arctic; keep in sync with hooks/cv.py


def ring(coords):
    pts = [f"{lon + 180:.1f} {TOP - lat:.1f}" for lon, lat in coords]
    return "M" + "L".join(pts) + "Z"


geo = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
paths = []
for f in geo["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    paths += [ring(p[0]) for p in polys]

out = Path(__file__).resolve().parent.parent / "docs" / "assets" / "world-land.svg"
out.write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 {TOP - BOTTOM}">'
    f'<path fill="#cbc5b4" d="{"".join(paths)}"/></svg>\n',
    encoding="utf-8",
)
print(out, out.stat().st_size, "bytes")
