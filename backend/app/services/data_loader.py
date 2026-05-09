"""Load block attributes, FIRMS hotspots, and air quality from Supabase into DataFrames."""

from __future__ import annotations

import logging

import pandas as pd

logger = logging.getLogger(__name__)


async def load_all_sources(
    conn, city_slug: str = "toronto"
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Returns (blocks_df, hotspots_df, air_df).

    blocks_df — one row per city block with attributes + nearest PM2.5
    hotspots_df — raw FIRMS brightness readings over the last 30 days (for TTM input)
    air_df — hourly-ish OpenAQ readings over the last 48 hours
    """
    block_rows = await conn.fetch(
        """
        SELECT
            b.id::text            AS block_id,
            ST_Y(ST_Centroid(b.geom)) AS lat,
            ST_X(ST_Centroid(b.geom)) AS lon,
            b.lst_mean_c,
            b.canopy_pct,
            b.vulnerability_score,
            d.income_median_cad,
            d.low_income_flag
        FROM blocks b
        JOIN cities c ON c.id = b.city_id
        LEFT JOIN LATERAL (
            SELECT income_median_cad, low_income_flag
            FROM demographics dem
            WHERE dem.block_id = b.id
            ORDER BY census_year DESC
            LIMIT 1
        ) d ON true
        WHERE c.slug = $1
        ORDER BY b.external_id
        LIMIT 5000
        """,
        city_slug,
    )
    blocks_df = pd.DataFrame([dict(r) for r in block_rows])

    aq_rows = await conn.fetch(
        """
        SELECT a.observed_at, a.pm25, a.pm10,
               ST_Y(a.location) AS lat, ST_X(a.location) AS lon
        FROM air_quality_readings a
        JOIN cities c ON c.id = a.city_id
        WHERE c.slug = $1
          AND a.observed_at >= now() - INTERVAL '48 hours'
        ORDER BY a.observed_at DESC
        LIMIT 2000
        """,
        city_slug,
    )
    air_df = pd.DataFrame([dict(r) for r in aq_rows])

    firms_rows = await conn.fetch(
        """
        SELECT f.observed_at, f.brightness
        FROM firms_hotspots f
        JOIN cities c ON c.id = f.city_id
        WHERE c.slug = $1
          AND f.observed_at >= now() - INTERVAL '30 days'
        ORDER BY f.observed_at ASC
        LIMIT 5000
        """,
        city_slug,
    )
    hotspots_df = pd.DataFrame([dict(r) for r in firms_rows])

    # Attach city-wide mean PM2.5 to all blocks (nearest-sensor join is done at ingest time)
    if not blocks_df.empty:
        mean_pm25 = (
            float(air_df["pm25"].dropna().mean())
            if not air_df.empty and "pm25" in air_df.columns and not air_df["pm25"].dropna().empty
            else 15.0
        )
        blocks_df["pm25"] = mean_pm25

    logger.info(
        "data_loader: %d blocks | %d AQ rows | %d FIRMS rows [city=%s]",
        len(blocks_df),
        len(air_df),
        len(hotspots_df),
        city_slug,
    )
    return blocks_df, hotspots_df, air_df
