import click
from flask import current_app
from app.extensions import db


def register_commands(app):
    @app.cli.command('create-db')
    def create_db():
        """Create all tables."""
        db.create_all()
        click.echo('Database tables created.')

    @app.cli.command('seed-db')
    def seed_db():
        """Seed initial data."""
        click.echo('No seed data defined.')
