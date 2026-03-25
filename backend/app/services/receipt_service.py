import io
from PIL import Image, ImageDraw, ImageFont
import os

RECEIPT_W = 1080
RECEIPT_H = 1920

# Colors
BG      = '#0A0A0A'
GREEN   = '#1DB954'
WHITE   = '#FFFFFF'
GRAY    = '#888888'
DARK_GRAY = '#1A1A1A'
LIGHT_GRAY = '#333333'


def _font(size: int, bold: bool = False):
    """Load system font with fallback."""
    try:
        if bold:
            return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', size)
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', size)
    except Exception:
        return ImageFont.load_default()


def _centered_text(draw, y: int, text: str, font, fill: str):
    bbox = draw.textbbox((0, 0), text, font=font)
    w    = bbox[2] - bbox[0]
    draw.text(((RECEIPT_W - w) // 2, y), text, font=font, fill=fill)
    return bbox[3] - bbox[1]  # height


def generate_receipt(user_data: dict) -> bytes:
    """
    Generate a 1080×1920 shareable receipt PNG.
    user_data: { display_name, persona, persona_reason,
                 top_tracks[{title,artist}], top_genres[str],
                 mainstream_score, discovery_ratio, obscurity_index, mood }
    """
    img  = Image.new('RGB', (RECEIPT_W, RECEIPT_H), color=BG)
    draw = ImageDraw.Draw(img)

    # Dotted top border
    for x in range(0, RECEIPT_W, 20):
        draw.ellipse([x, 40, x+4, 44], fill=GREEN)

    # Header
    y = 80
    draw.text((540, y), '♪', font=_font(80, bold=True), fill=GREEN, anchor='mm')
    y += 80
    _centered_text(draw, y, 'SPOTIFY ANALYZER', _font(52, bold=True), GREEN)
    y += 70
    draw.line([(80, y), (RECEIPT_W-80, y)], fill=LIGHT_GRAY, width=1)

    # User name
    y += 40
    _centered_text(draw, y, 'LISTENING RECEIPT', _font(24), GRAY)
    y += 50
    _centered_text(draw, y, user_data.get('display_name', 'Listener').upper(), _font(56, bold=True), WHITE)
    y += 80

    # Persona badge
    persona = user_data.get('persona', 'The Explorer')
    draw.rounded_rectangle([100, y, RECEIPT_W-100, y+80], radius=16, fill=GREEN)
    _centered_text(draw, y + 22, persona, _font(36, bold=True), BG)
    y += 110

    reason = user_data.get('persona_reason', '')
    if reason:
        draw.text((80, y), reason[:80], font=_font(26), fill=GRAY)
        y += 50

    draw.line([(80, y), (RECEIPT_W-80, y)], fill=LIGHT_GRAY, width=1)
    y += 40

    # Top tracks
    _centered_text(draw, y, '— YOUR TOP TRACKS —', _font(28, bold=True), GRAY)
    y += 60
    for i, track in enumerate(user_data.get('top_tracks', [])[:5], 1):
        title  = track.get('title', '')[:30]
        artist = track.get('artist', '')[:25]
        draw.text((80, y),  f'{i}.', font=_font(32, bold=True), fill=GREEN)
        draw.text((140, y), title,   font=_font(32, bold=True), fill=WHITE)
        y += 42
        draw.text((140, y), artist,  font=_font(28), fill=GRAY)
        y += 52

    y += 10
    draw.line([(80, y), (RECEIPT_W-80, y)], fill=LIGHT_GRAY, width=1)
    y += 40

    # Top genres
    _centered_text(draw, y, '— YOUR SOUND —', _font(28, bold=True), GRAY)
    y += 60
    genres = user_data.get('top_genres', [])[:5]
    genre_str = '  ·  '.join(g.upper() for g in genres) if genres else 'VARIED'
    # Word wrap simple version
    if len(genre_str) > 40:
        mid = len(genre_str) // 2
        sep = genre_str.rfind('·', 0, mid)
        if sep > 0:
            _centered_text(draw, y,    genre_str[:sep].strip(), _font(28), WHITE)
            _centered_text(draw, y+40, genre_str[sep:].strip(), _font(28), WHITE)
            y += 90
        else:
            _centered_text(draw, y, genre_str[:45], _font(28), WHITE)
            y += 50
    else:
        _centered_text(draw, y, genre_str, _font(28), WHITE)
        y += 50

    y += 10
    draw.line([(80, y), (RECEIPT_W-80, y)], fill=LIGHT_GRAY, width=1)
    y += 50

    # Stats row
    stats = [
        ('MAINSTREAM', f"{user_data.get('mainstream_score', 0)}%"),
        ('DISCOVERY',  f"{round(user_data.get('discovery_ratio', 0) * 100)}%"),
        ('OBSCURITY',  f"{round(user_data.get('obscurity_index', 0) * 100)}%"),
    ]
    col_w = (RECEIPT_W - 160) // 3
    for i, (label, val) in enumerate(stats):
        x = 80 + i * (col_w + 20)
        draw.text((x + col_w//2, y),    val,   font=_font(56, bold=True), fill=GREEN, anchor='mt')
        draw.text((x + col_w//2, y+70), label, font=_font(22), fill=GRAY, anchor='mt')

    y += 130
    draw.line([(80, y), (RECEIPT_W-80, y)], fill=LIGHT_GRAY, width=1)
    y += 50

    # Mood
    mood = user_data.get('mood', {})
    _centered_text(draw, y, '— MOOD PROFILE —', _font(28, bold=True), GRAY)
    y += 60
    mood_items = [
        ('ENERGY',       mood.get('energy', 0)),
        ('VALENCE',      mood.get('valence', 0)),
        ('DANCEABILITY', mood.get('danceability', 0)),
    ]
    bar_w  = RECEIPT_W - 200
    bar_h  = 18
    for label, val in mood_items:
        draw.text((80, y), label, font=_font(24, bold=True), fill=GRAY)
        y += 36
        draw.rounded_rectangle([80, y, 80+bar_w, y+bar_h], radius=9, fill=DARK_GRAY)
        fill_w = max(int(bar_w * val), bar_h)
        draw.rounded_rectangle([80, y, 80+fill_w, y+bar_h], radius=9, fill=GREEN)
        draw.text((80+bar_w+16, y-4), f'{round(val*100)}%', font=_font(22), fill=WHITE)
        y += 44

    y += 20
    draw.line([(80, y), (RECEIPT_W-80, y)], fill=LIGHT_GRAY, width=1)

    # Footer
    y = RECEIPT_H - 200
    draw.line([(80, y), (RECEIPT_W-80, y)], fill=LIGHT_GRAY, width=1)
    y += 40
    _centered_text(draw, y, 'spotify-analyzer.app', _font(30, bold=True), GREEN)
    y += 50
    from datetime import datetime
    _centered_text(draw, y, datetime.utcnow().strftime('%B %Y').upper(), _font(26), GRAY)

    # Dotted bottom border
    for x in range(0, RECEIPT_W, 20):
        draw.ellipse([x, RECEIPT_H-50, x+4, RECEIPT_H-46], fill=GREEN)

    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()
