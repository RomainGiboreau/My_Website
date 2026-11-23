"""Render the CV from data/cv.yml into two pages (MkDocs hook).

docs/cv.md        -> visual web page (HTML blocks between Markdown headings)
docs/cv-print.md  -> sober Markdown, printed to cv.pdf in CI
Both pages contain only front matter and the marker below; content lives in the YAML.
"""
import html
import re
from pathlib import Path

import markdown
import yaml

MARKER = "<!-- cv -->"
DATA = Path(__file__).resolve().parent.parent / "data" / "cv.yml"


def load():
    return yaml.safe_load(DATA.read_text(encoding="utf-8"))


def inline(text):
    """Markdown string -> inline HTML (no wrapping <p>)."""
    out = markdown.markdown(str(text).strip())
    return re.sub(r"^<p>(.*)</p>$", r"\1", out, flags=re.S)


def meta(job):
    return " · ".join(x for x in (job.get("years"), job.get("note")) if x)


def pub_year(venue):
    return re.findall(r"\b\d{4}\b", venue)[-1]


# ---------- print: today's plain layout ----------
def render_print(d):
    o = [f"# {d['name']}", f"**{d['headline']}**",
         f"[Download PDF]({d['pdf']}){{ .md-button .cv-download }}", d["summary"], "---", "## Experience"]
    for j in d["experience"]:
        head = f"**{j['org']}** · {meta(j)}" if j.get("org") else f"**{meta(j)}**"
        o.append(f"### {j['title']}\n{head}")
        o += j["text"]
        o += [f"**{h['name']}** {h['text']}" for h in j.get("highlights", [])]
        if j.get("list"):
            o.append(f"**{j['list_title']}**")
            o.append("\n".join(f"- {x}" for x in j["list"]))
    o += ["---", "## Selected public projects",
          "\n".join(f"- [{p['name']}]({p['url']}) — {p['text']}" for p in d["projects"])]
    b = d["basins"]
    o += ["---", "## Basins", "**Core areas**",
          "\n".join(f"- **{c['name']}**{c.get('suffix', '')} — {c['text']}" for c in b["core"]),
          "**Also worked**",
          "\n".join(f"- {r['region']} — {'; '.join(r['items'])}" for r in b["also"])]
    o += ["---", "## Publications",
          "\n".join(f"- {p['title']} ({p['venue']})" for p in d["publications"])]
    o += ["---", "## Skills",
          "| Domain | Tools |\n|---|---|\n" + "\n".join(f"| {s['domain']} | {', '.join(s['tools'])} |" for s in d["skills"])]
    o += ["---", "## Education"]
    o += [f"**{e['degree']}**, {e['school']} · {e['year']}" for e in d["education"]]
    o += [f"**Certifications**\n{d['certifications']}"]
    o += ["---", "## Languages",
          "| Language | Level |\n|---|---|\n" + "\n".join(f"| {n} | {lvl} |" for n, lvl, _ in d["languages"])]
    o += ["---", "## Contact", d["contact"]]
    return "\n\n".join(o) + "\n"


# ---------- web: visual layout ----------
def chips(items):
    return '<ul class="cv-chips">' + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ul>"


def render_web(d):
    o = [f"# {d['name']}",
         f'<p class="cv-headline">{inline(d["headline"])}</p>',
         f'<p class="cv-summary">{inline(d["summary"])}</p>',
         f"[Download PDF]({d['pdf']}){{ .md-button .md-button--primary .cv-download }}",
         '<div class="cv-figures">' + "".join(
             f'<div><b>{html.escape(str(n))}</b><span>{html.escape(lbl)}</span></div>' for n, lbl in d["figures"]
         ) + "</div>"]

    items = []
    for j in d["experience"]:
        org = f'<span class="cv-org">{inline(j["org"])}</span>' if j.get("org") else ""
        note = f' <span class="cv-note">{inline(j["note"])}</span>' if j.get("note") else ""
        body = "".join(f"<p>{inline(t)}</p>" for t in j["text"])
        body += "".join(f'<div class="cv-highlight"><strong>{inline(h["name"])}</strong> {inline(h["text"])}</div>'
                        for h in j.get("highlights", []))
        if j.get("list"):
            body += f'<p class="cv-list-title">{inline(j["list_title"])}</p>' + chips(j["list"])
        items.append(f'<li><span class="cv-when">{html.escape(j["years"])}</span>'
                     f'<h3>{inline(j["title"])}</h3><p class="cv-meta">{org}{note}</p>{body}</li>')
    o += ["## Experience", '<ol class="cv-timeline">' + "".join(items) + "</ol>"]

    o += ["## Selected public projects", '<div class="cv-cards">' + "".join(
        f'<a class="cv-card" href="{html.escape(p["url"])}"><strong>{inline(p["name"])}</strong>'
        f'<span>{inline(p["text"])}</span></a>' for p in d["projects"]) + "</div>"]

    b = d["basins"]
    o += ["## Basins", "### Core areas", '<div class="cv-cards cv-basins">' + "".join(
        f'<div class="cv-card"><strong>{inline(c["name"])}{inline(c.get("suffix", ""))}</strong>'
        f'<span>{inline(c["text"])}</span></div>' for c in b["core"]) + "</div>",
        "### Also worked",
        '<div class="cv-regions">' + "".join(
            f'<div><span class="cv-label">{inline(r["region"])}</span>{chips(r["items"])}</div>' for r in b["also"]
        ) + "</div>"]

    o += ["## Publications", '<ul class="cv-pubs">' + "".join(
        f'<li><span class="cv-year">{pub_year(p["venue"])}</span><div><strong>{inline(p["title"])}</strong>'
        f'<span class="cv-venue">{inline(re.sub(r",?\s*\b\d{4}\b", "", p["venue"]))}</span></div></li>'
        for p in d["publications"]) + "</ul>"]

    o += ["## Skills", '<div class="cv-regions">' + "".join(
        f'<div><span class="cv-label">{inline(s["domain"])}</span>{chips(s["tools"])}</div>' for s in d["skills"]
    ) + "</div>"]

    o += ["## Education", '<div class="cv-cards">' + "".join(
        f'<div class="cv-card"><strong>{inline(e["degree"])}</strong><span>{inline(e["school"])} · {e["year"]}</span></div>'
        for e in d["education"]) + "</div>",
        f'<p class="cv-certs"><strong>Certifications</strong> {inline(d["certifications"])}</p>']

    o += ["## Languages", '<ul class="cv-langs">' + "".join(
        f'<li><span>{html.escape(n)}</span><span class="cv-dots" aria-hidden="true">'
        + "".join(f'<i{" class=on" if k < lvl else ""}></i>' for k in range(4))
        + f'</span><em>{html.escape(level)}</em></li>' for n, level, lvl in d["languages"]) + "</ul>"]

    o += ["## Contact", d["contact"]]
    return "\n\n".join(o) + "\n"


def on_page_markdown(markdown_src, page, **_):
    render = {"cv.md": render_web, "cv-print.md": render_print}.get(page.file.src_uri)
    return markdown_src.replace(MARKER, render(load())) if render else markdown_src


if __name__ == "__main__":
    # ponytail: self-check — every content string reaches both renders
    d = load()
    web, prt = render_web(d), render_print(d)
    musts = [j["title"] for j in d["experience"]] + [p["url"] for p in d["projects"]] \
        + [c["name"] for c in d["basins"]["core"]] + [s["domain"] for s in d["skills"]]
    for s in musts:
        assert s in prt, s
        assert html.escape(s, quote=False) in web or inline(s) in web, s
    print("ok")
