"""Decode json/jsonb values that asyncpg may return as plain strings."""

from __future__ import annotations

import json
from typing import Any


def decode_pg_json(value: Any) -> Any:
    """If Postgres ::json / jsonb arrives as a str, parse once for API / Mapbox consumers."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def as_geojson_properties(value: Any) -> dict[str, Any]:
    """JSONB feature properties must be a mapping for **merge and GeoJSON validity."""
    decoded = decode_pg_json(value)
    if isinstance(decoded, dict):
        return decoded
    return {}
