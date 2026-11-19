"""Render a candidate for promotion or record its independent visual assessment."""

import argparse
import json
from pathlib import Path

from avatar_authoring.release import CHECKS, digest, evidence, record_decision

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recipe", type=Path)
    parser.add_argument("reference", type=Path)
    parser.add_argument("folder", type=Path)
    parser.add_argument(
        "--decision",
        type=Path,
        help="A separate visual review JSON including reviewer, kind, evidence SHA-256 and boolean checks",
    )
    parser.add_argument("--base", default="http://localhost:13000")
    parser.add_argument("--max-triangles", type=int, default=4000)
    parser.add_argument("--framing", choices=["portrait", "full"], default="full")
    parser.add_argument("--yaw", type=int, choices=[-35, 0, 35], default=0)
    parser.add_argument(
        "--register-feature",
        type=Path,
        help="Register the fitted feature from an approved study",
    )
    parser.add_argument(
        "--feature-library",
        type=Path,
        default=Path(__file__).parent / "avatar_authoring/features",
    )
    parser.add_argument(
        "--vision-model", dest="model", help="Independent visual reviewer model"
    )
    provider = parser.add_mutually_exclusive_group()
    provider.add_argument("--adapter")
    provider.add_argument("--openrouter", action="store_true")
    provider.add_argument("--endpoint")
    parser.add_argument(
        "--install",
        metavar="SLUG",
        help="Install the exact reviewed recipe in the native catalogue",
    )
    parser.add_argument(
        "--replace-digest", help="Digest of the installed recipe to replace"
    )
    args = parser.parse_args()
    if (
        sum(
            bool(v)
            for v in (args.register_feature, args.decision, args.model, args.install)
        )
        > 1
    ):
        parser.error("Choose one release action")
    if args.replace_digest and not args.install:
        parser.error("--replace-digest requires --install")
    if args.model and (
        not any((args.adapter, args.openrouter, args.endpoint))
        or args.decision
        or args.register_feature
    ):
        parser.error(
            "A vision review requires one provider and existing native evidence"
        )
    if args.install:
        from avatar_authoring.install import install
        from avatar_authoring.release import require_release

        report = require_release(args.recipe, args.folder)
        if digest(args.reference) != report["reference"]:
            parser.error("The reference differs from the approved release")
        print(
            install(
                args.recipe,
                args.install,
                release=args.folder,
                previous=args.replace_digest,
            )
        )
    elif args.register_feature:
        from avatar_authoring.feature_library import register_feature

        print(
            register_feature(
                args.feature_library, args.register_feature, args.recipe, args.folder
            )
        )
    elif args.model:
        from avatar_authoring.release import vision_decision

        vision_decision(args.recipe, args.reference, args.folder, args)
        print("Approved", args.recipe)
    elif args.decision:
        record_decision(
            args.recipe,
            args.reference,
            args.folder,
            json.loads(args.decision.read_text()),
        )
        print("Approved", args.recipe)
    else:
        evidence(
            args.recipe,
            args.reference,
            args.folder,
            args.base,
            args.max_triangles,
            args.framing,
            args.yaw,
        )
        print(
            "Evidence",
            digest(args.folder / "evidence.json"),
            "Visual checks:",
            ", ".join(CHECKS),
        )
