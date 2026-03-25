import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env from the backend directory automatically
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))


class Config:
    SECRET_KEY      = os.environ.get('JWT_SECRET_KEY', 'dev-secret-change-me')
    JWT_SECRET_KEY  = os.environ.get('JWT_SECRET_KEY', 'dev-secret-change-me')
    JWT_ACCESS_TOKEN_EXPIRES  = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'postgresql://spotifyuser:spotifypass@localhost:5432/spotify_analyzer'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 5,
        'pool_recycle': 300,
        'pool_pre_ping': True,
    }

    REDIS_URL              = os.environ.get('REDIS_URL',              'redis://localhost:6379/0')
    CELERY_BROKER_URL      = os.environ.get('CELERY_BROKER_URL',      'redis://localhost:6379/1')
    CELERY_RESULT_BACKEND  = os.environ.get('CELERY_RESULT_BACKEND',  'redis://localhost:6379/2')

    SPOTIFY_CLIENT_ID    = os.environ.get('SPOTIFY_CLIENT_ID', '')
    SPOTIFY_CLIENT_SECRET = os.environ.get('SPOTIFY_CLIENT_SECRET', '')
    SPOTIFY_REDIRECT_URI = os.environ.get('SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:80/callback')

    TOKEN_ENCRYPTION_KEY = os.environ.get('TOKEN_ENCRYPTION_KEY', '')

    RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    RATELIMIT_DEFAULT     = '200 per hour'

    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:80')
    SPOTIFY_MAU  = 600_000_000


class DevelopmentConfig(Config):
    DEBUG              = True
    SQLALCHEMY_ECHO    = False


class ProductionConfig(Config):
    DEBUG = False


class TestingConfig(Config):
    TESTING               = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


config = {
    'development': DevelopmentConfig,
    'production':  ProductionConfig,
    'testing':     TestingConfig,
    'default':     DevelopmentConfig,
}
