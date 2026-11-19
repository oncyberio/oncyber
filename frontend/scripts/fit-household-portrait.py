"""Fit a Rick-family household recipe to a portrait and observation guide."""

import argparse
import json
from pathlib import Path

from avatar_authoring.household import fit_portrait as fit

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("portrait", type=Path)
    parser.add_argument("guide", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    recipe = fit(args.portrait, json.loads(args.guide.read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(recipe, separators=(",", ":"), allow_nan=False) + "\n"
    )
