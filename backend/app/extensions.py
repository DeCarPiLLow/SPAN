import redis as redis_lib
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate

db = SQLAlchemy()
jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=get_remote_address)
migrate = Migrate()
redis_client = None


def init_redis(app):
    global redis_client
    redis_client = redis_lib.from_url(
        app.config['REDIS_URL'],
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
    )
    return redis_client
