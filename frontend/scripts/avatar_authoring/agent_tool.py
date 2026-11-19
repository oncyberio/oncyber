"""Expose a single T-pose and its drawing tool to a local MCP client."""

import asyncio
import base64
import json

from mcp import types
from mcp.server.lowlevel import Server
from mcp.server.lowlevel.helper_types import ReadResourceContents
from mcp.server.stdio import stdio_server

from .family import FAMILIES, FAMILY_TOOL
from .family_edits import REVISION_TOOL, edit_schema
from .install import install
from .observation import draft_edits, draft_instructions, instructions, observations
from .provider import image_url
from .study import Study


async def serve(args):
    study = Study(args)
    within = getattr(args, "within_family", None)
    draft = None if within else study.prepare_draft(args.name)
    server = Server(
        "oncyber-cartoon",
        instructions="Use fit_avatar_family for variations of the fitted scientist and Sunshine mascot. Use revise_avatar_family to edit a rendered candidate by its hash. Read the T-pose and coordinate guide. If a proposed observation exists, compare its pass-zero body and portrait resources with the source. Otherwise use draw_cartoon to place the landmarks. Use draw_from_draft for targeted edits to the proposal or a saved drawing. "
        "The result includes the native portraits, silhouette comparison and the accepted recipe.",
    )
    refs = {
        "cartoon://input/source": ("Original T-pose", study.source),
        "cartoon://input/guide": (
            "Full-frame coordinate rulers and face detail",
            study.guide,
        ),
    }
    draft_uri = "cartoon://input/draft"
    if study.profile:
        refs["cartoon://input/profile"] = (
            "Side guide for fitting depth",
            study.profile,
        )
    if study.fit_quarter:
        refs["cartoon://input/quarter"] = (
            "35 degree portrait fit guide",
            study.quarter,
        )
    previews = {
        "cartoon://input/preview/turn": ("Pass zero head turnaround", "turnaround.png"),
        "cartoon://input/preview/body": (
            "Pass zero body and silhouette comparison",
            "comparison.png",
        ),
        "cartoon://input/preview/face": (
            "Pass zero face and portrait turns",
            "portrait-review.png",
        ),
    }
    lock = asyncio.Lock()

    @server.list_resources()
    async def resources():
        return [
            types.Resource(uri=uri, name=name, mimeType="image/jpeg")
            for uri, (name, _) in refs.items()
        ] + (
            [
                types.Resource(
                    uri=draft_uri,
                    name="Proposed observation",
                    mimeType="application/json",
                ),
                *(
                    types.Resource(uri=uri, name=name, mimeType="image/png")
                    for uri, (name, _) in previews.items()
                ),
            ]
            if draft is not None
            else []
        )

    @server.read_resource()
    async def resource(uri):
        key = str(uri)
        if key == draft_uri and draft is not None:
            return [ReadResourceContents(json.dumps(draft), "application/json")]
        if key in previews and draft is not None:
            async with lock:
                preview = await asyncio.to_thread(study.preview, draft)
                if preview is None:
                    raise ValueError(study.summary["preview_unavailable"])
                directory, _ = preview
                return [
                    ReadResourceContents(
                        (directory / previews[key][1]).read_bytes(), "image/png"
                    )
                ]
        if key not in refs:
            raise ValueError("Unknown drawing resource")
        data = image_url(refs[key][1]).split(",", 1)[1]
        return [ReadResourceContents(base64.b64decode(data), "image/jpeg")]

    family_results = {}
    candidates = {}
    revisions = {}
    selected_recipe = None
    selected_rank = None

    single_front = not any(
        (study.profile, study.opposite, study.quarter, study.skull_part)
    )

    @server.list_tools()
    async def tools():
        family_tools = (
            [types.Tool(**tool) for tool in (FAMILY_TOOL, REVISION_TOOL)]
            if single_front
            else []
        )
        if within:
            allowed_edits = within
            fitted = family_results.get(within)
            if within == "auto":
                allowed_edits = fitted[1].get("family") if fitted else None
            family_tools[0].inputSchema = {
                **FAMILY_TOOL["inputSchema"],
                "properties": {
                    "family": {
                        "type": "string",
                        "enum": ["auto"] if within == "auto" else ["auto", within],
                    }
                },
            }
            schema = REVISION_TOOL["inputSchema"]
            family_tools[1].inputSchema = {
                **schema,
                "properties": {
                    **schema["properties"],
                    "edits": {
                        **edit_schema(
                            allowed_edits,
                            fitted[1].get("construction", "registered")
                            if fitted
                            else None,
                        ),
                        "minItems": 1,
                    },
                },
            }
            return family_tools
        return family_tools + [
            types.Tool(
                name="draw_cartoon", description=instructions, inputSchema=observations
            ),
            types.Tool(
                name="draw_from_draft",
                description=draft_instructions,
                inputSchema=draft_edits,
            ),
        ]

    @server.call_tool()
    async def draw(name, arguments):
        nonlocal selected_recipe, selected_rank
        if name in ("fit_avatar_family", "revise_avatar_family"):
            if not single_front:
                raise ValueError(
                    "Use draw_cartoon to include the additional guides in the fit"
                )
            from .family_review import fit_and_refine, revise_family
            from .family_trials import family_rank

            async with lock:
                if name == "fit_avatar_family":
                    family = arguments.get("family")
                    if set(arguments) != {"family"} or family not in (
                        "auto",
                        *FAMILIES,
                    ):
                        raise ValueError("Choose a known family")
                    if within:
                        if family not in ("auto", within):
                            raise ValueError("This study requires " + within)
                        family = within
                    if family not in family_results:
                        folder, report, _ = await asyncio.to_thread(
                            fit_and_refine,
                            study.source,
                            study.run,
                            family,
                            args.name,
                            study.base,
                            study.backend,
                            study.budget,
                            revisions=args.rounds if within else 0,
                            within=bool(within),
                        )
                        family_results[family] = folder, report
                    folder, report = family_results[family]
                else:
                    digest = arguments["base_recipe_sha256"]
                    if digest not in candidates:
                        raise ValueError("Unknown base recipe in this image study")
                    edits = arguments["edits"]
                    key = (digest, json.dumps(edits, sort_keys=True))
                    if key not in revisions:
                        revisions[key] = await asyncio.to_thread(
                            revise_family,
                            study.source,
                            candidates[digest],
                            edits,
                            study.base,
                            study.backend,
                            study.budget,
                        )
                    folder, report = revisions[key]
                payload = {**report, "study": str(folder)}
                payload["candidates"] = {
                    k: {
                        field: v
                        for field, v in candidate.items()
                        if field != "paint_probes"
                    }
                    for k, candidate in report["candidates"].items()
                }
                if "native" in report:
                    candidates[report["recipe_sha256"]] = folder
                    payload["candidate"] = json.loads(
                        (folder / "candidate.json").read_text()
                    )
                if report["accepted"]:
                    rank = family_rank(report)
                    if not within or selected_rank is None or rank > selected_rank:
                        selected_rank = rank
                        selected_recipe = folder / "recipe.json"
                    payload["recipe"] = payload["candidate"]
                if within and selected_recipe:
                    payload["selected_study"] = str(selected_recipe.parent)
                result = [types.TextContent(type="text", text=json.dumps(payload))]
                view = folder / (
                    "turnaround.png" if "native" in report else "silhouettes.png"
                )
                for image_path in (view, folder / "shirt-comparison.png"):
                    if image_path.is_file():
                        result.append(
                            types.ImageContent(
                                type="image",
                                data=base64.b64encode(image_path.read_bytes()).decode(),
                                mimeType="image/png",
                            )
                        )
                return result
        if within or name not in ("draw_cartoon", "draw_from_draft"):
            raise ValueError("Unknown drawing operation")
        async with lock:
            receipt = {"transport": "mcp", "operation": name}
            directory, metrics = await asyncio.to_thread(
                study.draw, arguments, receipt, draft
            )
            observed = json.loads((directory / "observations.json").read_text())
            report = {
                "pass": directory.name,
                "base_pass": study.summary["attempts"][-1]["pass"],
                "metrics": metrics,
                "triangle_budget": study.budget,
                "selected": study.summary.get("selected"),
                "study": str(study.run),
                "source_sha256": study.summary["source_sha256"],
                "review_notes": observed["unsupported"],
                "needs_review": study.summary.get("needs_review", True),
                "depth_review": study.summary.get("depth_review"),
            }
            if study.best is not None:
                selected_recipe = study.run / "recipe.json"
                report["recipe"] = json.loads(selected_recipe.read_text())
            result = [
                types.TextContent(
                    type="text", text=json.dumps(report, separators=(",", ":"))
                )
            ]
            for view in (
                "comparison.png",
                "portrait-review.png",
                "turnaround.png",
                "side-comparison.png",
                "opposite-comparison.png",
                "quarter-comparison.png",
                "quarter-expression-review.png",
            ):
                if not (directory / view).is_file():
                    continue
                data = (directory / view).read_bytes()
                result.append(
                    types.ImageContent(
                        type="image",
                        data=base64.b64encode(data).decode(),
                        mimeType="image/png",
                    )
                )
            return result

    async with stdio_server() as (reader, writer):
        await server.run(reader, writer, server.create_initialization_options())
    if args.install and selected_recipe is not None:
        install(selected_recipe, args.install, release=args.release, previous=args.replace_digest)
