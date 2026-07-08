"""One-off export of the top-10k English word forms (wordfreq) used by the
app's tier-2 typo guard (PLAN.md §7.2): a word the user typed that is
itself a real dictionary word is never treated as a typo of something else
(want/went, than/then, lose/loose).

Run manually when wordfreq's data updates; not part of the `etr` CLI
pipeline since it's a static asset for `app/`, not a pack-build step.
"""

from __future__ import annotations

import json
from pathlib import Path

from wordfreq import top_n_list

OUT_PATH = Path(__file__).resolve().parents[2] / "app" / "src" / "checker" / "topWords.json"


def main() -> None:
    words = top_n_list("en", 10_000)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(words, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(words)} words to {OUT_PATH}")


if __name__ == "__main__":
    main()
