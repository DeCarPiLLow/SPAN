"""
Celery worker entry point.

Local:  celery -A celery_worker.celery worker --loglevel=info
Beat:   celery -A celery_worker.celery beat   --loglevel=info
"""
from celery import Celery
from app import create_app

flask_app = create_app()


def make_celery(app):
    celery = Celery(
        app.import_name,
        broker=app.config['CELERY_BROKER_URL'],
        backend=app.config['CELERY_RESULT_BACKEND'],
        include=[
            'app.tasks.snapshot_tasks',
            'app.tasks.follower_tasks',
        ],
    )
    celery.conf.update(
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='UTC',
        enable_utc=True,
        beat_schedule={
            'sync-recently-played-every-5-mins': {
                'task': 'app.tasks.snapshot_tasks.sync_all_users_recently_played',
                'schedule': 300.0,
            },
            'poll-currently-playing-every-1-min': {
                'task': 'app.tasks.snapshot_tasks.poll_and_sync_currently_playing',
                'schedule': 60.0,
            },
            'take-global-snapshot-daily': {
                'task': 'app.tasks.snapshot_tasks.take_global_snapshot_all',
                'schedule': 86400.0,
            },
            'poll-artist-followers-weekly': {
                'task': 'app.tasks.follower_tasks.poll_all_artist_followers',
                'schedule': 604800.0,
            },
            'take-genre-snapshots-monthly': {
                'task': 'app.tasks.snapshot_tasks.take_all_genre_snapshots',
                'schedule': 2592000.0,
            },
            'take-genre-snapshots-daily': {
                'task': 'app.tasks.snapshot_tasks.take_all_genre_snapshots_daily',
                'schedule': 86400.0,
            },
        },
    )

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery


celery = make_celery(flask_app)
