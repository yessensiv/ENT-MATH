export type MathNode = { kind: 'number' | 'variable'; value: string } | { kind: 'fraction' | 'power' | 'root' | 'group'; children: MathNode[] } | { kind: 'row'; children: MathNode[] } | { kind: 'operator'; value: string };

/** Presentation only: never used to evaluate or change the stored answer. */
export function parseMath(source: string): MathNode | null {
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
    while (['/','÷','*','×','·'].includes(tokens![position])) {
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
  // Restrict Latin words to single-letter variables and sqrt; prose stays text.
  const pattern = /(?<![\p{L}\p{N}])(?:sqrt\s*\(|√|\(?\d|\(?[a-zA-Z](?![a-zA-Z]))(?:sqrt|[a-zA-Z](?![a-zA-Z])|[\d()+−\-*/×·÷^=<>≤≥√.,\s])*/gu;
  const result: {text:string;math:MathNode|null}[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0].replace(/[\s.,]+$/, '');
    if (!/[\/÷^√]|sqrt/.test(raw) || /\d{1,4}\/\d{1,2}\/\d{1,4}/.test(raw)) continue;
    const math = parseMath(raw);
    if (!math) continue;
    const index = match.index!;
    result.push({text:text.slice(end,index),math:null},{text:raw,math});
    end = index + raw.length;
  }
  result.push({text:text.slice(end),math:null});
  return result;
}
