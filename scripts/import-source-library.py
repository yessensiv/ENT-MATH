"""Resumable, bounded import of the selected open textbook editions.

Originals are an editorial archive, never automatically published as Task objects.
Preserves the complete content of every chapter (including exercises that lack
special markup), source answers, figure references and source license evidence.
"""
from __future__ import annotations
import argparse, concurrent.futures, hashlib, json, pathlib, re, time
import urllib.parse, urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.sites-runtime/source-review'
DEST = ROOT / 'content/source-library'
BOOKS = [
    ('intermediate-algebra', 'Intermediate Algebra 1e', 'OpenStax / Lynn Marecek, Andrea Honeycutt Mathis', 'https://math.libretexts.org/Bookshelves/Algebra/Intermediate_Algebra_1e_(OpenStax)'),
    ('precalculus', 'Precalculus 2e', 'OpenStax / Jay Abramson et al.', 'https://math.libretexts.org/Bookshelves/Precalculus/Precalculus_2e_(OpenStax)'),
    ('contemporary', 'Contemporary Mathematics', 'OpenStax / Donna Kirk et al.', 'https://math.libretexts.org/Bookshelves/Applied_Mathematics/Contemporary_Mathematics_(OpenStax)'),
    ('prealgebra', 'Prealgebra 2e', 'OpenStax / Lynn Marecek, MaryAnne Anthony-Smith', 'https://math.libretexts.org/Bookshelves/PreAlgebra/Prealgebra_2e_(OpenStax)'),
    ('algebra-trigonometry', 'Algebra and Trigonometry 1e', 'OpenStax / Jay Abramson et al.', 'https://math.libretexts.org/Bookshelves/Algebra/Algebra_and_Trigonometry_1e_(OpenStax)'),
    ('statistics', 'Introductory Statistics 2e', 'OpenStax / Barbara Illowsky, Susan Dean', 'https://stats.libretexts.org/Bookshelves/Introductory_Statistics/Introductory_Statistics_2e_(OpenStax)'),
    ('calculus', 'Calculus (Volumes 1–3)', 'OpenStax / Gilbert Strang, Edwin Jed Herman', 'https://math.libretexts.org/Bookshelves/Calculus/Calculus_(OpenStax)'),
]
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
BLOCK = {'p','div','li','ol','ul','dl','dt','dd','h1','h2','h3','h4','h5','table','tr','section','br','figure','figcaption'}

class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def all(self):
        yield self
        for child in self.children:
            if isinstance(child, Node): yield from child.all()
    def text(self, omit_answers=False):
        if self.tag in ('script','style','nav','aside','annotation','annotation-xml') or (omit_answers and (self.tag=='dl' or self.attrs.get('data-type')=='solution')): return ''
        if self.tag=='math': return '\\('+self.math_text()+'\\)'
        if self.tag=='img': return '\n[Figure: '+self.attrs.get('alt','no alternative text in source')+']\n'
        result=''.join(c.text(omit_answers) if isinstance(c,Node) else c for c in self.children)
        if self.tag in ('td','th'): return result+'\t'
        if self.tag=='sup': return '^('+result+')'
        if self.tag=='sub': return '_('+result+')'
        if self.tag=='li' and self.parent and self.parent.tag=='ol':
            siblings=[n for n in self.parent.children if isinstance(n,Node) and n.tag=='li']
            number=int(self.attrs.get('value',self.parent.attrs.get('start','1')))+(0 if 'value' in self.attrs else siblings.index(self))
            result=str(number)+'. '+result
        return ('\n'+result+'\n') if self.tag in BLOCK else result

    def math_text(self):
        if self.tag in ('annotation','annotation-xml'): return ''
        rendered=[(c,c.math_text() if isinstance(c,Node) else c.strip()) for c in self.children]
        parts=[value for _,value in rendered]
        values=[value for child,value in rendered if isinstance(child,Node) and child.tag not in ('annotation','annotation-xml')]
        if self.tag=='mfrac' and len(values)==2: return '\\frac{'+values[0]+'}{'+values[1]+'}'
        if self.tag=='msup' and len(values)==2: return '{'+values[0]+'}^{'+values[1]+'}'
        if self.tag=='msub' and len(values)==2: return '{'+values[0]+'}_{'+values[1]+'}'
        if self.tag=='msubsup' and len(values)==3: return '{'+values[0]+'}_{'+values[1]+'}^{'+values[2]+'}'
        if self.tag=='msqrt': return '\\sqrt{'+''.join(parts)+'}'
        if self.tag=='mroot' and len(values)==2: return '\\sqrt['+values[1]+']{'+values[0]+'}'
        if self.tag in ('munder','mover','munderover'): return '\\'+self.tag+'{'+ '}{'.join(values)+'}'
        if self.tag=='mtable': return '\\begin{matrix}'+ '\\\\'.join(values)+'\\end{matrix}'
        if self.tag=='mtr': return '&'.join(values)
        if self.tag=='mfenced': return self.attrs.get('open','(')+','.join(values)+self.attrs.get('close',')')
        if self.tag=='mspace': return ' '
        if self.tag not in ('math','semantics','mrow','mi','mn','mo','mtext','mstyle','mtd'):
            return '\\unsupported{'+self.tag+'}{'+''.join(parts)+'}'
        return ''.join(parts)

