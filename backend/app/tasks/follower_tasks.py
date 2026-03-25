from datetime import date
from celery_worker import celery
from app.extensions import db
from app.models import Artist, ArtistFollowerSnapshot, SpotifyAccount
from app.services.spotify_client import SpotifyClient


@celery.task(bind=True, max_retries=3, default_retry_delay=600)
def poll_all_artist_followers(self):
    try:
        account = SpotifyAccount.query.first()
        if not account:
            return
        client  = SpotifyClient(user_id=str(account.user_id), spotify_account=account)
        artists = Artist.query.all()
        ids     = [a.spotify_id for a in artists]
        today   = date.today()
        for i in range(0, len(ids), 50):
            batch = ids[i:i+50]
            data  = client.get_artists_batch(batch)
            for a_data in data:
                artist = Artist.query.filter_by(spotify_id=a_data['id']).first()
                if not artist:
                    continue
                fc = a_data.get('followers', {}).get('total', 0)
                artist.follower_count = fc
                existing = ArtistFollowerSnapshot.query.filter_by(
                    artist_id=artist.id, snapshot_date=today
                ).first()
                if not existing:
                    db.session.add(ArtistFollowerSnapshot(
                        artist_id=artist.id,
                        snapshot_date=today,
                        follower_count=fc,
                    ))
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        raise self.retry(exc=exc)
