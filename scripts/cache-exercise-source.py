"""Read public exercise pages for editorial comparison; never publishes raw HTML."""
import hashlib, html, json, pathlib, re, sys, urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1] / '.sites-runtime' / 'source-review'
ROOT.mkdir(parents=True, exist_ok=True)
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts=[]; self.links=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag in ('script','style'): self.skip+=1
        if tag=='a' and attrs.get('href'): self.links.append(attrs['href'])
        if tag in ('p','li','h1','h2','h3','h4','div','tr','br'): self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script','style'): self.skip=max(0,self.skip-1)
        if tag in ('p','li','h1','h2','h3','h4','div','tr'): self.parts.append('\n')
    def handle_data(self, data):
        if not self.skip:self.parts.append(data)

for url in sys.argv[1:]:
    if not url.startswith('https://math.libretexts.org/'): raise ValueError('Expected public LibreTexts source')
    key=hashlib.sha256(url.encode()).hexdigest()[:16]; dest=ROOT/(key+'.html')
    if not dest.exists():
        req=urllib.request.Request(url,headers={'User-Agent':'ENT-Math source verification'})
        with urllib.request.urlopen(req,timeout=40) as response: dest.write_bytes(response.read())
    page=Page(); page.feed(dest.read_text(encoding='utf-8'))
    text=re.sub(r'\n\s*\n+', '\n', html.unescape(''.join(page.parts)))
    (ROOT/(key+'.txt')).write_text(text,encoding='utf-8')
    (ROOT/(key+'.json')).write_text(json.dumps({'url':url,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'checkedAt':'2026-10-07','links':list(dict.fromkeys(page.links))},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'url':url,'file':str(ROOT/(key+'.txt')),'bytes':dest.stat().st_size}))