class Tree(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True); self.root=Node(); self.stack=[self.root]; self.feed(html)
    def handle_starttag(self, tag, attrs):
        node=Node(tag,attrs,self.stack[-1]); self.stack[-1].children.append(node)
        if tag not in VOID: self.stack.append(node)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID: self.handle_endtag(tag)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag: self.stack=self.stack[:i]; break
    def handle_data(self, data): self.stack[-1].children.append(data)

def clean(text): return re.sub(r'\n\s*\n+', '\n\n', text).strip()
def canonical(url):
    p=urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((p.scheme,p.netloc,urllib.parse.unquote(p.path).rstrip('/'),'',''))
def safe_url(url): return urllib.parse.quote(url, safe=':/()_-.,')
def inherited_license(page, pages):
    if page.get('license'): return page['license'],page
    ancestors=[p for p in pages if p.get('license') and canonical(page['url']).startswith(canonical(p['url'])+'/')]
    parent=max(ancestors,key=lambda p:len(p['url']),default={})
    return parent.get('license'),parent
def license_of(tree):
    # Use the page's attribution paragraph, not a random outgoing CC link.
    for node in tree.root.all():
        if node.tag=='p' and 'is shared under' in node.text():
            text=clean(node.text())
            match=re.search(r'CC BY(?:-NC)?(?:-SA)?(?:-ND)?\s+\d\.\d',text)
            return (re.sub(r'\s+',' ',match.group(0)) if match else None),text
    return None,''

