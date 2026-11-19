"""Small model boundary. The only permitted model action returns drawing observations."""

import base64
import json
import os
import subprocess
from io import BytesIO
from pathlib import Path
from urllib import error, request
from urllib.parse import urlparse

from PIL import Image, ImageOps

from .family_edits import edit_schema, record
from .observation import (
    draft_edits,
    draft_instructions,
    instructions,
    measurement_instructions,
    observations,
)

OPENROUTER_API = "https://openrouter.ai/api/v1"


class DrawingOnlyAdapter(ValueError):
    """An older adapter answered a family review with its drawing operation."""


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, *_):
        return None


def fetch_json(url, key, body=None):
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    payload = json.dumps(body).encode() if body is not None else None
    try:
        with request.build_opener(NoRedirect()).open(
            request.Request(url, data=payload, headers=headers), timeout=150
        ) as response:
            return json.load(response)
    except error.HTTPError as exc:
        raise RuntimeError(f"Model endpoint returned HTTP {exc.code}") from exc


def openrouter_model(model):
    """Resolve only an exact catalog ID or its unique unqualified suffix."""
    catalog = fetch_json(
        OPENROUTER_API + "/models", os.environ.get("OPENROUTER_API_KEY")
    )
    matches = {
        row["id"]
        for row in catalog["data"]
        if row["id"] == model or row["id"].partition("/")[2] == model
    }
    if len(matches) != 1:
        raise ValueError(
            f"Expected one exact OpenRouter catalog match for {model}, found {len(matches)}"
        )
    return matches.pop()


def image_url(path):
    with Image.open(path) as source:
        im = ImageOps.exif_transpose(source).convert("RGBA")
        im.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
        bg = Image.new("RGBA", im.size, "white")
        bg.alpha_composite(im)
        out = BytesIO()
        bg.convert("RGB").save(out, format="JPEG", quality=93)
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode("ascii")


def ask(args, images, feedback, draft=None, measured_pass=None):
    prompt = instructions
    can_edit = draft is not None or measured_pass is not None
    if can_edit:
        prompt = measurement_instructions + "\n" + draft_instructions
        if draft is not None:
            prompt += "\nProposed source observation (base_pass 0)\n" + json.dumps(
                draft, separators=(",", ":")
            )
        else:
            prompt += f"\nThe source needed manual landmarks. Revise base_pass {measured_pass} using the measurements in the review."
    if feedback:
        prompt += (
            "\nReview the prior result. Correct the observations that explain the largest visible discrepancies.\n"
            + feedback
        )
    operation = {
        "type": "function",
        "name": "draw_cartoon",
        "description": "Measure a front T-pose and select cartoon features.",
        "strict": True,
        "parameters": observations,
    }
    compact = {
        "type": "function",
        "name": "draw_from_draft",
        "description": draft_instructions,
        "strict": True,
        "parameters": draft_edits,
    }
    operations = [operation, compact] if can_edit else [operation]
    return request_drawing(
        args, prompt, images, operations, compact if can_edit else operation
    )


