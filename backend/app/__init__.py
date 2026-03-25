import os
from flask import Flask
from .config import config
from .extensions import db, jwt, cors, limiter, migrate, init_redis


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config['default']))

    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app,
                  resources={r"/api/*": {"origins": app.config.get('FRONTEND_URL', '*')}},
                  supports_credentials=True)
    limiter.init_app(app)
    migrate.init_app(app, db)
    init_redis(app)

    from .api.auth.routes       import auth_bp
    from .api.personal.routes   import personal_bp
    from .api.global_data.routes import global_bp
    from .api.comparison.routes import comparison_bp
    from .api.deep_dive.routes  import deep_dive_bp
    from .api.engagement.routes import engagement_bp
    from .api.player.routes     import player_bp

    app.register_blueprint(auth_bp,       url_prefix='/api/auth')
    app.register_blueprint(personal_bp,   url_prefix='/api/me')
    app.register_blueprint(global_bp,     url_prefix='/api/global')
    app.register_blueprint(comparison_bp, url_prefix='/api/compare')
    app.register_blueprint(deep_dive_bp,  url_prefix='/api/deep')
    app.register_blueprint(engagement_bp, url_prefix='/api/engage')
    app.register_blueprint(player_bp,     url_prefix='/api/player')

    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'version': '1.0.0'}

    return app
