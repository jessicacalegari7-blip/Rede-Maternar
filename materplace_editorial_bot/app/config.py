from dataclasses import dataclass
from os import getenv
from zoneinfo import ZoneInfo

@dataclass(frozen=True)
class Settings:
    mode: str = getenv("EDITORIAL_MODE", "mock")
    timezone: str = getenv("TIMEZONE", "America/Sao_Paulo")
    max_articles_per_run: int = int(getenv("MAX_ARTICLES_PER_RUN", "1"))
    max_articles_per_day: int = int(getenv("MAX_ARTICLES_PER_DAY", "3"))
    min_editorial_score: float = float(getenv("MIN_EDITORIAL_SCORE", "70"))
    supabase_url: str = getenv("SUPABASE_URL", "")
    supabase_key: str = getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    openai_model: str = getenv("OPENAI_MODEL", "gpt-5-mini")

    def validate(self) -> None:
        ZoneInfo(self.timezone)
        if self.mode not in {"mock", "live"}:
            raise ValueError("EDITORIAL_MODE deve ser mock ou live")