def request_drawing(args, prompt, images, operations, selected):
    from time import monotonic

    started = monotonic()
    if args.adapter:
        # The executable belongs to the operator. Model output is never executed.
        envelope = {
            "version": 1,
            "model": args.model,
            "prompt": prompt,
            "tools": operations,
            "images": [str(Path(p).resolve()) for p in images],
        }
        run = subprocess.run(
            [args.adapter],
            input=json.dumps(envelope),
            text=True,
            capture_output=True,
            timeout=150,
            check=True,
        )
        result = json.loads(run.stdout)
        if result["model"] != args.model:
            raise ValueError("Adapter returned a different model")
        return result["arguments"], {
            "transport": "adapter",
            "reported_model": result["model"],
            "request_id": result.get("request_id"),
            "seconds": round(monotonic() - started, 3),
            "usage": result.get("usage"),
        }
    # A gateway can implement this public protocol or use the executable adapter.
    router = getattr(args, "openrouter", False)
    url = (
        OPENROUTER_API + "/responses"
        if router
        else (args.endpoint or os.environ.get("AVATAR_RESPONSES_URL", ""))
    )
    if urlparse(url).scheme != "https":
        raise ValueError("Supply an HTTPS Responses endpoint or --adapter")
    key = os.environ.get("OPENROUTER_API_KEY" if router else "AVATAR_MODEL_API_KEY")
    content = [{"type": "input_text", "text": prompt}] + [
        {"type": "input_image", "image_url": image_url(p)} for p in images
    ]
    # The hosted call gets one strict tool. Older executable adapters keep the
    # full drawing tool as their first entry and may adopt the compact form.
    body = {
        "model": args.model,
        "input": [{"role": "user", "content": content}],
        "tools": [selected],
        "tool_choice": {"type": "function", "name": selected["name"]},
        "parallel_tool_calls": False,
    }

    response = fetch_json(url, key, body)
    if response.get("model") != args.model:
        raise ValueError(
            f"Endpoint reported a different model: {response.get('model')}"
        )
    calls = [
        item
        for item in response.get("output", [])
        if item.get("type") == "function_call"
    ]
    if len(calls) != 1 or calls[0].get("name") != selected["name"]:
        raise ValueError(f"Expected one {selected['name']} operation")
    return json.loads(calls[0]["arguments"]), {
        "transport": "openrouter" if router else "responses",
        "reported_model": response["model"],
        "request_id": response.get("id"),
        "seconds": round(monotonic() - started, 3),
        "usage": response.get("usage"),
    }


def review_family(args, source, directory, candidate, report, feedback=""):
    schema = edit_schema(
        candidate["family"], candidate.get("construction", "registered")
    )
    operation = {
        "type": "function",
        "name": "review_avatar_family",
        "strict": True,
        "description": "Review the likeness and propose bounded edits to this native family.",
        "parameters": record(
            {
                "use_family": {"type": "boolean"},
                "reason": {"type": "string"},
                "edits": schema,
            }
        ),
    }
    guidance = (
        "The household uses a measured skull and two individually fitted eyes. "
        "Use the named design fields for garment, cap, eye size, placement and color. "
        if candidate.get("construction") == "household"
        else "Proportion values are absolute multipliers, with 1 the registered shape. "
        "crownProfile scales the tips at eight clockwise directions from image right. "
        "A shirt mark is one filled outline in the shirt box, x right and y down from 0 to 1. "
        "Use {sample:[u,v]} to trace a solid print directly from the original shirt pixels. "
    )
    prompt = (
        "The images show the target T-pose, fitted native front, and native turnaround. "
        "Compare face, eyes, clothing, paint and markings. Use the family if its underlying "
        "construction suits the target. Return edits only for visible discrepancies. "
        f"{guidance}"
        "The native check can supply an interior shirt_mark_sample. An empty edit list keeps the fit. If the target needs different parts, set "
        "use_family to false and leave edits empty. Hidden surfaces inherit the registered "
        "family. Judge their anatomical consistency.\n"
        f"Suggested native measurements: {json.dumps(report.get('suggested_edits', []))}\n"
        f"Candidate: {json.dumps(candidate)}\nNative front checks: {json.dumps(report['front'])}"
    )
    if feedback:
        prompt += "\nPrevious edit rejected: " + feedback
    images = [source, directory / "front.png", directory / "turnaround.png"]
    if (directory / "shirt-comparison.png").is_file():
        images.append(directory / "shirt-comparison.png")
        prompt += (
            "\nThe last image enlarges the registered shirt boxes, source on the left."
        )
    decision, receipt = request_drawing(args, prompt, images, [operation], operation)
    if (
        args.adapter
        and isinstance(decision, dict)
        and "use_family" not in decision
        and ("landmarks" in decision or "edits" in decision)
    ):
        raise DrawingOnlyAdapter(
            "The adapter returned a drawing to the likeness review"
        )
    if (
        not isinstance(decision, dict)
        or set(decision)
        not in ({"use_family", "reason"}, {"use_family", "reason", "edits"})
        or type(decision.get("use_family")) is not bool
        or not isinstance(decision.get("reason"), str)
    ):
        raise ValueError("Expected a family likeness review")
    edits = decision.get("edits", [])  # Accept the original binary-review envelope.
    if not isinstance(edits, list) or (edits and not decision["use_family"]):
        raise ValueError("Family edits require use_family")
    return {**decision, "edits": edits}, {**receipt, "operation": operation["name"]}
