"""Verify internal TestFlight delivery after Codemagic's native IPA publisher.

Uses the existing App Store Connect integration, without exporting credentials.
Never creates groups, adds testers, or submits an App Store release.
"""
import argparse
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlparse


def integration_value(value):
    """Resolve Codemagic CLI's @file:/@env: secret references in memory."""
    if value.startswith('@file:'):
        value = Path(os.path.expandvars(value[6:])).expanduser().read_text()
    elif value.startswith('@env:'):
        value = os.environ[value[5:]]
    return value.strip()


def resolve_app_id(api):
    apps = api.get('/apps', **{'filter[bundleId]': 'com.patea.app', 'limit': 2})['data']
    if len(apps) != 1 or apps[0]['attributes']['bundleId'] != 'com.patea.app':
        raise RuntimeError('No se pudo identificar la app com.patea.app inequívocamente')
    return apps[0]['id']


def select_groups(groups, previous_ids=()):
    internal = [g for g in groups if g['attributes'].get('isInternalGroup') is True]
    automatic = [g for g in internal if g['attributes'].get('hasAccessToAllBuilds') is True]
    previous = [g for g in internal if g['id'] in previous_ids]
    chosen = automatic or previous or (internal if len(internal) == 1 else [])
    if not chosen:
        raise RuntimeError('No hay un destino interno inequívoco; no se amplían destinatarios.')
    return [{'id': g['id'], 'name': g['attributes']['name']} for g in chosen]


class Apple:
    origin = 'https://api.appstoreconnect.apple.com'

    def __init__(self):
        import jwt
        import requests
        self.jwt = jwt
        self.session = requests.Session()
        self.issuer = os.environ['APP_STORE_CONNECT_ISSUER_ID']
        self.key_id = os.environ['APP_STORE_CONNECT_KEY_IDENTIFIER']
        self.key = integration_value(os.environ['APP_STORE_CONNECT_PRIVATE_KEY'])

    def request(self, method, path, **kwargs):
        url = path if path.startswith('https://') else self.origin + '/v1' + path
        if urlparse(url).netloc != 'api.appstoreconnect.apple.com':
            raise RuntimeError('Origen de API inesperado')
        now = int(time.time())
        token = self.jwt.encode({'iss': self.issuer, 'iat': now-10,
            'exp': now+600, 'aud': 'appstoreconnect-v1'}, self.key,
            algorithm='ES256', headers={'kid': self.key_id, 'typ': 'JWT'})
        for attempt in range(3):
            response = self.session.request(method, url, timeout=45,
                headers={'Authorization': 'Bearer '+token}, **kwargs)
            if response.status_code not in (429, 500, 502, 503, 504):
                break
            time.sleep(2 ** (attempt+1))
        if not response.ok:
            codes = [e.get('code', '') for e in response.json().get('errors', [])]
            raise RuntimeError('Apple HTTP '+str(response.status_code)+' '+','.join(codes))
        return response.json() if response.content else {}

    def get(self, path, **params):
        return self.request('GET', path, params=params)

    def all(self, path, **params):
        response = self.get(path, **params)
        data = response.get('data', [])
        while response.get('links', {}).get('next'):
            response = self.get(response['links']['next'])
            data.extend(response.get('data', []))
        return data


def prepare(api, app_id, path):
    groups = api.all('/betaGroups', **{'filter[app]': app_id, 'limit': 200})
    print('TESTFLIGHT_APP '+app_id+' GROUPS '+json.dumps([
        {'id': g['id'], 'name': g['attributes'].get('name'),
         'internal': g['attributes'].get('isInternalGroup'),
         'automatic': g['attributes'].get('hasAccessToAllBuilds')}
        for g in groups]), flush=True)
    internal = [g for g in groups if g['attributes'].get('isInternalGroup') is True]
    previous_ids = []
    if len(internal) > 1 and not any(g['attributes'].get('hasAccessToAllBuilds') for g in internal):
        builds = api.get('/builds', **{'filter[app]': app_id, 'sort': '-uploadedDate', 'limit': 10})['data']
        previous = next((b for b in builds if b['attributes']['processingState'] == 'VALID'
            and not b['attributes'].get('expired')), None)
        if previous:
            for group in internal:
                members = api.all('/betaGroups/'+group['id']+'/relationships/builds', limit=200)
                if any(b['id'] == previous['id'] for b in members):
                    previous_ids.append(group['id'])
    targets = select_groups(groups, previous_ids)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({'app': app_id, 'groups': targets}, indent=2), encoding='utf8')
    print('TESTFLIGHT_TARGETS '+', '.join(g['name'] for g in targets), flush=True)


