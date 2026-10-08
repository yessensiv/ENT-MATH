"""Cache selected linked sections, retaining exact URLs observed in an index."""
import concurrent.futures, json, pathlib, re, subprocess, sys
root=pathlib.Path('.sites-runtime/source-review')
keys,pattern=sys.argv[1].split(','),re.compile(sys.argv[2])
urls=[]
for key in keys:
    data=json.loads((root/(key+'.json')).read_text(encoding='utf-8'))
    urls.extend(u for u in data['links'] if u.startswith('https://math.libretexts.org/Bookshelves/') and pattern.search(u))
urls=list(dict.fromkeys(urls))
def cache(url):
    run=subprocess.run([sys.executable,'scripts/cache-exercise-source.py',url],capture_output=True,text=True,encoding='utf-8')
    return run.stdout.strip() if run.returncode==0 else 'FAILED '+url
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for result in pool.map(cache,urls):print(result,flush=True)
