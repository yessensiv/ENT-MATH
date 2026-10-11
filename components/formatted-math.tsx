import {createElement, Fragment} from 'react';
import {mathSegments, type MathNode} from '../lib/math-format';

function notation(node: MathNode): React.ReactNode {
  if ('value' in node) return createElement(node.kind === 'number' ? 'mn' : node.kind === 'variable' ? 'mi' : 'mo', null, node.value);
  const children = node.children.map((child,index)=><Fragment key={index}>{notation(child)}</Fragment>);
  if (node.kind === 'group') return createElement('mrow',null,createElement('mo',null,'('),...children,createElement('mo',null,')'));
  return createElement({fraction:'mfrac',power:'msup',root:'msqrt',row:'mrow'}[node.kind],null,...children);
}

/** Native MathML, accessible and safe: text is never interpreted as HTML. */
export default function FormattedMath({text}:{text:string}) {
  return <>{mathSegments(text).map((part,index)=>part.math
    ? <span key={index} className="math-run">{createElement('math',{className:'formatted-math',xmlns:'http://www.w3.org/1998/Math/MathML','aria-label':part.text},notation(part.math))}</span>
    : <Fragment key={index}>{part.text}</Fragment>)}</>;
}