def verify(api, app_id, number, version, targets, output, timeout=1200):
    if targets['app'] != app_id or not targets.get('groups'):
        raise RuntimeError('Destino de TestFlight inválido')
    # Revalidate selection against the same app before any assignment.
    current = {g['id']: g for g in api.all('/betaGroups',
        **{'filter[app]': app_id, 'limit': 200})}
    for group in targets['groups']:
        if group['id'] not in current or not current[group['id']]['attributes'].get('isInternalGroup'):
            raise RuntimeError('El destino dejó de ser un grupo interno de esta app')
    deadline = time.monotonic()+timeout
    attached = set()
    while time.monotonic() < deadline:
        builds = api.get('/builds', **{'filter[app]': app_id,
            'filter[version]': number, 'limit': 10})['data']
        build = next((b for b in builds if b['attributes']['version'] == number), None)
        if build:
            state = build['attributes']['processingState']
            if state in ('FAILED', 'INVALID') or build['attributes'].get('expired'):
                raise RuntimeError('Apple rechazó o expiró la compilación: '+state)
            if state == 'VALID':
                marketing = api.get('/builds/'+build['id']+'/preReleaseVersion')['data']['attributes']['version']
                if marketing != version:
                    raise RuntimeError('La versión de Apple no corresponde a esta entrega')
                for group in targets['groups']:
                    if group['id'] not in attached:
                        # Automatic internal groups already receive every build.
                        # Their implicit access need not appear as an explicit
                        # relationship and cannot be assigned manually.
                        if current[group['id']]['attributes'].get('hasAccessToAllBuilds'):
                            attached.add(group['id'])
                            continue
                        members = api.all('/betaGroups/'+group['id']+'/relationships/builds', limit=200)
                        if not any(item['id'] == build['id'] for item in members):
                            api.request('POST', '/builds/'+build['id']+'/relationships/betaGroups',
                                json={'data': [{'type': 'betaGroups', 'id': group['id']}]})
                        attached.add(group['id'])
                membership = all(
                    current[g['id']]['attributes'].get('hasAccessToAllBuilds') or
                    any(item['id'] == build['id'] for item in api.all(
                        '/betaGroups/'+g['id']+'/relationships/builds', limit=200))
                    for g in targets['groups'])
                beta = api.get('/builds/'+build['id']+'/buildBetaDetail')['data']['attributes']
                internal_state = beta.get('internalBuildState')
                if internal_state in ('MISSING_EXPORT_COMPLIANCE', 'INVALID_BINARY', 'EXPIRED', 'PROCESSING_EXCEPTION'):
                    raise RuntimeError('TestFlight requiere intervención: '+internal_state)
                if membership and internal_state == 'IN_BETA_TESTING':
                    report = {'status': 'delivered', 'version': version, 'buildNumber': number,
                        'buildId': build['id'], 'groups': targets['groups'],
                        'processingState': state, 'internalBuildState': internal_state}
                    output.parent.mkdir(parents=True, exist_ok=True)
                    output.write_text(json.dumps(report, indent=2), encoding='utf8')
                    print('TESTFLIGHT_DELIVERED '+json.dumps(report), flush=True)
                    return report
                print('Esperando disponibilidad interna: '+str(internal_state), flush=True)
            else:
                print('Apple processingState: '+state, flush=True)
        else:
            print('Esperando que Apple registre la compilación '+number, flush=True)
        time.sleep(20)
    raise RuntimeError('Apple no confirmó disponibilidad para los grupos dentro del plazo')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'verify', 'inspect'])
    args = parser.parse_args()
    api = Apple()
    app_id = resolve_app_id(api)
    targets = Path('build/ios/testflight-targets.json')
    if args.action == 'inspect':
        prepare(api, app_id, targets)
        groups = api.all('/betaGroups', **{'filter[app]': app_id, 'limit': 200})
        for group in groups:
            attrs = group['attributes']
            builds = api.all('/betaGroups/'+group['id']+'/builds', limit=10)
            print(json.dumps({'id': group['id'], 'name': attrs['name'],
                'internal': attrs.get('isInternalGroup'),
                'automatic': attrs.get('hasAccessToAllBuilds'),
                'recentBuilds': [{'id': b['id'], 'version': b['attributes']['version'],
                    'processingState': b['attributes']['processingState']}
                    for b in builds[:5]]}), flush=True)
    elif args.action == 'prepare':
        prepare(api, app_id, targets)
        if os.environ.get('CM_ENV'):
            with open(os.environ['CM_ENV'], 'a') as env:
                env.write('\nAPP_STORE_APPLE_ID='+app_id+'\n')
    else:
        version = re.search(r'^version:\s*(\S+)', Path('pubspec.yaml').read_text(), re.M)[1].split('+')[0]
        verify(api, app_id, os.environ['BUILD_NUMBER'], version,
            json.loads(targets.read_text()), Path('build/ios/testflight-delivery.json'))


if __name__ == '__main__':
    main()
