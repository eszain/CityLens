from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:54322/postgres"
    cors_origins: str = "http://localhost:3000"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    enable_ai_scoring: bool = False

    openaq_api_key: str | None = None
    nasa_firms_map_key: str | None = None
    sentinel_hub_client_id: str | None = None
    sentinel_hub_client_secret: str | None = None

    watsonx_api_key: str | None = None
    watsonx_project_id: str | None = None
    watsonx_url: str | None = None
    watsonx_space_id: str | None = None

    toronto_bbox: str = "-79.65,43.58,-79.12,43.85"
    city_slug_default: str = "toronto"

    equity_alert_threshold: float = 0.35


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
