import jwt, datetime, os, sys
sys.path.insert(0, '.')
from app.core.config import settings
secret = settings.SECRET_KEY
payload = {
    'sub': 'test_user_debug_123',
    'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1),
    'iat': datetime.datetime.utcnow()
}
token = jwt.encode(payload, secret, algorithm='HS256')
print(token)