def extract(html, url):
    tree=Tree(html); nodes=list(tree.root.all())
    body=next((n for n in nodes if 'mt-content-container' in n.attrs.get('class','').split()),None)
    if not body: raise ValueError('Source content container missing')
    # Global MathJax definitions are not task conditions.
    for n in list(body.all()):
        if 'mt-script-comment' in n.attrs.get('class','') or n.attrs.get('id')=='MathJax_Message':
            n.children=[]
    title=next((clean(n.text()) for n in nodes if n.tag=='h1'),'')
    links=sorted({canonical(urllib.parse.urljoin(url,n.attrs['href'])) for n in nodes if n.tag=='a' and 'href' in n.attrs})
    figures=[{'url':urllib.parse.urljoin(url,n.attrs.get('src','')), 'alt':n.attrs.get('alt',''), 'credit':n.attrs.get('title','')} for n in body.all() if n.tag=='img']
    exercises=[]; context=[]; selected=set()
    for n in body.all():
        # Answer lists may be siblings of numbered questions, not children.
        # Never treat their numbered subparts or paragraphs as new exercises
        # or as the instruction for the next question.
        if n.tag=='dl' or n.attrs.get('data-type')=='solution':
            selected.add(id(n));continue
        parent=n.parent; nested=False
        while parent and parent is not body:
            if id(parent) in selected: nested=True; break
            parent=parent.parent
        if nested: continue
        classes=n.attrs.get('class','').split()
        boxed=n.attrs.get('data-type')=='exercise' or any(c in classes for c in ['box-exercise','box-example','box-query'])
        listed=n.tag=='li' and n.parent and n.parent.tag=='ol' and not any(a in classes for a in ['mt-sortable-listing'])
        numbered=n.tag=='p' and re.match(r'^\d+[.)]\s',clean(n.text()))
        if boxed or listed or numbered:
            text=clean(n.text()); prompt=clean(n.text(True))
            if not text: continue
            selected.add(id(n))
            label=re.match(r'^(?:Exercise\s*)?(\d+[.)]?)',prompt)
            number=label.group(1).rstrip('.)') if label else ''
            if listed:
                siblings=[x for x in n.parent.children if isinstance(x,Node) and x.tag=='li']
                number=str(int(n.attrs.get('value',n.parent.attrs.get('start','1')))+(0 if 'value' in n.attrs else siblings.index(n)))
            answers=[clean(a.text()) for a in n.all() if a.tag=='dd' or a.attrs.get('data-type')=='solution']
            exercises.append({'ordinal':len(exercises)+1,'sourceNumber':number,'sourceAnchor':n.attrs.get('id',''),
                'kind':'example-or-exercise' if 'box-example' in classes else 'exercise-candidate',
                'context':'\n\n'.join(context[-3:]),'original':text,'prompt':prompt,'sourceAnswers':answers,
                'hasFigure':any(a.tag=='img' for a in n.all()),'status':'draft','answerVerified':False,'translationStatus':'pending','mappingStatus':'pending'})
        elif n.tag in ('p','h2','h3','h4'):
            value=clean(n.text())
            if value and len(value)<3000:
                heading=n.tag.startswith('h') or any(isinstance(c,Node) and c.tag=='strong' and clean(c.text())==value for c in n.children)
                if heading: context=[value]
                else: context.append(value)
    lic,evidence=license_of(tree)
    references=[{'text':clean(n.text()),'url':urllib.parse.urljoin(url,n.attrs['href'])} for n in body.all() if n.tag=='a' and n.attrs.get('href') and urllib.parse.urljoin(url,n.attrs['href']).startswith(('https://','http://'))]
    return {'title':title,'originalText':clean(body.text()),'figures':figures,'references':references,'exercises':exercises,'license':lic,'licenseEvidence':evidence,'links':links}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--offline',action='store_true'); args=parser.parse_args()
    CACHE.mkdir(parents=True,exist_ok=True); DEST.mkdir(parents=True,exist_ok=True)
    cached={}
    for path in CACHE.glob('*.json'):
        try:
            data=json.loads(path.read_text(encoding='utf8'))
            if isinstance(data,dict) and data.get('url') and path.with_suffix('.html').exists(): cached[canonical(data['url'])]=path.with_suffix('.html')
        except (ValueError,KeyError): pass
    def fetch(url):
        path=cached.get(url)
        if not path:
            key=hashlib.sha256(url.encode()).hexdigest()[:16]; path=CACHE/(key+'.html')
            if not path.exists():
                if args.offline: raise ValueError('Not cached')
                last=None
                for attempt in range(3):
                    try:
                        req=urllib.request.Request(safe_url(url),headers={'User-Agent':'ENT-Math educational content import/1.0'})
                        with urllib.request.urlopen(req,timeout=35) as r: raw=r.read()
                        if b'mt-content-container' not in raw: raise ValueError('Unexpected source response')
                        path.write_bytes(raw); break
                    except Exception as error: last=error; time.sleep(attempt+1)
                else: raise last
        raw=path.read_bytes(); page=extract(raw.decode('utf8'),url)
        page.update(url=safe_url(url),sha256=hashlib.sha256(raw).hexdigest(),checkedAt=time.strftime('%Y-%m-%d'))
        path.with_suffix('.json').write_text(json.dumps({'url':url,'sha256':page['sha256'],'checkedAt':page['checkedAt'],'links':page['links']},ensure_ascii=False),encoding='utf8')
        return page
    index={'schemaVersion':1,'generatedAt':time.strftime('%Y-%m-%d'),'books':[],'pages':[],'failures':[]}
    for book_id,title,authors,root in BOOKS:
        root=canonical(root); pending={root}; seen=set(); pages=[]; failures=[]
        while pending:
            batch=sorted(pending-seen); pending=set()
            if not batch: break
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                futures={pool.submit(fetch,url):url for url in batch}
                for future in concurrent.futures.as_completed(futures):
                    url=futures[future]; seen.add(url)
                    try:
                        page=future.result(); pages.append(page)
                        for link in page.pop('links') if url!=root or page['license'] in (None,'CC BY 4.0') else []:
                            if link.startswith(root+'/') and '?' not in link and not re.search(r'/@',link) and link not in seen: pending.add(link)
                    except Exception as error: failures.append({'bookId':book_id,'url':safe_url(url),'reason':str(error)[:200]})
            print(json.dumps({'book':book_id,'downloaded':len(pages),'pending':len(pending),'failed':len(failures)}),flush=True)
        root_page=next((p for p in pages if canonical(p['url'])==root),{})
        root_license=root_page.get('license'); accepted=[]
        for page in sorted(pages,key=lambda p:p['url']):
            inherited=not page['license']; license,licensor=inherited_license(page,pages)
            page_id=hashlib.sha256(canonical(page['url']).encode()).hexdigest()[:20]
            summary={k:page[k] for k in ['url','title','sha256','checkedAt']}
            summary.update(id=page_id,bookId=book_id,license=license,licenseInherited=inherited,
                candidateCount=len(page['exercises']),figureCount=len(page['figures']),topicIds=[],mappingStatus='pending')
            # Never turn unavailable permission or a NC override into a CC BY grant.
            if license!='CC BY 4.0':
                summary.update(status='license-review',candidateCount=0)
            else:
                summary['status']='draft'; page.update(id=page_id,bookId=book_id,license=license,licenseInherited=inherited,
                    licenseSource=licensor.get('url'),licenseUrl='https://creativecommons.org/licenses/by/4.0/',
                    authors=authors,book=title,reviewStatus='unreviewed',sourceLanguage='en',translationStatus='pending')
                if inherited: page['licenseEvidence']=licensor.get('licenseEvidence','')
                (DEST/(page_id+'.json')).write_text(json.dumps(page,ensure_ascii=False,indent=2),encoding='utf8'); accepted.append(page)
            index['pages'].append(summary)
        index['books'].append({'id':book_id,'title':title,'authors':authors,'url':safe_url(root),'license':root_license,
            'discoveredPages':len(seen),'archivedPages':len(accepted),'failedPages':len(failures),
            'candidateCount':sum(len(p['exercises']) for p in accepted),'crawlComplete':not failures and root_license in (None,'CC BY 4.0'),
            'practiceReady':False,'licenseReviewPages':len(pages)-len(accepted)})
        index['failures'].extend(failures)
        # Crawling must not overwrite the indexed library serving an open editor.
        staging=DEST/'crawl-index.tmp'
        staging.write_text(json.dumps(index,ensure_ascii=False,indent=2),encoding='utf8')
        staging.replace(DEST/'crawl-index.json')
    print(json.dumps({'books':index['books'],'failures':len(index['failures'])},ensure_ascii=False),flush=True)

if __name__=='__main__': main()
