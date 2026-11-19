"""Register a reviewed recipe at a stable native model URL."""

import fcntl
import json
import os
import re
import tempfile
from pathlib import Path

from .release import digest, require_release


def install(path, slug, catalogue=None, *, release=None, previous=None):
    if not re.fullmatch("[a-z][a-z0-9-]{0,63}", slug):
        raise ValueError("Use a lowercase model slug of at most 64 characters")
    catalogue = (
        catalogue
        or Path(__file__).resolve().parents[2] / "public/lobby/procedural/recipes"
    )
    catalogue.mkdir(parents=True, exist_ok=True)
    target = catalogue / (slug + ".json")
    snapshot = path.read_bytes()
    data = json.loads(snapshot)
    encoded = json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n"
    fd = os.open(catalogue, os.O_RDONLY)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        if not target.exists() or json.loads(target.read_text()) != data:
            if target.exists() and previous != digest(target):
                raise ValueError(
                    f"Another recipe already uses {slug}. Supply its current digest to replace it."
                )
            if not target.exists() and previous is not None:
                raise ValueError("The previous recipe no longer exists")
            require_release(path, release)
            if snapshot != path.read_bytes():
                raise ValueError("Candidate changed during promotion")
            with tempfile.NamedTemporaryFile(
                mode="w", dir=catalogue, delete=False
            ) as tmp:
                tmp.write(encoded)
            os.replace(tmp.name, target)
    finally:
        os.close(fd)
    return "/models/procedural/drawn-" + slug
