"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type SVGProps, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeftRight, Box, Circle, FunctionSquare, Lightbulb, Percent, RotateCcw, Triangle } from "lucide-react";

type Lang = "ru" | "kk";
type Visual = "functions" | "inequalities" | "trig" | "geometry" | "solids" | "fractions";
type Copy = { lang: Lang };
const green = "#19775C";
const purple = "#8772B6";
const choose = (lang: Lang, ru: string, kk: string) => lang === "ru" ? ru : kk;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const fmt = (n: number, digits = 2) => Number(n.toFixed(digits)).toLocaleString("ru-RU");
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
const angleInPi = (angle: number) => {
  if (angle === 0) return "0";
  const d = gcd(angle, 180); const numerator = angle / d; const denominator = 180 / d;
  return `${numerator === 1 ? "" : numerator}π${denominator === 1 ? "" : `/${denominator}`}`;
};

export function convertFractionParts(numerator: number, denominator: number, nextDenominator: number) {
  if (![numerator, denominator, nextDenominator].every(Number.isInteger) || denominator <= 0 || nextDenominator <= 0 || numerator < 0 || numerator > denominator) {
    throw new RangeError("Fraction tiles require whole, non-negative parts and positive totals.");
  }
  const requestedParts = numerator / denominator * nextDenominator;
  const parts = Math.round(requestedParts);
  return { parts, rounded: Math.abs(parts - requestedParts) > 1e-9, originalPercent: numerator / denominator * 100, actualPercent: parts / nextDenominator * 100 };
}

export function Mascot({ size = 160, className = "" }: { size?: number; className?: string }) {
  return <svg className={`mascot ${className}`} width={size} height={size * 0.91} viewBox="0 0 220 200" role="img" aria-label="Наставник ENT Math">
    <ellipse cx="107" cy="181" rx="68" ry="9" fill="#172D2A" opacity="0.07" />
    <path d="M48 107C22 111 25 146 47 146L72 126Z" fill="#9DD8BD" stroke="#19775C" strokeWidth="3" />
    <path d="M159 101C185 102 193 127 169 143L145 119Z" fill="#9DD8BD" stroke="#19775C" strokeWidth="3" />
    <path d="M55 61L50 29L83 46C100 40 122 40 139 47L170 30L164 65C181 94 171 148 153 163C134 181 83 181 64 162C42 146 36 94 55 61Z" fill="#B8E7CF" stroke="#19775C" strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M59 57L57 42L76 51M143 52L160 43L157 61" fill="#19775C" opacity="0.45" />
    <path d="M75 147C82 124 141 124 149 147C142 166 85 171 75 147Z" fill="#E9F5EF" />
    <path d="M85 64L99 73L111 60L122 73L136 64" fill="none" stroke="#19775C" strokeWidth="3" strokeLinecap="round" />
    <circle cx="81" cy="98" r="27" fill="#F6FBF8" stroke="#19775C" strokeWidth="3" />
    <circle cx="140" cy="98" r="27" fill="#F6FBF8" stroke="#19775C" strokeWidth="3" />
    <path d="M108 97H113" stroke="#19775C" strokeWidth="4" />
    <ellipse cx="84" cy="98" rx="8" ry="12" fill="#172D2A" />
    <ellipse cx="137" cy="98" rx="8" ry="12" fill="#172D2A" />
    <circle cx="87" cy="94" r="3" fill="white" /><circle cx="140" cy="94" r="3" fill="white" />
    <path d="M102 118L111 130L120 118Z" fill="#E4B854" stroke="#B8923D" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M81 136L91 140M131 140L141 136" stroke="#19775C" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
    <path d="M84 171L77 180H95L99 172M129 173L132 180H149L141 171" fill="#DDAE44" stroke="#A47B29" strokeWidth="2" strokeLinejoin="round" />
    <g transform="rotate(24 181 129)">
      <path d="M174 78H188V157L181 175L174 157Z" fill="#F9E6A0" stroke="#9C812E" strokeWidth="2" strokeLinejoin="round" />
      <path d="M174 78V69Q181 61 188 69V78Z" fill="#C7BCE8" stroke="#8772B6" strokeWidth="2" />
      <path d="M181 81V154" stroke="#D1AA4C" strokeWidth="3" /><path d="M178 167L181 175L184 167Z" fill="#172D2A" />
      <path d="M174 78H188" stroke="#8772B6" strokeWidth="3" />
    </g>
    <path d="M167 120Q181 113 185 124Q186 132 174 134" fill="#9DD8BD" stroke="#19775C" strokeWidth="3" strokeLinecap="round" />
    <path d="M29 53H42M35.5 46.5V59.5" stroke="#C4B9DF" strokeWidth="3" strokeLinecap="round" />
    <circle cx="191" cy="47" r="4" fill="#F0D17C" />
  </svg>;
}

