import FormattedMath from './formatted-math';

/** Native select options cannot contain mathematical layout. */
export default function MathOptions({label,options,value,onChange}:{label:string;options:{value:string;label:string}[];value:string;onChange:(value:string)=>void}) {
  return <div className="math-options" role="group" aria-label={label}>{options.map(option=><button type="button" className={`secondary ${value===option.value?'selected':''}`} aria-pressed={value===option.value} key={option.value} onClick={()=>onChange(option.value)}><FormattedMath text={option.label}/></button>)}</div>;
}
