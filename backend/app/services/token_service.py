import os
import base64
from cryptography.fernet import Fernet


def _get_key() -> bytes:
    key = os.environ.get('TOKEN_ENCRYPTION_KEY', '')
    if not key:
        # Generate a key for dev if not set - NOT safe for production
        return Fernet.generate_key()
    # Ensure it's valid Fernet key (32 url-safe base64-encoded bytes)
    try:
        decoded = base64.urlsafe_b64decode(key + '==')
        if len(decoded) == 32:
            return key.encode()
    except Exception:
        pass
    # Pad/hash to 32 bytes
    padded = key.encode().ljust(32, b'0')[:32]
    return base64.urlsafe_b64encode(padded)


def _fernet() -> Fernet:
    return Fernet(_get_key())


def encrypt_token(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
