"""
Task package. Tasks use a shared celery instance via celery_worker.celery.
Import the celery app lazily so this package can be imported without 
starting a full Celery worker.
"""
