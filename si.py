"""SI layer: Gemini writes the interpretation, then every number in it is checked against the facts.

A sentence whose numbers do not all appear in the facts is removed before anything is shown.
"""
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

MODELS = ["gemini-3.1-flash-lite", "gemma-4-31b-it"]  # second is the fallback when the first is out of quota
URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

PROMPT = """You are writing for an aerospace engineer reviewing fire safety evidence for a crewed habitat.
Below is a JSON summary of NASA microgravity combustion test records that match their habitat design.

Write one paragraph of 110 to 150 words that interprets it:
- say which materials have flame tests near the habitat's oxygen level and which do not
- say what the gravity comparison (GSI) shows, if the facts include one
- say what the droplet and gas-flame counts show
- end with the single most important limit of this evidence

Rules:
- Use only the JSON. Add no outside knowledge and no advice about what is safe.
- Write every number as digits, exactly as it appears in the JSON. Do not calculate new numbers,
  percentages or differences.
- Plain sentences. No headings, no bullet points, no markdown.

JSON:
{facts}
"""

NUMBER = re.compile(r"(?<![A-Za-z\d.])\d+(?:\.\d+)?")


def api_key():
    try:
        import streamlit as st
        if "GEMINI_API_KEY" in st.secrets:
            return st.secrets["GEMINI_API_KEY"]
    except Exception:
        pass
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    env = Path(__file__).resolve().parent / "keys.env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip()
    return None


def _call(model, prompt, key):
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024}}).encode()
    req = urllib.request.Request(URL.format(model=model), data=body,
                                 headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    parts = data["candidates"][0]["content"]["parts"]
    return " ".join(p["text"] for p in parts if "text" in p and not p.get("thought")).strip()


def _numbers(text):
    return [round(float(x), 2) for x in NUMBER.findall(text)]


def verify(text, facts):
    """Keep only sentences whose numbers all appear in the facts. Returns the kept text and counts."""
    allowed = set(_numbers(json.dumps(facts)))
    kept, total, good, dropped = [], 0, 0, 0
    for sentence in re.split(r"(?<=[.!?])\s+", text.replace("\n", " ").strip()):
        if not sentence:
            continue
        found = _numbers(re.sub(r"\b1\s?g\b", "", sentence))  # "1g" is a name, not a data value
        ok = [n in allowed for n in found]
        total += len(found)
        good += sum(ok)
        if all(ok):
            kept.append(sentence)
        else:
            dropped += 1
    return {"text": " ".join(kept), "total": total, "verified": good, "dropped": dropped}


def interpret(facts):
    """Returns {"text", "model", "total", "verified", "dropped"} or {"error": reason}."""
    key = api_key()
    if not key:
        return {"error": "No SI key is configured."}
    prompt = PROMPT.format(facts=json.dumps(facts, ensure_ascii=False))
    last = "unknown error"
    for model in MODELS:
        try:
            raw = _call(model, prompt, key)
        except urllib.error.HTTPError as err:
            last = f"{model}: HTTP {err.code}"
            continue
        except Exception as err:  # network failure, unexpected response shape
            last = f"{model}: {type(err).__name__}"
            continue
        if raw:
            return {**verify(raw, facts), "model": model, "raw": raw}
        last = f"{model}: empty reply"
    return {"error": f"The SI service did not answer ({last})."}
