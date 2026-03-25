import uuid
from datetime import datetime
from app.extensions import db
from sqlalchemy.dialects.postgresql import UUID, JSONB


class User(db.Model):
    __tablename__ = 'users'

    id           = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email        = db.Column(db.String(255), unique=True, nullable=True)
    display_name = db.Column(db.String(255))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    spotify_account    = db.relationship('SpotifyAccount', back_populates='user', uselist=False, cascade='all, delete-orphan')
    listening_history  = db.relationship('ListeningHistory', back_populates='user', lazy='dynamic', cascade='all, delete-orphan')
    genre_snapshots    = db.relationship('GenreSnapshot', back_populates='user', lazy='dynamic', cascade='all, delete-orphan')
    compat_as_a        = db.relationship('CompatibilityCache', foreign_keys='CompatibilityCache.user_a_id', lazy='dynamic', cascade='all, delete-orphan')
    compat_as_b        = db.relationship('CompatibilityCache', foreign_keys='CompatibilityCache.user_b_id', lazy='dynamic', cascade='all, delete-orphan')


class SpotifyAccount(db.Model):
    __tablename__ = 'spotify_accounts'

    id                      = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id                 = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    spotify_id              = db.Column(db.String(100), unique=True, nullable=False)
    encrypted_refresh_token = db.Column(db.Text, nullable=False)
    country                 = db.Column(db.String(10))
    product                 = db.Column(db.String(20))
    avatar_url              = db.Column(db.String(500))
    last_synced_at          = db.Column(db.DateTime)
    created_at              = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='spotify_account')


class Artist(db.Model):
    __tablename__ = 'artists'
    __table_args__ = (
        db.Index('ix_artists_spotify_id', 'spotify_id'),
    )

    id             = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spotify_id     = db.Column(db.String(100), unique=True, nullable=False)
    name           = db.Column(db.String(500), nullable=False)
    genres         = db.Column(JSONB, default=list)
    popularity     = db.Column(db.Integer, default=0)
    follower_count = db.Column(db.Integer, default=0)
    image_url      = db.Column(db.String(500))
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    follower_snapshots = db.relationship('ArtistFollowerSnapshot', back_populates='artist', lazy='dynamic', cascade='all, delete-orphan')


track_artists = db.Table(
    'track_artists',
    db.Column('track_id',  UUID(as_uuid=True), db.ForeignKey('tracks.id',   ondelete='CASCADE'), primary_key=True),
    db.Column('artist_id', UUID(as_uuid=True), db.ForeignKey('artists.id',  ondelete='CASCADE'), primary_key=True),
)


class Track(db.Model):
    __tablename__ = 'tracks'
    __table_args__ = (
        db.Index('ix_tracks_spotify_id',   'spotify_id'),
        db.Index('ix_tracks_release_year', 'release_year'),
        db.Index('ix_tracks_popularity',   'popularity'),
    )

    id           = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spotify_id   = db.Column(db.String(100), unique=True, nullable=False)
    title        = db.Column(db.String(500), nullable=False)
    album        = db.Column(db.String(500))
    duration_ms  = db.Column(db.Integer)
    popularity   = db.Column(db.Integer, default=0)
    release_year = db.Column(db.Integer)
    preview_url  = db.Column(db.String(500))
    image_url    = db.Column(db.String(500))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    audio_features = db.relationship('AudioFeature', back_populates='track', uselist=False, cascade='all, delete-orphan')
    artists        = db.relationship('Artist', secondary=track_artists, lazy='joined')
    history        = db.relationship('ListeningHistory', back_populates='track', lazy='dynamic')


class AudioFeature(db.Model):
    __tablename__ = 'audio_features'

    id               = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    track_id         = db.Column(UUID(as_uuid=True), db.ForeignKey('tracks.id', ondelete='CASCADE'), unique=True, nullable=False)
    energy           = db.Column(db.Float, default=0.0)
    valence          = db.Column(db.Float, default=0.0)
    danceability     = db.Column(db.Float, default=0.0)
    acousticness     = db.Column(db.Float, default=0.0)
    instrumentalness = db.Column(db.Float, default=0.0)
    liveness         = db.Column(db.Float, default=0.0)
    speechiness      = db.Column(db.Float, default=0.0)
    tempo            = db.Column(db.Float, default=0.0)
    key              = db.Column(db.Integer, default=0)
    time_signature   = db.Column(db.Integer, default=4)
    loudness         = db.Column(db.Float, default=0.0)

    track = db.relationship('Track', back_populates='audio_features')


class ListeningHistory(db.Model):
    __tablename__ = 'listening_history'
    __table_args__ = (
        db.Index('ix_lh_user_played', 'user_id', 'played_at'),
        db.Index('ix_lh_user_track',  'user_id', 'track_id'),
    )

    id               = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    track_id         = db.Column(UUID(as_uuid=True), db.ForeignKey('tracks.id', ondelete='CASCADE'), nullable=False)
    played_at        = db.Column(db.DateTime, nullable=False)
    ms_played        = db.Column(db.Integer, default=0)
    context_type     = db.Column(db.String(50))
    source           = db.Column(db.String(50))
    is_new_discovery = db.Column(db.Boolean, default=False)

    user  = db.relationship('User', back_populates='listening_history')
    track = db.relationship('Track', back_populates='history')


class GenreSnapshot(db.Model):
    __tablename__ = 'genre_snapshots'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'snapshot_month', name='uq_genre_snapshot_user_month'),
        db.Index('ix_gs_user_month', 'user_id', 'snapshot_month'),
    )

    id                 = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id            = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    snapshot_month     = db.Column(db.Date, nullable=False)
    genre_distribution = db.Column(JSONB, default=dict)
    mood_vector        = db.Column(JSONB, default=dict)

    user = db.relationship('User', back_populates='genre_snapshots')


class GlobalSnapshot(db.Model):
    __tablename__ = 'global_snapshots'
    __table_args__ = (
        db.Index('ix_gls_country_date', 'country_code', 'snapshot_date'),
    )

    id               = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    playlist_id      = db.Column(db.String(100), nullable=False)
    country_code     = db.Column(db.String(10))
    snapshot_date    = db.Column(db.Date, nullable=False)
    avg_valence      = db.Column(db.Float, default=0.0)
    avg_energy       = db.Column(db.Float, default=0.0)
    avg_danceability = db.Column(db.Float, default=0.0)
    avg_tempo        = db.Column(db.Float, default=0.0)
    top_genres       = db.Column(JSONB, default=dict)
    track_ids        = db.Column(JSONB, default=list)


class ArtistFollowerSnapshot(db.Model):
    __tablename__ = 'artist_follower_snapshots'
    __table_args__ = (
        db.Index('ix_afs_artist_date', 'artist_id', 'snapshot_date'),
    )

    id             = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artist_id      = db.Column(UUID(as_uuid=True), db.ForeignKey('artists.id', ondelete='CASCADE'), nullable=False)
    snapshot_date  = db.Column(db.Date, nullable=False)
    follower_count = db.Column(db.Integer, default=0)
    chart_position = db.Column(db.Integer, nullable=True)

    artist = db.relationship('Artist', back_populates='follower_snapshots')


class CompatibilityCache(db.Model):
    __tablename__ = 'compatibility_cache'
    __table_args__ = (
        db.Index('ix_cc_user_pair', 'user_a_id', 'user_b_id'),
    )

    id          = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_a_id   = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    user_b_id   = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    score       = db.Column(db.Float, default=0.0)
    breakdown   = db.Column(JSONB, default=dict)
    computed_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at  = db.Column(db.DateTime)
