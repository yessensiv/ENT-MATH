import MathText from './formatted-math';

/** Render text as React nodes: model output never becomes executable HTML. */
function Inline({text}:{text:string}) {
  return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part,i)=>{
    if(part.startsWith('**'))return <strong key={i}><MathText text={part.slice(2,-2)}/></strong>;
    if(part.startsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
    return <MathText key={i} text={part}/>;
  })}</>;
}
export default function TutorMessage({text}:{text:string}) {
  const lines=text.replace(/\r\n?/g,'\n').split('\n');
  const blocks:{kind:'paragraph'|'step'|'answer'|'formula'|'heading';text:string;number?:string}[]=[];
  for(const raw of lines){
    const line=raw.trim();if(!line)continue;
    const step=line.match(/^(\d+)[.)]\s*(.+)$/);
    if(step){blocks.push({kind:'step',number:step[1],text:step[2]});continue;}
    if(/^(?:\*\*)?(?:Ответ|Жауабы|Жауап|Итог|Нәтиже)\s*:/i.test(line)){blocks.push({kind:'answer',text:line});continue;}
    if(/^#{1,4}\s/.test(line)){blocks.push({kind:'heading',text:line.replace(/^#{1,4}\s+/,'')});continue;}
    const formula=/[=<>≤≥]/.test(line)&&!/[а-яәғқңөұүһі]{4}/i.test(line)&&line.length<180;
    blocks.push({kind:formula?'formula':'paragraph',text:line.replace(/^[-•]\s+/,'• ')});
  }
  return <div className="tutor-prose">{blocks.map((block,i)=>{
    if(block.kind==='step')return <div className="tutor-solution-step" key={i}><span className="tutor-step-badge" aria-hidden="true">{block.number}</span><p><Inline text={block.text}/></p></div>;
    if(block.kind==='heading')return <h4 key={i}><Inline text={block.text}/></h4>;
    return <p key={i} className={`tutor-${block.kind}`}><Inline text={block.text}/></p>;
  })}</div>;
}
