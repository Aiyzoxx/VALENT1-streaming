# StreamFlow — Backend PocketBase sur VPS (api.tribuneo.xyz)

## 0. Pré-requis

- VPS Ubuntu avec IP publique (ex: `51.XX.XX.XX`)
- Clé SSH : `serverkey.txt` (à la racine du projet, **ne jamais committer**)
- DNS : enregistrement A `api.tribuneo.xyz` → IP du VPS.
  Vérifier la propagation avant l'étape 3 :
  `nslookup api.tribuneo.xyz` doit répondre l'IP du VPS.

## 1. Connexion SSH (depuis Windows PowerShell)

```powershell
# Permissions clé (1ère fois) :
icacls serverkey.txt /inheritance:r
icacls serverkey.txt /grant:r "$env:USERNAME:(R)"

# Connexion (adapte ubuntu@ si l'image utilise un autre user) :
ssh -i .\serverkey.txt root@51.XX.XX.XX
```

## 2. Docker sur le VPS (Ubuntu)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Reconnecte-toi pour que le groupe s'applique, puis :
docker --version && docker compose version
```

## 3. Déploiement

```bash
mkdir -p ~/streamflow-server && cd ~/streamflow-server
# Copie docker-compose.yml + Caddyfile ici (scp depuis ton PC) :
```

Depuis PowerShell (sur ton PC, adapte l'IP) :

```powershell
scp -i .\serverkey.txt server\docker-compose.yml server\Caddyfile root@51.XX.XX.XX:~/streamflow-server/
```

Puis sur le VPS :

```bash
cd ~/streamflow-server
docker compose up -d
docker compose ps        # pocketbase + caddy UP
curl -s -o /dev/null -w "%{http_code}\n" https://api.tribuneo.xyz/api/healthcheck
# -> 200 (Caddy a obtenu le certificat Let's Encrypt tout seul)
```

## 4. Compte admin PocketBase

Déjà créé par le script (sinon : `https://api.tribuneo.xyz/_/`).
- Email : `admin@tribuneo.xyz`
- Mot de passe initial : demandé à l'agent (à changer dans Settings → Admins
  dès la 1ère connexion HTTPS).

## 5. Collections (automatisé, déjà exécuté)

`server/setup_pb.py` a créé, via l'API superuser :
- `user_favorites` : relation `user` → users (1 max, cascade delete) + `mediaIds` JSON,
  index unique sur `user`, règles owner `@request.auth.id = user` partout.
- `watch_progress` : relation `user` + `items` JSON, idem.

Rejouable à tout moment (idempotent) :
```bash
cd ~/streamflow-server
PB_ADMIN_PASS='...' python3 setup_pb.py
```

## 6. Test rapide

```bash
curl -s -X POST https://api.tribuneo.xyz/api/collections/users/records \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@tribuneo.xyz","password":"test123456","passwordConfirm":"test123456","name":"Test"}'
# -> 200 + JSON du user
```

## 7. Mises à jour

```bash
cd ~/streamflow-server
docker compose pull && docker compose up -d
```

## Fichiers
- `docker-compose.yml` : PocketBase (interne) + Caddy (80/443, HTTPS auto)
- `Caddyfile` : `api.tribuneo.xyz` → PocketBase:8090
- Données : `./pb_data` (à sauvegarder, ex: snapshot VPS ou `tar` régulier)
