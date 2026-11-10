# Python reference geometry

`python-geometry.json` was generated directly from:

- `parliamentarch.geometry.get_seats_centers` in ParliamentArch 1.1.2
  (Copyright 2024 Gouvernathor; license in ../../licenses/parliamentarch-LICENSE).
- `westminster.seats` in slashme/parliamentdiagram at commit
  a4e01c574216a64a859ac693d26a37ae0f13ea84
  (Copyright 2026 David Richfield; license in ../../LICENSE).

Arch positions are sorted by angle descending, as in get_svg_from_attribution.
Westminster positions preserve upstream per-area order. The fixture records
inputs alongside outputs so the JavaScript tests verify the translated geometry
against the Python result rather than reproducing the JavaScript implementation.