function Slider({ label, value, min, max, step = 1, onChange, unit = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  const id = useId();
  return <label className="mv-slider" htmlFor={id}><span>{label}<output htmlFor={id}>{fmt(value)}{unit}</output></span><input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${fmt(value)}${unit}`} onChange={e => onChange(Number(e.target.value))} /></label>;
}

function SvgCanvas(props: SVGProps<SVGSVGElement>) {
  const svg = useRef<SVGSVGElement>(null);
  const [textSize, setTextSize] = useState(14);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const update = () => {
      const width = element.getBoundingClientRect().width;
      if (width > 0) setTextSize(clamp(14 * 600 / width, 8, 40));
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <svg {...props} ref={svg} style={{ ...props.style, "--mv-svg-font-size": `${textSize}px` } as CSSProperties}>{props.children}</svg>;
}

function Experiment({ lang, task, fallback, children }: Copy & { task: string; fallback: string; children: ReactNode }) {
  return <><div className="mv-experiment"><Lightbulb size={19} aria-hidden="true" /><div><strong>{choose(lang, "Попробуй и заметишь", "Өзгертіп, байқа")}</strong><p>{task}</p></div></div><div className="mv-workbench">{children}</div><details className="mv-explanation"><summary>{choose(lang, "Объяснение словами", "Сөзбен түсіндіру")}</summary><p>{fallback}</p></details></>;
}

function Reset({ lang, onClick }: Copy & { onClick: () => void }) {
  return <button type="button" className="mv-reset" onClick={onClick}><RotateCcw size={15} aria-hidden="true" />{choose(lang, "Сбросить", "Қалпына келтіру")}</button>;
}

function GraphVisual({ lang }: Copy) {
  const [a, setA] = useState(1); const [b, setB] = useState(0); const [c, setC] = useState(0);
  const clip = useId().replace(/:/g, "");
  const path = Array.from({ length: 241 }, (_, i) => { const x = -6 + i / 20; return `${i ? "L" : "M"}${300 + x * 40},${170 - (a * x * x + b * x + c) * 40}`; }).join(" ");
  const formula = `y = ${fmt(a)}x² ${b < 0 ? "−" : "+"} ${fmt(Math.abs(b))}x ${c < 0 ? "−" : "+"} ${fmt(Math.abs(c))}`;
  const vertexX = a === 0 ? null : -b / (2 * a);
  const vertexY = vertexX === null ? null : a * vertexX * vertexX + b * vertexX + c;
  return <Experiment lang={lang} task={choose(lang, "Увеличь c на 1: куда сдвинулся график? Затем сделай a отрицательным и посмотри, куда направлены ветви.", "c мәнін 1-ге арттыр: график қайда жылжыды? Содан кейін a мәнін теріс етіп, тармақтардың бағытын бақыла.")} fallback={choose(lang, `В формуле y = ax² + bx + c число c поднимает или опускает весь график. При a > 0 ветви смотрят вверх, при a < 0 — вниз. Чем больше |a|, тем уже парабола. При a = 0 график становится прямой. Сейчас y при x = 0 равен ${fmt(c)}.`, `y = ax² + bx + c формуласындағы c графикті жоғары немесе төмен жылжытады. a > 0 болса, тармақтар жоғары, a < 0 болса, төмен қарайды. |a| артқан сайын парабола тарылады. a = 0 кезінде түзу пайда болады. Қазір x = 0 болғанда y = ${fmt(c)}.`)}>
    <div className="mv-canvas"><div className="mv-canvas-label">{formula}</div><SvgCanvas viewBox="0 0 600 340" role="img" aria-label={choose(lang, "График функции. Текущая формула: ", "Функция графигі. Қазіргі формула: ") + formula}>
      <defs><clipPath id={clip}><rect x="25" y="15" width="550" height="310" rx="8" /></clipPath></defs>
      {Array.from({ length: 13 }, (_, i) => <line key={`v${i}`} x1={60 + i * 40} x2={60 + i * 40} y1="15" y2="325" stroke="#E5ECE8" />)}
      {Array.from({ length: 9 }, (_, i) => <line key={`h${i}`} x1="25" x2="575" y1={10 + i * 40} y2={10 + i * 40} stroke="#E5ECE8" />)}
      <path d="M25 170H575M300 325V15" stroke="#A9BDB4" strokeWidth="1.5" /><path d="M568 166L575 170L568 174M296 23L300 15L304 23" stroke="#A9BDB4" fill="none" />
      {[-4, -2, 2, 4, 6].map(n => <text key={n} x={300 + n * 40} y="190" textAnchor="middle">{n}</text>)}
      {[-3, -2, -1, 1, 2, 3].map(n => <text key={n} x="287" y={175 - n * 40} textAnchor="end">{n}</text>)}
      <text x="307" y="190">0</text><text x="572" y="157">x</text><text x="313" y="35">y</text>
      <path d={path} stroke={green} strokeWidth="3.5" fill="none" clipPath={`url(#${clip})`} />
      <circle cx="300" cy={170 - c * 40} r="5" fill={purple} stroke="white" strokeWidth="2" />
      {vertexX !== null && vertexY !== null && Math.abs(vertexX) < 6 && Math.abs(vertexY) < 3.7 && <circle cx={300 + vertexX * 40} cy={170 - vertexY * 40} r="5" fill={green} stroke="white" strokeWidth="2" />}
    </SvgCanvas><div className="mv-legend"><span><i />{choose(lang, "График функции", "Функция графигі")}</span><span><i style={{ background: purple }} />{choose(lang, "Пересечение с осью y", "y осімен қиылысу")}</span></div></div>
    <div className="mv-controls"><p className="mv-control-title">{choose(lang, "Коэффициенты", "Коэффициенттер")}</p><Slider label="a" value={a} min={-2} max={2} step={0.25} onChange={setA} /><Slider label="b" value={b} min={-4} max={4} step={0.5} onChange={setB} /><Slider label="c" value={c} min={-3} max={3} step={0.5} onChange={setC} /><div className="mv-result"><span>{choose(lang, "При x = 1", "x = 1 болғанда")}</span><strong>y = {fmt(a + b + c)}</strong></div><Reset lang={lang} onClick={() => { setA(1); setB(0); setC(0); }} /></div>
  </Experiment>;
}

function NumberLine({ lang }: Copy) {
  const [left, setLeft] = useState(-1); const [right, setRight] = useState(3); const [closedL, setClosedL] = useState(true); const [closedR, setClosedR] = useState(false);
  const [mode, setMode] = useState("range");
  const mapX = (x: number) => 300 + x * 48;
  const answer = mode === "range" ? `${closedL ? "[" : "("}${fmt(left)}; ${fmt(right)}${closedR ? "]" : ")"}` : mode === "more" ? `${closedL ? "[" : "("}${fmt(left)}; +∞)` : `(-∞; ${fmt(left)}${closedL ? "]" : ")"}`;
  const relation = mode === "range" ? `${fmt(left)} ${closedL ? "≤" : "<"} x ${closedR ? "≤" : "<"} ${fmt(right)}` : `x ${mode === "more" ? (closedL ? "≥" : ">") : (closedL ? "≤" : "<")} ${fmt(left)}`;
  return <Experiment lang={lang} task={choose(lang, "Переключи закрашенную точку на пустую. Изменилось ли множество решений? Проверь, входит ли граничное число в ответ.", "Боялған нүктені ашық нүктеге ауыстыр. Шешімдер жиыны өзгерді ме? Шекарадағы сан жауапқа кіре ме?")} fallback={choose(lang, `Закрашенная точка означает, что граничное число входит в ответ: используется знак ≤ или ≥ и квадратная скобка. Пустая точка исключает границу: < или > и круглая скобка. Цветной участок содержит все подходящие x. Сейчас: ${relation}, ответ ${answer}.`, `Боялған нүкте шекарадағы санның жауапқа кіретінін білдіреді: ≤ немесе ≥ белгісі және тік жақша қолданылады. Ашық нүкте шекараны қоспайды: < немесе > белгісі және дөңгелек жақша. Түрлі түсті кесінді барлық жарамды x мәндерін көрсетеді. Қазір: ${relation}, жауап ${answer}.`)}>
    <div className="mv-canvas"><div className="mv-canvas-label">{relation}</div><SvgCanvas viewBox="0 0 600 310" role="img" aria-label={choose(lang, "Множество решений: ", "Шешімдер жиыны: ") + answer}>
      <rect x="24" y="123" width="552" height="54" rx="14" fill="#F3F7F5" />
      <rect x={mode === "less" ? 38 : mapX(left)} y="124" width={mode === "range" ? mapX(right) - mapX(left) : mode === "less" ? mapX(left) - 38 : 562 - mapX(left)} height="52" fill="#DAEEE3" />
      <path d="M26 150H574M34 145L26 150L34 155M566 145L574 150L566 155" stroke="#A9BDB4" strokeWidth="2" fill="none" />
      <line x1={mode === "less" ? 30 : mapX(left)} y1="150" x2={mode === "range" ? mapX(right) : mode === "less" ? mapX(left) : 570} y2="150" stroke={green} strokeWidth="5" />
      {Array.from({ length: 11 }, (_, i) => <g key={i}><line x1={60 + i * 48} x2={60 + i * 48} y1="145" y2="157" stroke="#8DA79C" /><text x={60 + i * 48} y="198" textAnchor="middle">{i - 5}</text></g>)}
      <circle cx={mapX(left)} cy="150" r="8" stroke={green} strokeWidth="3" fill={closedL ? green : "white"} />
      {mode === "range" && <circle cx={mapX(right)} cy="150" r="8" stroke={green} strokeWidth="3" fill={closedR ? green : "white"} />}
      <text x="300" y="263" textAnchor="middle" style={{ fontSize: "calc(var(--mv-svg-font-size, 14px) * 1.4)", fill: green, fontWeight: 700 }}>{answer}</text>
    </SvgCanvas></div><div className="mv-controls"><label className="mv-select">{choose(lang, "Вид неравенства", "Теңсіздік түрі")}<select value={mode} onChange={e => { if (e.target.value === "range") setLeft(Math.min(left, right - 0.5)); setMode(e.target.value); }}><option value="range">a &lt; x &lt; b</option><option value="more">x &gt; a</option><option value="less">x &lt; a</option></select></label><Slider label={choose(lang, "Граница a", "a шекарасы")} value={left} min={-4} max={mode === "range" ? right - 0.5 : 4} step={0.5} onChange={setLeft} /><label className="mv-check"><input type="checkbox" checked={closedL} onChange={e => setClosedL(e.target.checked)} />{choose(lang, "Включить границу a", "a шекарасын қосу")}</label>{mode === "range" && <><Slider label={choose(lang, "Граница b", "b шекарасы")} value={right} min={left + 0.5} max={4} step={0.5} onChange={setRight} /><label className="mv-check"><input type="checkbox" checked={closedR} onChange={e => setClosedR(e.target.checked)} />{choose(lang, "Включить границу b", "b шекарасын қосу")}</label></>}<Reset lang={lang} onClick={() => { setLeft(-1); setRight(3); setClosedL(true); setClosedR(false); setMode("range"); }} /></div>
  </Experiment>;
}

function UnitCircle({ lang }: Copy) {
  const [angle, setAngle] = useState(45); const [drag, setDrag] = useState(false);
  const rad = angle * Math.PI / 180; const x = 250 + 115 * Math.cos(rad); const y = 165 - 115 * Math.sin(rad);
  const move = (e: ReactPointerEvent<SVGSVGElement>) => { const box = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - box.left) / box.width * 600; const py = (e.clientY - box.top) / box.height * 340; setAngle(Math.round((Math.atan2(165 - py, px - 250) * 180 / Math.PI + 360) % 360)); };
  const arcEnd = Math.min(angle, 359.9) * Math.PI / 180;
  const arc = `M285,165A35,35 0 ${angle > 180 ? 1 : 0} 0 ${250 + 35 * Math.cos(arcEnd)},${165 - 35 * Math.sin(arcEnd)}`;
  return <Experiment lang={lang} task={choose(lang, "Поставь угол 90°, затем 180°. Что происходит с координатами точки? Найди угол, при котором sin α = cos α.", "Бұрышты 90°, кейін 180° етіп қой. Нүктенің координаталары қалай өзгереді? sin α = cos α болатын бұрышты тап.")} fallback={choose(lang, `Единичная окружность имеет радиус 1. Угол отсчитывается от правого направления оси x против часовой стрелки. Координаты точки: (cos α; sin α). При угле ${angle}° cos α = ${fmt(Math.cos(rad), 3)}, sin α = ${fmt(Math.sin(rad), 3)}. На 90° точка (0; 1), на 180° — (−1; 0).`, `Бірлік шеңбердің радиусы 1. Бұрыш x осінің оң бағытына қатысты сағат тіліне қарсы өлшенеді. Нүктенің координаталары: (cos α; sin α). ${angle}° бұрышта cos α = ${fmt(Math.cos(rad), 3)}, sin α = ${fmt(Math.sin(rad), 3)}. 90° кезінде нүкте (0; 1), 180° кезінде (−1; 0).`)}>
    <div className="mv-canvas"><div className="mv-canvas-label">α = {angle}° = {angleInPi(angle)}</div><SvgCanvas className="mv-draggable" viewBox="0 0 600 340" role="img" aria-label={choose(lang, "Единичная окружность. Угол ", "Бірлік шеңбер. Бұрыш ") + angle + "°"} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); move(e); }} onPointerMove={e => { if (drag) move(e); }} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}>
      <path d="M60 165H450M250 20V315" stroke="#B7C9C0" strokeWidth="1.5" />
      <circle cx="250" cy="165" r="115" stroke="#B7C9C0" strokeWidth="2" fill="#F4F9F6" />
      <path d={`M250 165L${x} 165L${x} ${y}Z`} fill="#DAEEE3" /><line x1="250" y1="165" x2={x} y2={y} stroke={green} strokeWidth="3" />
      <line x1="250" y1="165" x2={x} y2="165" stroke={purple} strokeWidth="4" /><line x1={x} y1="165" x2={x} y2={y} stroke="#DAAF43" strokeWidth="4" />
      <path d={arc} stroke={green} strokeWidth="2" fill="none" /><circle cx={x} cy={y} r="8" fill={green} stroke="white" strokeWidth="3" />
      <text x="378" y="184">1</text><text x="114" y="184">−1</text><text x="262" y="48">1</text><text x="262" y="293">−1</text><text x="259" y="186">0</text><text x="444" y="150">x</text><text x="263" y="35">y</text>
      <text x={x + (x > 250 ? 13 : -13)} y={y - 14} textAnchor={x > 250 ? "start" : "end"} fill={green}>P</text>
    </SvgCanvas><div className="mv-legend"><span><i style={{ background: purple }} />cos α</span><span><i style={{ background: "#DAAF43" }} />sin α</span><span>{choose(lang, "Перетаскивай точку", "Нүктені сүйре")}</span></div></div>
    <div className="mv-controls"><Slider label={choose(lang, "Угол α", "α бұрышы")} value={angle} min={0} max={360} onChange={setAngle} unit="°" /><div className="mv-presets">{[0, 30, 45, 60, 90, 180, 270].map(n => <button type="button" key={n} onClick={() => setAngle(n)} aria-pressed={angle === n}>{n}°</button>)}</div><div className="mv-result mv-result-purple"><span>cos α</span><strong>{fmt(Math.cos(rad), 3)}</strong></div><div className="mv-result mv-result-yellow"><span>sin α</span><strong>{fmt(Math.sin(rad), 3)}</strong></div><Reset lang={lang} onClick={() => setAngle(45)} /></div>
  </Experiment>;
}

