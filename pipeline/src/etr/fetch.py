"""Download the manythings rus-eng corpus into data/raw/ (§4.1, §4.2).

Idempotent: skips the download if the archive already exists, unless
``force=True``. manythings.org returns 406 to clients without a browser
User-Agent (observed 2026-07-07), so we always send one.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

import httpx

RUS_ENG_URL = "https://www.manythings.org/anki/rus-eng.zip"
_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def fetch(data_dir: Path, *, force: bool = False) -> Path:
    """Download and extract rus-eng.zip; return the path to rus.txt."""
    raw_dir = data_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    zip_path = raw_dir / "rus-eng.zip"
    txt_path = raw_dir / "rus.txt"

    if txt_path.exists() and not force:
        return txt_path

    with httpx.Client(headers={"User-Agent": _BROWSER_UA}, follow_redirects=True) as client:
        response = client.get(RUS_ENG_URL, timeout=60.0)
        response.raise_for_status()
        zip_path.write_bytes(response.content)

    with zipfile.ZipFile(zip_path) as archive:
        archive.extract("rus.txt", raw_dir)

    return txt_path
