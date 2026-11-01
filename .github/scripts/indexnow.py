#!/usr/bin/env python3
"""Tells IndexNow (Yandex, Bing, Seznam, Naver, Yep) which pages of the site a push to main changed.

Run by .github/workflows/indexnow.yml from the repository root. Waits until GitHub Pages serves the pushed commit,
then submits the posts the push added, edited or deleted, with the home page and /blog that list them. Posts left out
of sitemap.xml (hidden: true) are not submitted. A run without BEFORE (manual) submits every URL of sitemap.xml.

Environment: AFTER - the pushed commit; BEFORE - the branch head before the push (empty in a manual run);
DRY_RUN - "1" prints the request instead of sending it.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from xml.etree import ElementTree

ENDPOINT = 'https://api.indexnow.org/indexnow'  # shares the URLs with every IndexNow search engine
ACCEPTED = (200, 202)                           # 202: accepted, the key is still being checked
CONFIG = Path('_config.yml')
SITE_URL = re.compile(r'^url:\s*"?([^"\s]+)"?', re.M)
KEY_FILE = re.compile(r'^[A-Za-z0-9-]{8,128}\.txt$')  # <key>.txt in the site root holds the key itself
POSTS = '_posts'
POST_FILE = re.compile(r'^_posts/(\d{4})-(\d{2})-(\d{2})-(.+)\.(?:md|markdown|html)$')
DELETED = 'D'
LIST_PAGES = ('/', '/blog.html')                # they list the posts
SITEMAP = '/sitemap.xml'
SITEMAP_LOC = '{http://www.sitemaps.org/schemas/sitemap/0.9}loc'
REVISION = re.compile(r'\?v=([0-9a-f]{40})')    # site.github.build_revision in the asset URLs of every page
NO_COMMIT = re.compile(r'^0*$')                 # "before" of a new branch
DEPLOY_TIMEOUT_S = 900
POLL_S = 20
HTTP_TIMEOUT_S = 30
USER_AGENT = 'x-crm.in IndexNow (GitHub Actions)'


def git(*args):
    return subprocess.run(('git',) + args, check=True, capture_output=True, text=True).stdout


def has_commit(commit):
    return subprocess.run(('git', 'cat-file', '-e', commit + '^{commit}'), capture_output=True).returncode == 0


def get(url):
    # the query string gets past the CDN cache of GitHub Pages
    request = urllib.request.Request(f'{url}?indexnow={time.time():.0f}', headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_S) as response:
        return response.read()


def deployed(commit, live):
    """The site serves the commit or a later one (a newer push deployed over it)"""
    if live == commit:
        return True
    if not has_commit(live):
        git('fetch', '--quiet', 'origin')
    return subprocess.run(('git', 'merge-base', '--is-ancestor', commit, live), capture_output=True).returncode == 0


def wait_for_deploy(site, commit):
    deadline = time.monotonic() + DEPLOY_TIMEOUT_S
    while True:
        try:
            live = REVISION.search(get(site + '/').decode('utf-8'))
        except (urllib.error.URLError, OSError) as error:
            live = None
            print(f'IndexNow: {site} did not answer: {error}')
        if live and deployed(commit, live.group(1)):
            return
        if time.monotonic() > deadline:
            sys.exit(f'IndexNow: {site} does not serve {commit} after {DEPLOY_TIMEOUT_S} s')
        time.sleep(POLL_S)


def changed_posts(before, after):
    """(status, path) of the posts changed by the push; a renamed post comes as a deletion and an addition"""
    if NO_COMMIT.match(before) or not has_commit(before):
        before = after + '~1'                   # unknown head before the push (forced push): its last commit only
    diff = git('diff', '--name-status', '--no-renames', before, after, '--', POSTS)
    return [line.split('\t', 1) for line in diff.splitlines()]


def post_url(site, path):
    year, month, day, slug = POST_FILE.match(path).groups()
    return f'{site}/{year}/{month}/{day}/{slug}.html'  # the default permalink of posts without categories


def sitemap_urls(site):
    return [loc.text.strip() for loc in ElementTree.fromstring(get(site + SITEMAP)).iter(SITEMAP_LOC)]


def urls_to_submit(site, before, after):
    if not before:
        return sitemap_urls(site)
    public = set(sitemap_urls(site))
    urls = []
    for status, path in changed_posts(before, after):
        if not POST_FILE.match(path):
            continue
        url = post_url(site, path)
        if status == DELETED or url in public:  # the 404 of a deleted post takes it out of the index
            urls.append(url)
    return urls + [site + page for page in LIST_PAGES] if urls else []


def index_key():
    keys = [path.stem for path in Path('.').iterdir()
            if KEY_FILE.match(path.name) and path.read_text(encoding='utf-8').strip() == path.stem]
    if len(keys) != 1:
        sys.exit(f'IndexNow: expected one key file <key>.txt in the site root, found {len(keys)}')
    return keys[0]


def submit(site, key, urls):
    payload = {'host': urllib.parse.urlsplit(site).hostname, 'key': key, 'keyLocation': f'{site}/{key}.txt',
               'urlList': urls}
    if os.environ.get('DRY_RUN') == '1':
        print(json.dumps(payload, indent=2))
        return
    request = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode('utf-8'), headers={
        'Content-Type': 'application/json; charset=utf-8', 'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_S) as response:
            status = response.status
    except urllib.error.HTTPError as error:
        status = error.code
    print(f'IndexNow: HTTP {status} for {len(urls)} URLs')
    if status not in ACCEPTED:
        sys.exit(1)


def main():
    after = os.environ['AFTER']
    before = os.environ.get('BEFORE', '')
    site = SITE_URL.search(CONFIG.read_text(encoding='utf-8')).group(1).rstrip('/')
    key = index_key()
    wait_for_deploy(site, after)
    urls = urls_to_submit(site, before, after)
    if not urls:
        print('IndexNow: the push changed no public posts')
        return
    print('\n'.join(urls))
    submit(site, key, urls)


if __name__ == '__main__':
    main()
