from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ekileakure"
    SECRET_KEY: str = "dev-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_list(self) -> list:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

settings = Settings()