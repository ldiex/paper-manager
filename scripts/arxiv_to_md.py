import asyncio
import json
import re
import sys
from copy import copy
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from bs4.element import NavigableString, Tag

from arxiv2md.fetch import fetch_arxiv_html
from arxiv2md.html_parser import parse_arxiv_html
from arxiv2md.markdown import convert_fragment_to_markdown
from arxiv2md.sections import filter_sections


def convert_span_tables(html_fragment: str) -> str:
    """Convert <span class="ltx_tabular"> structures to real <table> elements.

    Some arXiv papers render tables using spans (ltx_tabular/ltx_tr/ltx_td)
    instead of <table>/<tr>/<td>. arxiv2md only finds <table> tags, so these
    tables are silently dropped. This converts the span-based structure into
    proper HTML tables before further processing.
    """
    soup = BeautifulSoup(html_fragment, "html.parser")
    for tabular in soup.find_all(class_="ltx_tabular"):
        # Skip if already a <table>
        if tabular.name == "table":
            continue
        # Build a <table> from the span structure
        table = soup.new_tag("table")
        for tr_span in tabular.find_all(class_="ltx_tr", recursive=False):
            tr = soup.new_tag("tr")
            for cell_span in tr_span.find_all(class_=re.compile("ltx_td|ltx_th"), recursive=False):
                cell_tag = soup.new_tag("td")
                # Preserve inner content
                for child in list(cell_span.children):
                    cell_tag.append(copy(child))
                tr.append(cell_tag)
            table.append(tr)
        tabular.replace_with(table)
    return str(soup)


def inject_figure_ids(html_fragment: str) -> str:
    """Inject <a id="..."> anchors into <figure> elements.

    arxiv2md's serializer discards the id attribute of <figure> tags, making
    hash navigation to figures/tables impossible. This inserts an empty <a>
    anchor with the figure's id as the first child of each figure, so the id
    survives into the markdown output.
    """
    soup = BeautifulSoup(html_fragment, "html.parser")
    for fig in soup.find_all("figure"):
        fig_id = fig.get("id", "")
        if fig_id:
            anchor = soup.new_tag("a", attrs={"id": fig_id})
            fig.insert(0, anchor)
    return str(soup)


def build_figure_id_map(html: str) -> dict[str, str]:
    """Build mapping from 'Figure N'/'Table N' labels to arxiv figure element IDs.

    e.g. {"Figure 1": "S0.F1", "Table 1": "S2.T1", ...}
    """
    soup = BeautifulSoup(html, "html.parser")
    id_map = {}
    for fig in soup.find_all("figure"):
        fig_id = fig.get("id", "")
        if not fig_id:
            continue
        cap = fig.find("figcaption")
        if not cap:
            continue
        text = cap.get_text(strip=True)
        m = re.match(r"^(Figure|Table)\s+(\d+)", text)
        if m:
            label = f"{m.group(1)} {m.group(2)}"
            id_map[label] = fig_id
    return id_map


def extract_article_figures(html: str, base_url: str, id_map: dict[str, str] | None = None) -> str:
    """Extract figures that live directly under <article>, not in any <section>.

    arxiv2md's parse_arxiv_html only collects HTML from within <section> elements,
    so figures placed at the article level (common for title-page figures like
    Figure 1, 2) are missed entirely. This finds those orphan figures and
    returns them as markdown blocks.
    """
    soup = BeautifulSoup(html, "html.parser")
    article = soup.find("article")
    if not article:
        return ""

    # Collect figure ids that are already inside sections
    section_ids = set()
    for section in article.find_all("section"):
        for fig in section.find_all("figure"):
            if fig.get("id"):
                section_ids.add(fig["id"])

    parts = []
    for fig in article.find_all("figure", recursive=False):
        fig_id = fig.get("id", "")
        if fig_id in section_ids:
            continue
        fig_html = convert_span_tables(str(fig))
        fig_md = convert_fragment_to_markdown(fig_html, remove_inline_citations=True)
        fig_md = fix_figures(fig_md, base_url, id_map)
        if fig_md.strip():
            parts.append(fig_md)

    return "\n\n".join(parts)


def expand_spans(html_fragment: str) -> str:
    """Expand colspan/rowspan in HTML tables by duplicating cells.

    arxiv2md's _serialize_table ignores colspan/rowspan, which causes
    misaligned columns. This pre-processing step unmerges all spans so
    the resulting markdown table has consistent column counts.
    """
    soup = BeautifulSoup(html_fragment, "html.parser")
    for table in soup.find_all("table"):
        _expand_table_spans(table)
    return str(soup)


