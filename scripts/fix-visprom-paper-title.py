#!/usr/bin/env python3
"""Set PDF document title (e.g. fix placeholder 'To do' -> 'Visprom++')."""
import sys
from pathlib import Path

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    print("pypdf not installed; run: pip3 install pypdf", file=sys.stderr)
    sys.exit(1)


def set_title(source: Path, dest: Path, title: str) -> None:
    reader = PdfReader(str(source))
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    if reader.metadata:
        meta = {k: v for k, v in reader.metadata.items() if v}
    else:
        meta = {}
    meta["/Title"] = title
    writer.add_metadata(meta)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "wb") as handle:
        writer.write(handle)


def main() -> int:
    if len(sys.argv) < 4:
        print("usage: fix-visprom-paper-title.py <source.pdf> <dest.pdf> <title>", file=sys.stderr)
        return 1
    source = Path(sys.argv[1])
    dest = Path(sys.argv[2])
    title = sys.argv[3]
    if not source.is_file():
        print(f"source not found: {source}", file=sys.stderr)
        return 1
    set_title(source, dest, title)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
