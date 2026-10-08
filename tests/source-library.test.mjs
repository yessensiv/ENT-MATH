import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {querySourceLibrary} from '../lib/source-library.ts';
import {sourceExercises} from '../lib/source-exercises.ts';
const root=new URL('../content/source-library/',import.meta.url);
const index=JSON.parse(readFileSync(new URL('index.json',root),'utf8'));

test('source archive IDs, page totals, provenance and draft status agree',()=>{
 const ids=new Set(),practiceIds=new Set(sourceExercises.map(t=>t.id));
 for(const row of index.pages){
  assert.ok(!ids.has(row.id));ids.add(row.id);assert.ok(!practiceIds.has(row.id));
  assert.match(row.sha256,/^[a-f0-9]{64}$/);
  assert.ok(['math.libretexts.org','stats.libretexts.org'].includes(new URL(row.url).hostname));
  if(row.status!=='draft')continue;
  const p=JSON.parse(readFileSync(new URL(row.id+'.json',root),'utf8'));
  assert.equal(p.id,row.id);assert.equal(p.license,'CC BY 4.0');assert.equal(p.reviewStatus,'unreviewed');assert.equal(p.translationStatus,'pending');
  assert.ok(p.licenseEvidence.includes('is shared under'));assert.ok(p.licenseSource);assert.equal(p.exercises.length,row.candidateCount);
  assert.equal(p.figures.length,row.figureCount);
  for(const e of p.exercises){assert.equal(e.status,'draft');assert.equal(e.answerVerified,false);assert.ok(e.original);assert.equal(e.mappingStatus,'pending');}
 }
 for(const b of index.books){
  const pages=index.pages.filter(p=>p.bookId===b.id),archived=pages.filter(p=>p.status==='draft');
  assert.equal(archived.length,b.archivedPages);assert.equal(archived.reduce((n,p)=>n+p.candidateCount,0),b.candidateCount);
  assert.equal(b.practiceReady,false);
 }
});
test('topic suggestions reference known topics and never certify individual skill mapping',()=>{
 const ids=new Set(index.topics.map(t=>t.id));
 assert.equal(ids.size,121);
 for(const p of index.pages)for(const id of p.topicIds){assert.ok(ids.has(id));assert.equal(p.mappingStatus,'suggested-section');}
 for(const t of index.topics)assert.equal(t.sections,index.pages.filter(p=>p.status==='draft'&&p.topicIds.includes(t.id)).length);
});
test('library query filters intersect, pages are bounded and hostile input stays data',()=>{
 const params=new URLSearchParams({book:index.books[0].id,topic:'numbers'}),data=querySourceLibrary(index,params);
 assert.ok(data.total>0);assert.ok(data.pages.every(p=>p.bookId===index.books[0].id&&p.topicIds.includes('numbers')));
 assert.ok(data.pages.length<=20);
 assert.equal(querySourceLibrary(index,new URLSearchParams({page:'NaN'})).page,0);
 assert.equal(querySourceLibrary(index,new URLSearchParams({page:'-5'})).page,0);
 assert.equal(querySourceLibrary(index,new URLSearchParams({q:'<script>never-a-title</script>'})).total,0);
});
test('cached source hashes and internal crawl coverage can be audited without network',()=>{
 const cache=new URL('../.sites-runtime/source-review/',import.meta.url);
 // Optional local audit: CI packages do not include the ignored download cache.
 const available=new Set(index.pages.map(p=>decodeURIComponent(p.url).replace(/\/$/,'')));
 let checked=0;
 for(const row of index.pages){
  const canonical=decodeURIComponent(row.url).replace(/\/$/,''),key=createHash('sha256').update(canonical).digest('hex').slice(0,16),file=new URL(key+'.html',cache);
  if(!existsSync(file))continue;
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),row.sha256);checked++;
  const metadata=new URL(key+'.json',cache);if(!existsSync(metadata))continue;
  const book=index.books.find(b=>b.id===row.bookId);if(!book.crawlComplete)continue;
  const prefix=decodeURIComponent(book.url)+'/';
  for(const link of JSON.parse(readFileSync(metadata,'utf8')).links){
   const normalized=decodeURIComponent(link).replace(/\/$/,'');
   if(normalized.startsWith(prefix)&&!normalized.includes('/@'))assert.ok(available.has(normalized),`Unvisited ${normalized}`);
  }
 }
 assert.ok(checked>=0);
});
