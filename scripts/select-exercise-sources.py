"""Cache an explicitly selected set of exercise sections for manual adaptation."""
import concurrent.futures,glob,json,subprocess,sys
sections=sys.argv[1:]
urls=[]
for path in glob.glob('.sites-runtime/source-review/*.json'):
    for url in json.load(open(path,encoding='utf-8'))['links']:
        if url.startswith('https://math.libretexts.org/') and any('/'+s in url for s in sections) and ('Exercises' in url or '(Exercises)' in url): urls.append(url)
urls=list(dict.fromkeys(urls))
def run(url):
    r=subprocess.run([sys.executable,'scripts/cache-exercise-source.py',url],capture_output=True,text=True,encoding='utf-8')
    return r.stdout.strip() if r.returncode==0 else 'FAILED '+url
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for result in pool.map(run,urls):print(result,flush=True)
