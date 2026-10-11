export type MathNode = { kind: 'number' | 'variable'; value: string } | { kind: 'fraction' | 'power' | 'subscript' | 'root' | 'group'; children: MathNode[] } | { kind: 'row'; children: MathNode[] } | { kind: 'operator'; value: string };

/** Fixed tags and escaped text only, for downloadable lessons. */
export function mathematicalHtml(text:string):string {
  const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const render=(node:MathNode):string=>{
    if('value' in node){const tag=node.kind==='number'?'mn':node.kind==='variable'?'mi':'mo';return `<${tag}>${escape(node.value)}</${tag}>`;}
    if(node.kind==='group')return `<mrow><mo>(</mo>${node.children.map(render).join('')}<mo>)</mo></mrow>`;
    const tag={fraction:'mfrac',power:'msup',subscript:'msub',root:'msqrt',row:'mrow'}[node.kind];return `<${tag}>${node.children.map(render).join('')}</${tag}>`;
  };
  return mathSegments(text).map(part=>part.math?`<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="${escape(part.text)}">${render(part.math)}</math>`:escape(part.text)).join('');
}

/** Presentation only: never used to evaluate or change the stored answer. */
export function parseMath(source: string): MathNode | null {
  // A comma between two fractions separates values, rather than decimals.
  if (/\/\d+,\s*[-+]?\d+\//.test(source)) return null;
  source = source.replace(/²/g, '^2').replace(/³/g, '^3').replace(/(\d)[ \u00a0\u202f](?=\d{3}\b)/g,'$1');
  const tokens = source.match(/sqrt|\d+(?:[.,]\d+)?|[a-zA-Z]|[()+−\-*/×·÷^=<>≤≥√]/g);
  if (!tokens || tokens.join('') !== source.replace(/\s/g, '') || tokens.length > 160) return null;
  let position = 0;
  const row = (nodes: MathNode[]): MathNode => nodes.length === 1 ? nodes[0] : { kind: 'row', children: nodes };
  function atom(): MathNode {
    const token = tokens![position++];
    if (!token) throw new Error('Missing operand');
    if (token === '-' || token === '−' || token === '+') return row([{kind:'operator',value:token === '-' ? '−' : token}, atom()]);
    if (token === '(') {
      const node = expression();
      if (tokens![position++] !== ')') throw new Error('Unclosed group');
      return {kind:'group',children:[node]};
    }
    if (token === 'sqrt' || token === '√') {
      const node = atom();
      return {kind:'root',children:[node.kind === 'group' ? node.children[0] : node]};
    }
    if (/^\d/.test(token)) return {kind:'number',value:token};
    if (/^[a-zA-Z]$/.test(token)) return {kind:'variable',value:token};
    throw new Error('Invalid operand');
  }
  function power(): MathNode {
    const base = atom();
    if (tokens![position] !== '^') return base;
    position++;
    const exponent = power();
    return {kind:'power',children:[base, exponent.kind === 'group' ? exponent.children[0] : exponent]};
  }
  function product(): MathNode {
    let left = power();
    while (['/','÷','*','×','·'].includes(tokens![position]) || /^(?:[a-zA-Z]|sqrt|\(|√)$/.test(tokens![position] ?? '')) {
      if (!['/','÷','*','×','·'].includes(tokens![position])) {
        left = row([left,power()]);
        continue;
      }
      const operator = tokens![position++];
      const right = power();
      if (operator === '/' || operator === '÷') {
        const ungroup = (n: MathNode) => n.kind === 'group' ? n.children[0] : n;
        left = {kind:'fraction',children:[ungroup(left),ungroup(right)]};
      } else left = row([left,{kind:'operator',value:'·'},right]);
    }
    return left;
  }
  function expression(): MathNode {
    const nodes = [product()];
    while (['+','-','−','=','<','>','≤','≥'].includes(tokens![position])) {
      const operator = tokens![position++];
      nodes.push({kind:'operator',value:operator === '-' ? '−' : operator}, product());
    }
    return row(nodes);
  }
  try { const result = expression(); return position === tokens.length ? result : null; } catch { return null; }
}

export function mathSegments(text: string): {text:string; math:MathNode|null}[] {
  text=text.replace('дробь можно ввести через /','используй кнопку дроби для ввода').replace('бөлшекті / арқылы енгізуге болады','енгізу үшін бөлшек батырмасын қолдан');
  if(/последняя цифра|соңғы цифр/.test(text))text=text.replace(/2\/5\/10/g,'2, 5, 10').replace(/3\/9/g,'3, 9');
  const alternatives: Record<string,string>={'номер/число':'номер или число','нөмір/мүшелер':'нөмір немесе мүшелер','выше/ниже':'выше или ниже','жоғары/төмен':'жоғары немесе төмен','пересекаться/быть':'пересекаться или быть','қиылысуы/параллель':'қиылысуы немесе параллель','вправо/влево':'вправо или влево','вверх/вниз':'вверх или вниз','оңға/солға':'оңға немесе солға','левая/правая':'левая или правая','центр/нормаль/направление':'центр, нормаль или направление','Центрді/нормальді/бағытты':'Центрді, нормальді немесе бағытты'};
  for(const [from,to]of Object.entries(alternatives))text=text.replaceAll(from,to);

  if(/[\/^√]/.test(text)&&!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const math=parseMath(text);if(math)return [{text:'',math:null},{text,math},{text:'',math:null}];
  }
  return fallbackSegments(text);
}

// Local fallback handles notation embedded in prose, units and function names.
// It changes presentation only and preserves unknown operands verbatim.
function fallbackSegments(text: string): {text:string; math:MathNode|null}[] {
  const parts: {text:string;math:MathNode|null}[]=[];
  const protectedRanges=Array.from(text.matchAll(/https?:\/\/[^\s]+|\b\d{1,2}\/\d{1,2}\/\d{4}\b/g),m=>[m.index!,m.index!+m[0].length]);
  const literal=(value:string):MathNode=>{
    const parsed=parseMath(value);if(parsed)return parsed;
    const nested=fallbackSegments(value);
    return nested.some(p=>p.math)?{kind:'row',children:nested.filter(p=>p.text).map(p=>p.math??{kind:'variable',value:p.text})}:{kind:'variable',value};
  };
  function groupEnd(start:number):number {
    const close=text[start]==='(' ? ')' : '}';let depth=0;
    for(let i=start;i<text.length;i++){if(text[i]===text[start])depth++;else if(text[i]===close&&!--depth)return i+1;}return start;
  }
  function right(start:number, exponent=false):number {
    while(/\s/.test(text[start]??'')&&start<text.length)start++;
    if(text[start]==='√'){const end=right(start+1);return end>start+1?end:start;}
    if(text[start]==='('||text[start]==='{')return groupEnd(start);
    if(exponent&&text[start]==='?')return start+1;
    if(text[start]==='₸')return start+1;
    const found=text.slice(start).match(exponent?/^[+−-]?(?:(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?|[\p{L}₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻₊₋ₐₑₒₓ]+(?:_[\p{L}\d]+)?)/u:/^(?:(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+(?![\d/]))?[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻°]*|[\p{L}₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻₊₋ₐₑₒₓ]+(?:_[\p{L}\d]+)?[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻°]*)/u);
    let end=found?start+found[0].length:start;
    if(text[end]==='^')end=right(end+1,true);
    return end;
  }
  function left(end:number):number {
    while(end>0&&/\s/.test(text[end-1]))end--;
    if(text[end-1]===')'||text[end-1]==='}'){
      const close=text[end-1],open=close===')'?'(':'{';let depth=0;
      for(let i=end-1;i>=0;i--){if(text[i]===close)depth++;else if(text[i]===open&&!--depth){const name=text.slice(0,i).match(/(?:sqrt|sin|cos|tan|tg|ctg|ln|log)$/);return name?i-name[0].length:i;}}return end;
    }
    if(text[end-1]==='₸')return end-1;
    if(text[end-1]==='|'){const start=text.lastIndexOf('|',end-2);if(start>=0)return start;}
    const found=text.slice(0,end).match(/(?:(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?|[\p{L}₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻₊₋ₐₑₒₓ]+(?:_[\p{L}\d]+)?)[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻°]*$/u);
    let start=found?end-found[0].length:end;
    if(start>0&&text[start-1]==='/'&&text.slice(start,end).includes(','))start+=text.slice(start,end).lastIndexOf(',')+1;
    if(start>0&&text[start-1]==='^')start=left(start-1);
    return start;
  }
  const candidates:{start:number;end:number;operator:number}[]=[];
  for(let i=0;i<text.length;i++){
    if(!['/','^'].includes(text[i])||protectedRanges.some(([a,b])=>i>=a&&i<b))continue;
    const start=left(i),end=right(i+1,text[i]==='^');
    if(text[i]==='/' && /^(?:номер\/число|нөмір\/мүшелер|выше\/ниже|жоғары\/төмен|пересекаться\/быть|қиылысуы\/параллель|вправо\/влево|вверх\/вниз|оңға\/солға|левая\/правая|центр\/нормаль|нормаль\/направление|Центрді\/нормальді|нормальді\/бағытты)$/u.test(text.slice(start,end)))continue;
    if(start===i||end<=i+1)continue;
    candidates.push({start,end,operator:i});
  }
  const selected=candidates.sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0];
  if(selected){
    for(const match of text.matchAll(/sqrt\s*\(|√/g)){
      const start=match.index!,operandStart=match[0].startsWith('sqrt')?start+match[0].indexOf('('):start+1,end=right(operandStart);
      if(start>selected.start||end<selected.end||protectedRanges.some(([a,b])=>start>=a&&start<b))continue;
      const operand=text.slice(operandStart,end).trim(),value=operand.startsWith('(')&&operand.endsWith(')')?operand.slice(1,-1):operand;
      return [...fallbackSegments(text.slice(0,start)),{text:text.slice(start,end),math:{kind:'root',children:[literal(value)]}},...fallbackSegments(text.slice(end))];
    }
  }
  if(!selected){
    // Roots in prose and code spans must use the same native notation as fractions.
    for(const match of text.matchAll(/sqrt\s*\(|√/g)){
      const start=match.index!;
      if(protectedRanges.some(([a,b])=>start>=a&&start<b))continue;
      const operandStart=match[0].startsWith('sqrt')?start+match[0].indexOf('('):start+1;
      const end=right(operandStart);
      if(end<=operandStart)continue;
      const operand=text.slice(operandStart,end).trim();
      const value=operand.startsWith('(')&&operand.endsWith(')')?operand.slice(1,-1):operand;
      return [...fallbackSegments(text.slice(0,start)),{text:text.slice(start,end),math:{kind:'root',children:[literal(value)]}},...fallbackSegments(text.slice(end))];
    }
    const scripts=/([A-Za-z]+|\d+)([₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]+|[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]+)/g;
    let cursor=0;
    for(const match of text.matchAll(scripts)){
      if(protectedRanges.some(([a,b])=>match.index!>=a&&match.index!<b))continue;
      parts.push({text:text.slice(cursor,match.index),math:null});
      const sub=/[₀-₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]/.test(match[2]);
      const glyphs=sub?'₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ':'⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻ',normal=sub?'0123456789aehijklmnoprstuvx':'0123456789n+−abcdefghijklmoprstuvwxyz';
      const value=Array.from(match[2],c=>normal[glyphs.indexOf(c)]).join('');
      parts.push({text:match[0],math:{kind:sub?'subscript':'power',children:[{kind:/^\d/.test(match[1])?'number':'variable',value:match[1]},{kind:/^\d+$/.test(value)?'number':'variable',value}]}});
      cursor=match.index!+match[0].length;
    }
    parts.push({text:text.slice(cursor),math:null});return parts;
  }
  const {start,end,operator}=selected;
  const a=text.slice(start,operator).trim(),b=text.slice(operator+1,end).trim();
  const unwrap=(value:string)=>value.startsWith('(')&&value.endsWith(')')?value.slice(1,-1):value;
  parts.push(...fallbackSegments(text.slice(0,start)),{text:text.slice(start,end),math:{kind:text[operator]==='/'?'fraction':'power',children:[literal(text[operator]==='/'?unwrap(a):a),literal(unwrap(b).replace(/^\{|\}$/g,''))]}},...fallbackSegments(text.slice(end)));
  return parts;
}
