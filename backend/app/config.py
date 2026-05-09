from functools import lru_cache
from typing import Self

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.db_url import resolve_database_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str | None = None
    supabase_db_url: str | None = Field(default=None, validation_alias="SUPABASE_DB_URL")
    supabase_url: str | None = Field(default=None, validation_alias="SUPABASE_URL")
    supabase_anon_key: str | None = Field(default=None, validation_alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"),
    )

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

    # IBM Cloud Object Storage — used by watsonx.data archiving
    cos_api_key: str | None = None
    cos_instance_crn: str | None = None
    cos_endpoint: str = "https://s3.us-south.cloud-object-storage.appdomain.cloud"
    cos_bucket: str = "citylens-archive"

    toronto_bbox: str = "-79.65,43.58,-79.12,43.85"
    city_slug_default: str = "toronto"

    equity_alert_threshold: float = 0.35

    @model_validator(mode="after")
    def finalize_database_url(self) -> Self:
        url, err = resolve_database_url(
            self.database_url,
            supabase_db_url=self.supabase_db_url,
            supabase_url=self.supabase_url,
        )
        if err:
            raise ValueError(err)
        assert url is not None
        self.database_url = url
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