function TriangleVisual({ lang }: Copy) {
  const [horizontal, setHorizontal] = useState(3); const [height, setHeight] = useState(4); const [drag, setDrag] = useState(false);
  const pointX = 140 + horizontal * 35; const pointY = 290 - height * 35;
  const move = (e: ReactPointerEvent<SVGSVGElement>) => { const box = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - box.left) / box.width * 600; const y = (e.clientY - box.top) / box.height * 340; setHorizontal(Math.round(clamp((x - 140) / 35, -1, 9) * 10) / 10); setHeight(Math.round(clamp((290 - y) / 35, 0.5, 6) * 10) / 10); };
  return <Experiment lang={lang} task={choose(lang, "Передвинь вершину C вправо, сохраняя высоту. Меняется ли площадь? Затем сравни площади при высотах 2 и 4: что изменилось?", "Биіктікті сақтап, C төбесін оңға жылжыт. Аудан өзгере ме? Содан кейін биіктік 2 және 4 болғандағы аудандарды салыстыр: не өзгерді?")} fallback={choose(lang, `Площадь треугольника S = a·h/2. Основание a = 8, высота h = ${fmt(height)}. Поэтому S = ${fmt(4 * height)} квадратных единиц. Сдвиг вершины вдоль основания не меняет площадь, если высота остаётся прежней. Высота — перпендикуляр от вершины к прямой основания, даже когда он выходит за треугольник.`, `Үшбұрыштың ауданы S = a·h/2. Табаны a = 8, биіктігі h = ${fmt(height)}. Сондықтан S = ${fmt(4 * height)} шаршы бірлік. Биіктік өзгермесе, төбені табанға параллель жылжыту ауданды өзгертпейді. Биіктік — төбеден табан жатқан түзуге түсірілген перпендикуляр; ол үшбұрыштың сыртында да болуы мүмкін.`)}>
    <div className="mv-canvas"><div className="mv-canvas-label">S = a · h / 2</div><SvgCanvas className="mv-draggable" viewBox="0 0 600 340" role="img" aria-label={choose(lang, `Треугольник с основанием 8 и высотой ${fmt(height)}. Площадь ${fmt(4 * height)}.`, `Табаны 8, биіктігі ${fmt(height)} болатын үшбұрыш. Ауданы ${fmt(4 * height)}.`)} onPointerMove={e => { if (drag) move(e); }} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}>
      {Array.from({ length: 13 }, (_, i) => <line key={`v${i}`} x1={70 + i * 35} x2={70 + i * 35} y1="50" y2="310" stroke="#E7EFEB" />)}
      {Array.from({ length: 8 }, (_, i) => <line key={`h${i}`} x1="70" x2="535" y1={45 + i * 35} y2={45 + i * 35} stroke="#E7EFEB" />)}
      <path d={`M140 290L420 290L${pointX} ${pointY}Z`} fill="#D8EEE2" stroke={green} strokeWidth="3" strokeLinejoin="round" />
      {(horizontal < 0 || horizontal > 8) && <line x1={horizontal < 0 ? pointX : 420} y1="290" x2={horizontal < 0 ? 140 : pointX} y2="290" stroke="#A9BDB4" strokeDasharray="5 5" />}
      <line x1={pointX} y1={pointY} x2={pointX} y2="290" stroke={purple} strokeWidth="2.5" strokeDasharray="6 5" />
      <path d={`M${pointX} 278H${pointX + 12}V290`} fill="none" stroke={purple} strokeWidth="1.5" />
      <circle cx="140" cy="290" r="4" fill={green} /><circle cx="420" cy="290" r="4" fill={green} /><circle cx={pointX} cy={pointY} r="15" fill={green} opacity="0.12" /><circle cx={pointX} cy={pointY} r="8" fill={green} stroke="white" strokeWidth="2" />
      <circle cx={pointX} cy={pointY} r="14" fill="transparent" stroke="transparent" strokeWidth="44" vectorEffect="non-scaling-stroke" pointerEvents="all" onPointerDown={e => { e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId); setDrag(true); }} style={{ cursor: "grab" }} />
      <text x="121" y="309">A</text><text x="433" y="309">B</text><text x={pointX + 15} y={pointY - 12}>C</text><text x="280" y="318" textAnchor="middle">a = 8</text><text x={pointX + 15} y={(pointY + 290) / 2} fill={purple}>h = {fmt(height)}</text>
    </SvgCanvas><div className="mv-legend"><span>{choose(lang, "Перетаскивай зелёную вершину C", "Жасыл C төбесін сүйре")}</span></div></div>
    <div className="mv-controls"><Slider label={choose(lang, "Положение C по горизонтали", "C төбесінің көлденең орны")} value={horizontal} min={-1} max={9} step={0.1} onChange={setHorizontal} /><Slider label={choose(lang, "Высота h", "h биіктігі")} value={height} min={0.5} max={6} step={0.1} onChange={setHeight} /><div className="mv-result"><span>{choose(lang, "Площадь треугольника", "Үшбұрыштың ауданы")}</span><strong>{fmt(4 * height)} {choose(lang, "ед²", "бірлік²")}</strong></div><p className="mv-note">{choose(lang, "Ползунки делают то же, что перетаскивание. Используй стрелки на клавиатуре.", "Сырғытпалар сүйреуді алмастырады. Пернетақтадағы бағыттауыштарды қолдан.")}</p><Reset lang={lang} onClick={() => { setHorizontal(3); setHeight(4); }} /></div>
  </Experiment>;
}

