"""Release only to existing internal groups and verify the resulting membership."""
import base64
import glob
import json
import os
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils


def select_groups(groups, previous_group_ids):
    internal = [g for g in groups if g['attributes'].get('isInternalGroup')]
    automatic = [g for g in internal if g['attributes'].get('hasAccessToAllBuilds')]
    if automatic:
        return automatic
    previous = [g for g in internal if g['id'] in previous_group_ids]
    if previous:
        return previous
    if len(internal) == 1:
        return internal
    raise RuntimeError('No hay un grupo interno inequívoco. No se amplió la distribución.')


class Apple:
    def __init__(self):
        self.issuer = os.environ['APP_STORE_CONNECT_ISSUER_ID']
        self.key_id = os.environ['APP_STORE_CONNECT_KEY_IDENTIFIER']
        private = os.environ['APP_STORE_CONNECT_PRIVATE_KEY']
        if private.startswith('@file:'):
            private = Path(private[6:]).read_text()
        self.key = serialization.load_pem_private_key(private.encode(), password=None)

    def request(self, path, body=None):
        b64 = lambda data: base64.urlsafe_b64encode(data).rstrip(b'=')
        header = b64(json.dumps({'alg': 'ES256', 'kid': self.key_id, 'typ': 'JWT'}).encode())
        payload = b64(json.dumps({'iss': self.issuer, 'iat': int(time.time()), 'exp': int(time.time()) + 600, 'aud': 'appstoreconnect-v1'}).encode())
        message = header + b'.' + payload
        r, s = utils.decode_dss_signature(self.key.sign(message, ec.ECDSA(hashes.SHA256())))
        token = (message + b'.' + b64(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))).decode()
        url = 'https://api.appstoreconnect.apple.com' + path
        req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read()
        return json.loads(raw) if raw else {}


def main():
    apple = Apple()
    app = os.environ['APP_STORE_APPLE_ID']
    groups = apple.request(f'/v1/apps/{app}/betaGroups?limit=100')['data']
    latest = apple.request(f'/v1/apps/{app}/builds?sort=-uploadedDate&limit=1')['data']
    previous = apple.request(f"/v1/builds/{latest[0]['id']}/betaGroups?limit=100")['data'] if latest else []
    chosen = select_groups(groups, {g['id'] for g in previous})
    names = [g['attributes']['name'] for g in chosen]
    print('TESTFLIGHT_INTERNAL_GROUPS=' + json.dumps(names, ensure_ascii=False), flush=True)
    ipas = glob.glob('build/ios/ipa/*.ipa')
    if len(ipas) != 1:
        raise RuntimeError('Se esperaba exactamente un IPA firmado.')
    command = ['app-store-connect', 'publish', '--path', ipas[0], '--max-build-processing-wait', '30']
    for name in names:
        command.extend(['--beta-group', name])
    subprocess.run(command, check=True)
    number = os.environ['BUILD_NUMBER']
    query = urllib.parse.urlencode({'filter[version]': number, 'limit': '10'})
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        builds = apple.request(f'/v1/apps/{app}/builds?{query}')['data']
        if builds:
            build = builds[0]
            state = build['attributes']['processingState']
            if state in ('FAILED', 'INVALID'):
                raise RuntimeError('Apple rechazó el procesamiento del IPA: ' + state)
            if state == 'VALID':
                membership = apple.request(f"/v1/builds/{build['id']}/betaGroups?limit=100")['data']
                ids = {g['id'] for g in membership}
                if all(g['id'] in ids for g in chosen):
                    report = {'appId': app, 'buildId': build['id'], 'buildNumber': number, 'processingState': state, 'groups': names, 'sourceCommit': os.environ.get('CM_COMMIT')}
                    Path('build/ios/testflight-delivery.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
                    print('TESTFLIGHT_DELIVERY_VERIFIED=' + json.dumps(report, ensure_ascii=False), flush=True)
                    return
        time.sleep(20)
    raise RuntimeError('No se pudo verificar la asignación de la build procesada al grupo interno.')


if __name__ == '__main__':
    main()
