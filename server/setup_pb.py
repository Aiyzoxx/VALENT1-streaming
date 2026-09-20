"""Setup one-shot des collections StreamFlow (favoris + historique).
Usage sur le VPS : PB_ADMIN_PASS='...' python3 setup_pb.py
Idempotent : ne recrée pas ce qui existe déjà.
"""
import json
import os
import urllib.parse
import urllib.request

PB = 'http://127.0.0.1:8090'
EMAIL = 'admin@tribuneo.xyz'
PASS = os.environ['PB_ADMIN_PASS']
OWNER_RULE = '@request.auth.id = user'


def api(method, path, token=None, body=None):
    req = urllib.request.Request(
        PB + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            'Content-Type': 'application/json',
            **({'Authorization': token} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]


def ensure_collection(name, schema, index_sql):
    q = urllib.parse.quote(f'name = "{name}"')
    st, data = api('GET', f'/api/collections?perPage=5&filter={q}', token)
    assert st == 200, f'list failed: {st} {data}'
    if data['items']:
        print(f'{name}: existe deja, OK')
        return
    body = {
        'name': name,
        'type': 'base',
        # v0.30+ : les champs passent par "fields" (plus "schema").
        'fields': schema,
        'listRule': OWNER_RULE,
        'viewRule': OWNER_RULE,
        'createRule': OWNER_RULE,
        'updateRule': OWNER_RULE,
        'deleteRule': OWNER_RULE,
        'indexes': [index_sql],
    }
    st, data = api('POST', '/api/collections', token, body)
    assert st in (200, 201), f'create {name} failed: {st} {data}'
    print(f'{name}: cree')


# 1. Token superuser
st, auth = api(
    'POST',
    '/api/collections/_superusers/auth-with-password',
    body={'identity': EMAIL, 'password': PASS},
)
assert st == 200, f'superuser auth failed: {st} {auth}'
token = auth['token']
print('superuser auth: OK')

# 2. ID de la collection users (cible des relations)
st, cols = api('GET', '/api/collections?perPage=100', token)
assert st == 200, cols
users_id = next(c['id'] for c in cols['items'] if c['name'] == 'users')
print(f'users collection id: {users_id}')

# 3. Collections
ensure_collection(
    'user_favorites',
    [
        {
            'name': 'user',
            'type': 'relation',
            'required': True,
            'collectionId': users_id,
            'cascadeDelete': True,
            'maxSelect': 1,
        },
        {
            'name': 'mediaIds',
            'type': 'json',
            'required': False,
            'maxSize': 2000000,
        },
    ],
    'CREATE UNIQUE INDEX idx_user_favorites_user ON user_favorites (user)',
)

ensure_collection(
    'watch_progress',
    [
        {
            'name': 'user',
            'type': 'relation',
            'required': True,
            'collectionId': users_id,
            'cascadeDelete': True,
            'maxSelect': 1,
        },
        {
            'name': 'items',
            'type': 'json',
            'required': False,
            'maxSize': 5000000,
        },
    ],
    'CREATE UNIQUE INDEX idx_watch_progress_user ON watch_progress (user)',
)

# 4. Vérif : accès anonyme doit être refusé
st, _ = api('GET', '/api/collections/user_favorites/records?perPage=1')
print(f'acces anonyme user_favorites: HTTP {st} (attendu 401/403)')
st, _ = api('GET', '/api/collections/watch_progress/records?perPage=1')
print(f'acces anonyme watch_progress: HTTP {st} (attendu 401/403)')
print('SETUP OK')