type Vec = [number, number, number];
function SolidVisual({ lang }: Copy) {
  const [yaw, setYaw] = useState(32); const [pitch, setPitch] = useState(-18); const [solid, setSolid] = useState("prism");
  const dragging = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const turn = (p: Vec): Vec => { const a = yaw * Math.PI / 180; const b = pitch * Math.PI / 180; const x = p[0] * Math.cos(a) + p[2] * Math.sin(a); const z = -p[0] * Math.sin(a) + p[2] * Math.cos(a); return [x, p[1] * Math.cos(b) - z * Math.sin(b), p[1] * Math.sin(b) + z * Math.cos(b)]; };
  let faces: { points: Vec[]; color: string }[];
  if (solid === "prism") {
    const points: Vec[] = [[-2,-1.5,-1],[2,-1.5,-1],[2,1.5,-1],[-2,1.5,-1],[-2,-1.5,1],[2,-1.5,1],[2,1.5,1],[-2,1.5,1]];
    faces = [[0,1,2,3],[4,5,6,7],[0,4,7,3],[1,5,6,2],[0,1,5,4],[3,2,6,7]].map((face, i) => ({ points: face.map(n => points[n]), color: ["#D8EEE2", "#B6DCCA", "#C8E6D5", "#91CDB2", "#E5F4EB", "#A6D6C0"][i] }));
  } else {
    const top: Vec[] = Array.from({ length: 48 }, (_, i) => [1.4 * Math.cos(i * Math.PI / 24), -1.5, 1.4 * Math.sin(i * Math.PI / 24)]);
    const bottom: Vec[] = top.map(([x,,z]) => [x,1.5,z]);
    faces = top.map((point, i) => ({ points: [point, top[(i+1)%48], bottom[(i+1)%48], bottom[i]], color: i % 4 === 0 ? "#AED8C3" : "#B6DCCA" }));
    faces.push({ points: top, color: "#E5F4EB" }, { points: bottom, color: "#9BCEB5" });
  }
  const projected = faces.map(face => ({ points: face.points.map(turn), color: face.color })).sort((a,b) => a.points.reduce((n,p) => n+p[2],0)/a.points.length - b.points.reduce((n,p) => n+p[2],0)/b.points.length);
  const volume = solid === "prism" ? "V = 4 · 2 · 3 = 24" : `V = π · 1,4² · 3 ≈ ${fmt(Math.PI * 1.4 * 1.4 * 3)}`;
  return <Experiment lang={lang} task={choose(lang, "Поверни тело, чтобы увидеть верхнюю и боковую грани. Меняется ли объём при повороте? Найди основание и высоту.", "Жоғарғы және бүйір жақтарын көру үшін денені айналдыр. Айналдырғанда көлем өзгере ме? Табаны мен биіктігін тап.")} fallback={choose(lang, solid === "prism" ? "Прямоугольный параллелепипед имеет длину 4, ширину 2 и высоту 3. Объём равен произведению трёх измерений: 24 кубические единицы. Поворот меняет видимые грани, но не размеры или объём. Противоположные грани равны и параллельны." : "У цилиндра два одинаковых круглых основания и изогнутая боковая поверхность. Радиус основания 1,4, высота 3. Объём V = πr²h ≈ 18,47 кубических единиц. Поворот не меняет радиус, высоту или объём.", solid === "prism" ? "Тікбұрышты параллелепипедтің ұзындығы 4, ені 2, биіктігі 3. Көлемі осы үш өлшемнің көбейтіндісіне тең: 24 текше бірлік. Айналдыру көрінетін жақтарды өзгертеді, бірақ өлшемдері мен көлемін өзгертпейді. Қарама-қарсы жақтары тең және параллель." : "Цилиндрдің екі бірдей дөңгелек табаны және қисық бүйір беті бар. Табан радиусы 1,4, биіктігі 3. Көлемі V = πr²h ≈ 18,47 текше бірлік. Айналдыру радиусты, биіктікті немесе көлемді өзгертпейді.")}>
    <div className="mv-canvas"><div className="mv-canvas-label">{choose(lang, solid === "prism" ? "Прямоугольный параллелепипед" : "Цилиндр", solid === "prism" ? "Тікбұрышты параллелепипед" : "Цилиндр")}</div><SvgCanvas className="mv-draggable" viewBox="0 0 600 340" role="img" aria-label={choose(lang, "Вращаемое пространственное тело. ", "Айналатын кеңістіктік дене. ") + volume} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = { x: e.clientX, y: e.clientY, yaw, pitch }; }} onPointerMove={e => { const d = dragging.current; if (d) { setYaw(Math.round(clamp(d.yaw + (e.clientX - d.x) * 0.6, -180, 180))); setPitch(Math.round(clamp(d.pitch - (e.clientY - d.y) * 0.4, -60, 60))); } }} onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
      <ellipse cx="290" cy="295" rx="145" ry="17" fill="#E9F1EC" />
      <path d="M90 288L290 319L496 284M290 319V289" stroke="#CADCD2" fill="none" strokeDasharray="5 5" />
      {projected.map((face, i) => <polygon key={i} points={face.points.map(([x,y]) => `${290 + x * 45},${165 + y * 45}`).join(" ")} fill={face.color} stroke={solid === "prism" ? green : "#75B899"} strokeWidth={solid === "prism" ? 2 : 0.7} strokeLinejoin="round" />)}
    </SvgCanvas><div className="mv-legend"><span>{choose(lang, "Перетаскивай тело для поворота", "Айналдыру үшін денені сүйре")}</span></div></div><div className="mv-controls"><label className="mv-select">{choose(lang, "Тело", "Дене")}<select value={solid} onChange={e => setSolid(e.target.value)}><option value="prism">{choose(lang, "Параллелепипед", "Параллелепипед")}</option><option value="cylinder">{choose(lang, "Цилиндр", "Цилиндр")}</option></select></label><Slider label={choose(lang, "Поворот вокруг оси", "Ось бойымен айналдыру")} value={yaw} min={-180} max={180} onChange={setYaw} unit="°" /><Slider label={choose(lang, "Наклон", "Еңкейту")} value={pitch} min={-60} max={60} onChange={setPitch} unit="°" /><div className="mv-result"><span>{choose(lang, "Объём, ед³", "Көлемі, бірлік³")}</span><strong className="mv-volume">{volume}</strong></div><Reset lang={lang} onClick={() => { setYaw(32); setPitch(-18); setSolid("prism"); }} /></div>
  </Experiment>;
}