def _expand_table_spans(table: Tag) -> None:
    """Expand colspan and rowspan in a table element in-place."""
    rows = table.find_all("tr")
    grid: list[list[Tag | None]] = []

    for row_idx, row in enumerate(rows):
        while len(grid) <= row_idx:
            grid.append([])

        cells = [c for c in row.children if isinstance(c, Tag) and c.name in ("td", "th")]
        col_idx = 0
        cell_iter = iter(cells)

        for cell in cell_iter:
            while col_idx < len(grid[row_idx]) and grid[row_idx][col_idx] is not None:
                col_idx += 1

            colspan = int(cell.get("colspan", 1))
            rowspan = int(cell.get("rowspan", 1))

            for r in range(rowspan):
                while len(grid) <= row_idx + r:
                    grid.append([])
                for c in range(colspan):
                    while len(grid[row_idx + r]) <= col_idx + c:
                        grid[row_idx + r].append(None)
                    if r == 0 and c == 0:
                        grid[row_idx + r][col_idx + c] = cell
                    else:
                        clone = copy(cell)
                        clone.name = cell.name
                        clone.attrs = {}
                        clone.clear()
                        clone.append(NavigableString(""))
                        grid[row_idx + r][col_idx + c] = clone

            col_idx += colspan

    for row_idx, row in enumerate(rows):
        new_cells = grid[row_idx] if row_idx < len(grid) else []
        old_cells = [c for c in row.children if isinstance(c, Tag) and c.name in ("td", "th")]
        for old in old_cells:
            old.extract()
        for cell in new_cells:
            if cell is not None:
                row.append(cell)

    for tag in table.find_all(["td", "th"]):
        tag.attrs.pop("colspan", None)
        tag.attrs.pop("rowspan", None)


def extract_arxiv_id(raw: str) -> str:
    match = re.search(r"(\d{4}\.\d{4,5})", raw)
    if not match:
        raise ValueError(f"Cannot extract arXiv ID from: {raw}")
    return match.group(1)


def _extract_base_url(html: str, arxiv_id: str) -> str:
    """Determine the correct base URL for resolving relative image paths.

    Some arXiv HTML pages include <base href="/html/{id}vN/"> so that relative
    image src like "x1.png" resolve correctly. Others omit <base> but already
    include the version prefix in each src (e.g. "2606.27377v1/x1.png").

    This function checks for a <base> tag and constructs the full base URL.
    Falls back to "https://arxiv.org/html/" when no <base> tag is present.
    """
    soup = BeautifulSoup(html, "html.parser")
    base_tag = soup.find("base")
    if base_tag and base_tag.get("href"):
        href = base_tag["href"].strip()
        return urljoin("https://arxiv.org", href)
    return "https://arxiv.org/html/"


def fix_table_captions(markdown: str, id_map: dict[str, str] | None = None) -> str:
    """Move table captions from bold line above table to figcaption below.

    arxiv2md renders table captions as `**Table N: ...**` on a line before the
    markdown table. This converts them to `<figcaption>` elements placed after
    the table, consistent with figure captions.
    """
    id_map = id_map or {}
    lines = markdown.split("\n")
    fixed_lines = []
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()

        # Match "**Table N: caption**" or "**Table: caption**"
        caption_match = re.match(r"^\*\*(?:Table(?:\s+\d+)?\s*:\s*.+)\*\*$", stripped, re.IGNORECASE)
        if caption_match:
            caption_text = stripped.strip("*").strip()
            # Look ahead for the markdown table (skip blank lines)
            j = i + 1
            while j < len(lines) and lines[j].strip() == "":
                j += 1
            # Check if next non-blank line is a table header row
            if j < len(lines) and "|" in lines[j] and lines[j].strip().startswith("|"):
                # Collect the full table block
                table_start = j
                j += 1
                # Skip separator row (| --- | --- |)
                if j < len(lines) and re.match(r"^\|[\s\-|]+\|?\s*$", lines[j].strip()):
                    j += 1
                # Collect data rows
                while j < len(lines) and lines[j].strip().startswith("|"):
                    j += 1
                # Emit table first, then caption
                for k in range(i + 1, table_start):
                    fixed_lines.append(lines[k])
                for k in range(table_start, j):
                    fixed_lines.append(lines[k])
                tbl_id = _match_caption_id(caption_text, id_map)
                if tbl_id:
                    fixed_lines.append(f'<figcaption id="{tbl_id}">{caption_text}</figcaption>')
                else:
                    fixed_lines.append(f"<figcaption>{caption_text}</figcaption>")
                i = j
                continue

        fixed_lines.append(lines[i])
        i += 1

    return "\n".join(fixed_lines)


def fix_display_math(markdown: str) -> str:
    """Fix nested $$ $latex$ $$ patterns from equation table serialization.

    arxiv2md wraps equation tables as $$ {text} $$, but {text} already contains
    $...$ delimiters from convert_all_mathml_to_latex. This strips all inner $
    delimiters and removes redundant \\displaystyle commands.
    """

    def _fix_block(match):
        inner = match.group(1)
        inner = re.sub(r"(?<!\\)\$", "", inner)
        inner = inner.replace(r"\displaystyle", "")
        inner = re.sub(r"[ \t]+", " ", inner).strip()
        return f"$$\n{inner}\n$$"

    markdown = re.sub(r"\$\$(.*?)\$\$", _fix_block, markdown, flags=re.DOTALL)
    return markdown


