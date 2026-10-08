/** Original source archive is separate from checked, bilingual practice tasks. */
export type SourceCandidate={ordinal:number;sourceNumber:string;sourceAnchor:string;kind:string;context:string;original:string;prompt:string;sourceAnswers:string[];hasFigure:boolean;status:'draft';answerVerified:false;translationStatus:'pending';mappingStatus:'pending'};
export type SourcePage={id:string;bookId:string;title:string;url:string;sha256:string;checkedAt:string;originalText:string;references?:{text:string;url:string}[];figures:{url:string;alt:string;credit:string}[];exercises:SourceCandidate[];license:string;licenseInherited:boolean;licenseSource:string;licenseUrl:string;licenseEvidence:string;authors:string;book:string;reviewStatus:'unreviewed';sourceLanguage:'en';translationStatus:'pending'};
export type SourceSummary={id:string;bookId:string;title:string;url:string;status:string;candidateCount:number;figureCount:number;topicIds:string[];mappingStatus:string};
export type SourceBook={id:string;title:string;authors:string;archivedPages:number;failedPages:number;candidateCount:number;licenseReviewPages:number;crawlComplete:boolean;practiceReady:boolean};
export type SourceIndex={books:SourceBook[];pages:SourceSummary[];topics:{id:string;title:{ru:string;kk:string};sections:number}[];blockedSources:{title:string;url:string;reason:string}[]};
export function querySourceLibrary(index:SourceIndex,params:URLSearchParams){
 const query=(params.get('q')||'').trim().toLocaleLowerCase().slice(0,200),book=params.get('book'),topic=params.get('topic');
 const filtered=index.pages.filter(p=>(!book||p.bookId===book)&&(!topic||p.topicIds.includes(topic))&&(!query||`${p.title} ${p.url}`.toLocaleLowerCase().includes(query)));
 const value=Number(params.get('page')||0),page=Number.isFinite(value)?Math.max(0,Math.min(Math.floor(value),Math.max(0,Math.ceil(filtered.length/20)-1))):0;
 return {books:index.books,topics:index.topics,blockedSources:index.blockedSources,pages:filtered.slice(page*20,page*20+20),total:filtered.length,page,pageSize:20};
}