function FractionVisual({ lang }: Copy) {
  const [total, setTotal] = useState(20); const [selected, setSelected] = useState(5); const [mode, setMode] = useState("fraction");
  const [rounding, setRounding] = useState<{ before: number; after: number } | null>(null);
  const portion = selected / total;
  const divisor = gcd(selected, total);
  return <Experiment lang={lang} task={choose(lang, "Закрась половину плиток. Какая дробь получилась? Переключись на проценты, затем на вероятность: почему число остаётся тем же?", "Плиткалардың жартысын боя. Қандай бөлшек шықты? Пайызға, кейін ықтималдыққа ауыс: неге сан сол күйінде қалады?")} fallback={choose(lang, `Каждая из ${total} плиток — одна равная часть целого. Выбрано ${selected}: это ${selected}/${total} = ${fmt(portion * 100)}%. Если все плитки равновероятны, шанс случайно выбрать зелёную равен ${selected}/${total}. Плитки в модели условные: случайный выбор должен быть равновероятным.`, `${total} плитканың әрқайсысы — бүтіннің бірдей бөлігі. Таңдалғаны ${selected}: бұл ${selected}/${total} = ${fmt(portion * 100)}%. Барлық плиткаларды таңдау мүмкіндігі бірдей болса, кездейсоқ жасыл плитканы таңдау ықтималдығы ${selected}/${total}-ге тең. Модельде кездейсоқ таңдау тең ықтималды болуы керек.`)}>
    <div className="mv-canvas mv-tiles-canvas"><div className="mv-canvas-label">{choose(lang, mode === "fraction" ? "Часть целого" : mode === "percent" ? "Процент — одна сотая" : "Равновероятный случайный выбор", mode === "fraction" ? "Бүтіннің бөлігі" : mode === "percent" ? "Пайыз — жүзден бір бөлік" : "Тең ықтималды кездейсоқ таңдау")}</div><div className={`mv-tiles${total > 20 ? " mv-small" : ""}`} style={{ gridTemplateColumns: `repeat(${total <= 20 ? 5 : 10}, 1fr)` }} role={total > 20 ? "img" : undefined} aria-label={total > 20 ? choose(lang, `${selected} из ${total} частей выбрано`, `${total} бөліктің ${selected} бөлігі таңдалған`) : undefined}>{Array.from({ length: total }, (_, i) => total > 20 ? <span key={i} aria-hidden="true" className={i < selected ? "mv-tile selected" : "mv-tile"}>{i < selected && <span>✓</span>}</span> : <button type="button" key={i} className={i < selected ? "mv-tile selected" : "mv-tile"} aria-label={choose(lang, `Выбрать ${i+1} из ${total} частей`, `${total} бөліктің ${i+1} бөлігін таңдау`)} aria-pressed={i < selected} onClick={() => { setSelected(i+1 === selected ? Math.max(0,selected-1) : i+1); setRounding(null); }}>{i < selected && <span aria-hidden="true">✓</span>}</button>)}</div><div className="mv-tile-equation">{mode === "fraction" ? <>{selected}/{total} <span>=</span> {selected/divisor}/{total/divisor}</> : mode === "percent" ? <>{fmt(portion*100)}<span>%</span></> : <>P <span>=</span> {selected}/{total} <span>=</span> {fmt(portion, 3)}</>}</div><p className="mv-note">{choose(lang, total > 20 ? "Изменяй количество ползунком" : "Нажми на плитку или используй ползунок", total > 20 ? "Сырғытпамен санын өзгерт" : "Плитканы бас немесе сырғытпаны қолдан")}</p></div><div className="mv-controls"><label className="mv-select">{choose(lang, "Что исследуем", "Нені зерттейміз")}<select value={mode} onChange={e => setMode(e.target.value)}><option value="fraction">{choose(lang, "Дробь", "Бөлшек")}</option><option value="percent">{choose(lang, "Проценты", "Пайыз")}</option><option value="probability">{choose(lang, "Вероятность", "Ықтималдық")}</option></select></label><label className="mv-select">{choose(lang, "Всего равных частей", "Тең бөліктер саны")}<select value={total} onChange={e => { const n = Number(e.target.value); const conversion = convertFractionParts(selected, total, n); setTotal(n); setSelected(conversion.parts); setRounding(conversion.rounded ? { before: conversion.originalPercent, after: conversion.actualPercent } : null); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label><Slider label={choose(lang, "Выбрано частей", "Таңдалған бөліктер")} value={selected} min={0} max={total} onChange={value => { setSelected(value); setRounding(null); }} />{rounding && <p className="mv-rounding" role="status">{choose(lang, `Долю ${fmt(rounding.before)}% нельзя точно показать с ${total} целыми плитками. В этой модели округлили до ближайшего количества: ${fmt(rounding.after)}%.`, `${fmt(rounding.before)}% үлесін ${total} бүтін плиткамен дәл көрсету мүмкін емес. Бұл модельде ең жақын бүтін санға дөңгелектедік: ${fmt(rounding.after)}%.`)}</p>}<div className="mv-result"><span>{choose(lang, "Доля целого", "Бүтіннің үлесі")}</span><strong>{selected}/{total} = {fmt(portion*100)}%</strong></div><Reset lang={lang} onClick={() => { setTotal(20); setSelected(5); setMode("fraction"); setRounding(null); }} /></div>
  </Experiment>;
}

const tabs = [
  { id: "functions", ru: "Функции", kk: "Функциялар", Icon: FunctionSquare },
  { id: "inequalities", ru: "Неравенства", kk: "Теңсіздіктер", Icon: ArrowLeftRight },
  { id: "trig", ru: "Тригонометрия", kk: "Тригонометрия", Icon: Circle },
  { id: "geometry", ru: "Геометрия", kk: "Геометрия", Icon: Triangle },
  { id: "solids", ru: "Пространство", kk: "Кеңістік", Icon: Box },
  { id: "fractions", ru: "Доли и шансы", kk: "Үлес пен мүмкіндік", Icon: Percent },
] as const;

export default function MathVisuals({ lang, initial = "functions" }: Copy & { initial?: string }) {
  const aliases: Record<string, Visual> = { graph: "functions", function: "functions", numberline: "inequalities", circle: "trig", triangle: "geometry", solid: "solids", fraction: "fractions", percent: "fractions", probability: "fractions" };
  const normalized = aliases[initial] ?? initial;
  const [active, setActive] = useState<Visual>(tabs.some(t => t.id === normalized) ? normalized as Visual : "functions");
  const id = useId().replace(/:/g, "");
  const models: Record<Visual, ReactNode> = { functions: <GraphVisual lang={lang} />, inequalities: <NumberLine lang={lang} />, trig: <UnitCircle lang={lang} />, geometry: <TriangleVisual lang={lang} />, solids: <SolidVisual lang={lang} />, fractions: <FractionVisual lang={lang} /> };
  return <div className="mv"><style>{css}</style><div className="mv-tabs" role="tablist" aria-label={choose(lang, "Математические модели", "Математикалық модельдер")}>{tabs.map(({ id: tabId, ru, kk, Icon }, index) => <button type="button" key={tabId} role="tab" id={`${id}-${tabId}`} aria-controls={`${id}-${tabId}-panel`} aria-selected={active === tabId} tabIndex={active === tabId ? 0 : -1} onClick={() => setActive(tabId)} onKeyDown={e => { if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return; e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length-1 : (index+(e.key === "ArrowRight" ? 1 : -1)+tabs.length)%tabs.length; setActive(tabs[next].id); const buttons = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button"); buttons?.[next].focus(); }}><Icon size={17} aria-hidden="true" />{lang === "ru" ? ru : kk}</button>)}</div>
    {tabs.map(({ id: tabId }) => <div key={tabId} id={`${id}-${tabId}-panel`} className="mv-panel" role="tabpanel" aria-labelledby={`${id}-${tabId}`} tabIndex={0} hidden={active !== tabId}>{models[tabId]}</div>)}
  </div>;
}

const css = `
.mv{color:#172D2A;font-family:inherit;max-width:100%;}.mv *{box-sizing:border-box}.mv button,.mv select,.mv input{font:inherit}.mv-tabs{display:flex;gap:5px;overflow:auto;padding:0 0 14px;scrollbar-width:thin}.mv-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;border:1px solid transparent;border-radius:11px;background:transparent;color:#64756F;padding:12px 14px;min-height:44px;cursor:pointer;font-size:13px;font-weight:600}.mv-tabs button[aria-selected=true]{background:#E9F5EF;color:#19775C;border-color:#D3E8DD}.mv-tabs button:hover{color:#19775C;background:#F3F8F5}.mv button:focus-visible,.mv input:focus-visible,.mv select:focus-visible,.mv summary:focus-visible,.mv-panel:focus-visible{outline:3px solid #8772B6;outline-offset:3px}.mv-panel[hidden]{display:none}.mv-panel{background:#fff;border:1px solid #E3EBE6;border-radius:18px;padding:22px}.mv-experiment{display:flex;gap:12px;align-items:flex-start;max-width:790px;margin-bottom:22px}.mv-experiment>svg{color:#19775C;flex-shrink:0;margin-top:2px}.mv-experiment strong{font-size:14px;font-weight:750}.mv-experiment p{font-size:14px;line-height:1.7;color:#64756F;margin:5px 0 0}.mv-workbench{display:grid;grid-template-columns:minmax(0,1fr) 235px;gap:25px;align-items:start}.mv-canvas{background:#F8FBF9;border:1px solid #E4EEE8;border-radius:14px;overflow:hidden;min-width:0}.mv-canvas>svg{display:block;width:100%;height:auto}.mv-canvas text{font-family:inherit;font-size:var(--mv-svg-font-size,14px);fill:#64756F}.mv-canvas-label{font-size:17px;font-weight:700;color:#19775C;padding:20px 20px 0;line-height:1.5;overflow-wrap:anywhere}.mv-legend{display:flex;justify-content:center;flex-wrap:wrap;gap:8px 16px;padding:0 10px 15px;color:#64756F;font-size:11px;line-height:1.5}.mv-legend span{display:inline-flex;gap:6px;align-items:center}.mv-legend i{width:7px;height:7px;border-radius:50%;display:inline-block;background:#19775C}.mv-controls{display:flex;flex-direction:column;gap:18px;padding:8px 0}.mv-control-title{margin:0;font-size:14px;font-weight:700}.mv-slider{display:block}.mv-slider>span{display:flex;justify-content:space-between;gap:10px;font-size:13px;line-height:1.5}.mv-slider output{color:#19775C;font-weight:700}.mv-slider input{appearance:none;display:block;width:100%;height:44px;background:transparent;cursor:pointer;touch-action:pan-y;margin:0}.mv-slider input::-webkit-slider-runnable-track{height:5px;background:#D6E8DE;border-radius:8px}.mv-slider input::-moz-range-track{height:5px;background:#D6E8DE;border-radius:8px}.mv-slider input::-webkit-slider-thumb{appearance:none;width:18px;height:18px;margin-top:-6.5px;border-radius:50%;background:#19775C;border:3px solid white;box-shadow:0 0 0 1px #B0CFBE}.mv-slider input::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#19775C;border:3px solid white;box-shadow:0 0 0 1px #B0CFBE}.mv-result{display:flex;flex-direction:column;gap:8px;padding:16px;background:#E9F5EF;border-radius:12px}.mv-result span{font-size:12px;color:#496B50}.mv-result strong{font-size:22px;line-height:1.35;color:#19775C;overflow-wrap:anywhere}.mv-result-purple{background:#EEEAF8}.mv-result-purple span,.mv-result-purple strong{color:#735C92}.mv-result-yellow{background:#FBF3D9}.mv-result-yellow span,.mv-result-yellow strong{color:#856928}.mv-result strong.mv-volume{font-size:16px}.mv-reset{display:inline-flex;align-items:center;justify-content:center;gap:7px;align-self:start;border:none;min-height:44px;border-radius:8px;background:transparent;padding:7px 8px;color:#64756F;font-size:12px;cursor:pointer}.mv-reset:hover{background:#F3F7F5;color:#19775C}.mv-explanation{border-top:1px solid #E8EEE9;margin-top:22px;padding-top:16px;font-size:13px;color:#64756F;line-height:1.7}.mv-explanation summary{cursor:pointer;color:#4B675B;font-weight:600;min-height:44px;padding:8px 0}.mv-explanation p{max-width:800px;margin:8px 0 0}.mv-select{display:flex;flex-direction:column;gap:8px;font-size:13px;color:#4B675B}.mv-select select{min-height:44px;border:1px solid #DBE7DF;border-radius:10px;background:white;color:#172D2A;padding:9px 10px;max-width:100%;cursor:pointer}.mv-check{display:flex;align-items:center;gap:8px;font-size:12px;color:#64756F;min-height:44px}.mv-check input{width:18px;height:18px;accent-color:#19775C;cursor:pointer}.mv-presets{display:flex;flex-wrap:wrap;gap:5px}.mv-presets button{border:1px solid #DBE7DF;border-radius:8px;background:white;color:#64756F;padding:7px 9px;min-width:44px;min-height:44px;cursor:pointer;font-size:12px}.mv-presets button[aria-pressed=true]{background:#E9F5EF;color:#19775C;border-color:#94C9AE}.mv-draggable{touch-action:none;cursor:grab}.mv-draggable:active{cursor:grabbing}.mv-note{color:#64756F;font-size:12px;line-height:1.65;margin:0}.mv-tiles-canvas{padding-bottom:20px}.mv-tiles{display:grid;gap:7px;max-width:420px;width:calc(100% - 40px);margin:23px auto}.mv-tile{appearance:none;aspect-ratio:1;border:1px solid #D3E3D9;border-radius:7px;background:#EDF4EF;display:flex;align-items:center;justify-content:center;cursor:pointer;color:white;padding:0}.mv-tiles.mv-small{gap:4px}.mv-tiles.mv-small .mv-tile{border-radius:3px;cursor:default}.mv-tiles.mv-small .mv-tile span{font-size:10px}.mv-tile.selected{background:#3B9875;border-color:#29865F}.mv-tile:hover{outline:2px solid #92C3AA;outline-offset:1px}.mv-tile span{font-size:15px}.mv-rounding{grid-column:1/-1;border:1px solid #E8DCB4;background:#FBF3D9;color:#785C20;padding:12px;border-radius:10px;font-size:12px;line-height:1.8;margin:0}.mv-tile-equation{text-align:center;font-size:30px;font-weight:700;color:#19775C;line-height:1.5}.mv-tile-equation span{color:#60756B;font-size:23px;font-weight:500;margin:0 5px}.mv-tiles-canvas>.mv-note{text-align:center;padding:5px 15px}.mascot{overflow:visible;display:block;flex-shrink:0}@media(max-width:850px){.mv-workbench{grid-template-columns:minmax(0,1fr) 200px;gap:18px}.mv-panel{padding:18px}.mv-tabs button{padding:11px;font-size:12px}}@media(max-width:650px){.mv-workbench{grid-template-columns:minmax(0,1fr)}.mv-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:16px}.mv-controls>.mv-control-title{grid-column:1/-1}.mv-controls>.mv-result{align-self:stretch}.mv-controls>.mv-note{grid-column:1/-1}.mv-controls>.mv-presets{grid-column:1/-1}.mv-experiment{margin-bottom:16px}.mv-experiment p{font-size:13px}.mv-panel{padding:16px;border-radius:14px}.mv-canvas-label{font-size:16px;padding:16px 15px 0}.mv-result{padding:12px}.mv-result strong{font-size:19px}.mv-tabs{gap:3px;padding-bottom:10px}.mv-tabs button{font-size:12px;gap:6px}.mv-explanation{margin-top:16px}.mv-tile-equation{font-size:26px}}@media(max-width:360px){.mv-tiles:not(.mv-small){grid-template-columns:repeat(auto-fit,minmax(44px,1fr))!important}.mv-controls{grid-template-columns:minmax(0,1fr)}}@media(forced-colors:active){.mv-tile{border:1px solid CanvasText}.mv-tile.selected{background:Highlight;color:HighlightText}.mv-tabs button[aria-selected=true]{border-color:Highlight}}@media(prefers-reduced-motion:reduce){.mv *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;