def fix_figures(markdown: str, base_url: str, id_map: dict[str, str] | None = None) -> str:
    """Convert 'Figure: caption' + 'Refer to caption: src' to standard Markdown image syntax."""
    base = base_url.rstrip("/") + "/"
    id_map = id_map or {}
    lines = markdown.split("\n")
    fixed_lines = []
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()

        # Match "Figure: <caption>"
        fig_match = re.match(r"^Figure:\s*(.+)$", stripped)
        if fig_match:
            caption = fig_match.group(1).strip()
            # Look ahead for image line
            img_src = None
            if i + 1 < len(lines):
                next_stripped = lines[i + 1].strip()
                # Match "Refer to caption: src" or "Image: src" or any "<label>: <path>.png"
                img_match = re.match(
                    r"^(?:Refer to caption|Image|.+?):\s*(\S+\.(?:png|jpg|jpeg|gif|svg|webp))\s*$",
                    next_stripped,
                    re.IGNORECASE,
                )
                if img_match:
                    img_src = img_match.group(1)

            if img_src:
                if not img_src.startswith(("http://", "https://", "data:")):
                    img_src = urljoin(base, img_src)
                fixed_lines.append(f"![{caption}]({img_src})")
                fig_id = _match_caption_id(caption, id_map)
                if fig_id:
                    fixed_lines.append(f'<figcaption id="{fig_id}">{caption}</figcaption>')
                else:
                    fixed_lines.append(f"<figcaption>{caption}</figcaption>")
                i += 2  # skip caption + image line
                continue
            else:
                fixed_lines.append(f"**{caption}**")
                i += 1
                continue

        # Match standalone image line (without preceding "Figure:")
        img_match = re.match(
            r"^(?:Refer to caption|Image|.+?):\s*(\S+\.(?:png|jpg|jpeg|gif|svg|webp))\s*$",
            stripped,
            re.IGNORECASE,
        )
        if img_match:
            src = img_match.group(1)
            if not src.startswith(("http://", "https://", "data:")):
                src = urljoin(base, src)
            fixed_lines.append(f"![{src.split('/')[-1]}]({src})")
            i += 1
            continue

        fixed_lines.append(lines[i])
        i += 1

    return "\n".join(fixed_lines)


def _match_caption_id(caption: str, id_map: dict[str, str]) -> str | None:
    """Extract 'Figure N' or 'Table N' from a caption and look up its arxiv ID."""
    m = re.match(r"^(Figure|Table)\s+(\d+)", caption)
    if m:
        label = f"{m.group(1)} {m.group(2)}"
        return id_map.get(label)
    return None


async def main():
    raw_input = sys.argv[1]
    arxiv_id = extract_arxiv_id(raw_input)
    html_url = f"https://arxiv.org/html/{arxiv_id}"

    html = await fetch_arxiv_html(
        html_url, arxiv_id=arxiv_id, version=None, use_cache=True
    )
    parsed = parse_arxiv_html(html)

    sections = filter_sections(
        parsed.sections,
        mode="exclude",
        selected=["references", "bibliography"],
    )

    base_url = _extract_base_url(html, arxiv_id)
    figure_id_map = build_figure_id_map(html)

    parts = []
    if parsed.title:
        parts.append(f"# {parsed.title}\n")
    if parsed.authors:
        parts.append(f"**Authors:** {', '.join(parsed.authors)}\n")
    if parsed.abstract:
        parts.append("## Abstract\n")
        abstract_html = convert_span_tables(parsed.abstract)
        abstract_html = expand_spans(abstract_html)
        parts.append(
            convert_fragment_to_markdown(abstract_html, remove_inline_citations=True)
            + "\n"
        )

    article_figs = extract_article_figures(html, base_url, figure_id_map)
    if article_figs:
        parts.append(article_figs + "\n")

    def render_section(section, level=2):
        """Recursively render a section and its children to markdown."""
        blocks = []
        if section.anchor:
            blocks.append(f'<h{level} id="{section.anchor}">{section.title}</h{level}>\n')
        else:
            heading = "#" * level
            blocks.append(f"{heading} {section.title}\n")
        if section.html:
            html = convert_span_tables(section.html)
            html = expand_spans(html)
            blocks.append(
                convert_fragment_to_markdown(html, remove_inline_citations=True)
                + "\n"
            )
        for child in section.children:
            blocks.append(render_section(child, level + 1))
        return "\n".join(blocks)

    for s in sections:
        parts.append(render_section(s))

    result = "\n".join(parts)
    result = fix_figures(result, base_url, figure_id_map)
    result = fix_table_captions(result, figure_id_map)
    result = fix_display_math(result)
    title = parsed.title or f"arXiv:{arxiv_id}"
    print(json.dumps({"markdown": result, "title": title, "id": arxiv_id}))


asyncio.run(main())
