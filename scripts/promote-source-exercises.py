"""Reproducible, fail-closed conversion of self-contained textbook exercises.

Only exact rational arithmetic and univariate rational equations are supported.
External text is parsed by a bounded grammar, NEVER eval/sympify/parse_expr.
Unsupported conditions remain in the editorial queue. No paid API is used.
Run: python scripts/promote-source-exercises.py
Dependency: sympy==1.14.0 (project-local .sites-runtime/math-tools supported).
"""
from __future__ import annotations
import collections, hashlib, json, pathlib, re, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.sites-runtime/math-tools'))
import sympy as s
X=s.Symbol('x',real=True)

class Unsupported(ValueError): pass

class Formula:
    def __init__(self, tex):
        if len(tex)>400: raise Unsupported('formula-too-long')
        tex=tex.replace('−','-').replace('–','-').replace('×','*').replace('·','*').replace('÷','/')
        for command in ('left','right','displaystyle',',',';','!','quad','qquad'):
            tex=tex.replace('\\'+command,' ')
        tex=re.sub(r'\\(?:dfrac|tfrac)',r'\\frac',tex)
        tex=re.sub(r'\\(?:cdot|times)', '*',tex);tex=tex.replace('\\div','/')
        self.tokens=re.findall(r'\\[a-zA-Z]+|\d+(?:\.\d+)?|[a-zA-Z]|[^\s]',tex)
        if len(self.tokens)>120: raise Unsupported('too-many-tokens')
        self.pos=0;self.variables=set();self.denominators=[];self.trace=[];self.operations=0;self.operation_kinds=set()
        self.value,self.ascii=self.expression()
        if self.pos!=len(self.tokens): raise Unsupported('unsupported-token:'+self.tokens[self.pos])
        if len(self.variables)>1: raise Unsupported('multiple-variables')
        if self.value.has(s.zoo,s.oo,-s.oo,s.nan): raise Unsupported('undefined-expression')
    def peek(self):return self.tokens[self.pos] if self.pos<len(self.tokens) else ''
    def take(self):
        t=self.peek()
        if not t:raise Unsupported('missing-operand')
        self.pos+=1;return t
    def expression(self):
        v,a=self.product()
        while self.peek() in ('+','-'):
            op=self.take();w,b=self.product();v,a=self.combine(v,a,op,w,b)
        return v,a
    def product(self):
        v,a=self.unary()
        while True:
            t=self.peek()
            implicit=bool(t and (t in ('(','{','[','\\frac','\\sqrt') or re.fullmatch('[a-zA-Z]',t)))
            if t in ('*','/'):
                op=self.take();w,b=self.unary()
            elif implicit:
                op='*';w,b=self.unary()
            else:break
            v,a=self.combine(v,a,op,w,b)
        return v,a
    def unary(self):
        if self.peek() in ('+','-'):
            sign=self.take();v,a=self.unary();return (v,a) if sign=='+' else (-v,'(-'+a+')')
        v,a=self.atom()
        if self.peek()=='^':
            self.take();w,b=self.unary()
            if not w.is_Integer or abs(w)>12:raise Unsupported('unsupported-exponent')
            v,a=self.combine(v,a,'^',w,b)
        return v,a
    def atom(self):
        t=self.take()
        if re.fullmatch(r'\d+(?:\.\d+)?',t):
            if len(t)>14:raise Unsupported('number-too-large')
            return s.Rational(t),t
        if re.fullmatch('[a-zA-Z]',t):
            if t in 'eij':raise Unsupported('ambiguous-constant')
            self.variables.add(t);return X,'x'
        if t in ('(','{','['):
            closing={'(':')','{':'}','[':']'}[t];v,a=self.expression()
            if self.take()!=closing:raise Unsupported('unbalanced-group')
            return v,a
        if t=='\\frac':
            if self.peek()!='{':raise Unsupported('fraction-group-required')
            v,a=self.atom()
            if self.peek()!='{':raise Unsupported('fraction-group-required')
            w,b=self.atom();return self.combine(v,a,'/',w,b,structural=True)
        if t=='\\sqrt':
            if self.peek()!='{':raise Unsupported('root-group-required')
            v,a=self.atom();result=s.sqrt(v)
            if not result.is_Rational:raise Unsupported('non-rational-root')
            self.trace.append(('sqrt('+a+')',str(result)));return result,'sqrt('+a+')'
        if t=='|':
            v,a=self.expression()
            if self.take()!='|' or not v.is_Rational:raise Unsupported('unsupported-absolute-value')
            result=abs(v);self.trace.append(('abs('+a+')',str(result)))
            return result,'abs('+a+')'
        raise Unsupported('unsupported-token:'+t)
    def combine(self,v,a,op,w,b,structural=False):
        self.operations+=1
        if not structural:self.operation_kinds.add(op)
        if self.operations>45:raise Unsupported('too-many-operations')
        if op=='/':
            if w==0:raise Unsupported('division-by-zero')
            self.denominators.append(w);result=v/w
        elif op=='^':
            if w<0:self.denominators.append(v)
            result=v**w
        elif op=='+':result=v+w
        elif op=='-':result=v-w
        else:result=v*w
        a='('+a+op+b+')'
        if result.is_Rational:
            if abs(result.p)>10**14 or result.q>10**14:raise Unsupported('result-too-large')
            display='('+str(v)+')'+op+'('+str(w)+')'
            self.trace.append((display,str(result)))
        return result,a

def b(ru,kk):return {'ru':ru,'kk':kk}
RULES={
 'numbers':b('Сначала скобки и степени, затем умножение и деление, затем сложение и вычитание. Равноприоритетные действия выполняй слева направо.','Алдымен жақшалар мен дәрежелер, кейін көбейту мен бөлу, соңында қосу мен азайту. Бірдей дәрежелі амалдарды солдан оңға орында.'),
 'negatives':b('При вычитании отрицательного числа прибавляем противоположное. В произведении чётное число отрицательных множителей даёт плюс.','Теріс санды азайтқанда оның қарама-қарсы санын қосамыз. Көбейтіндіде теріс көбейткіштердің саны жұп болса, таңба оң болады.'),
 'fractions':b('Для сложения и вычитания приведи дроби к общему знаменателю. При делении умножь на обратную дробь. Сократи результат.','Қосу мен азайту үшін бөлшектерді ортақ бөлімге келтір. Бөлгенде кері бөлшекке көбейт. Нәтижені қысқарт.'),
 'school-decimals':b('Сохраняй разрядность десятичных дробей. Для точного вычисления можно записать их обыкновенными дробями.','Ондық бөлшектердің разрядтарын сақта. Дәл есептеу үшін оларды жай бөлшек түрінде жазуға болады.'),
 'powers':b('При умножении степеней одного основания показатели складываются, при делении вычитаются. Отрицательная степень означает обратное число.','Негіздері бірдей дәрежелерді көбейткенде көрсеткіштер қосылады, бөлгенде азайтылады. Теріс дәреже кері санды білдіреді.'),
 'radicals':b('Арифметический квадратный корень неотрицателен. Проверь его возведением в квадрат, затем выполни остальные действия.','Арифметикалық квадрат түбір теріс емес. Оны квадраттау арқылы тексеріп, кейін қалған амалдарды орында.'),
 'linear':b('Раскрой скобки. Собери члены с x в одной части, числа — в другой. Делить обе части можно только на ненулевое число.','Жақшаларды аш. x бар мүшелерді бір жаққа, сандарды екінші жаққа жина. Екі жақты тек нөлден өзге санға бөлуге болады.'),
 'quadratic':b('Приведи уравнение к ax²+bx+c=0. Вычисли D=b²−4ac. Если D≥0, x=(−b±√D)/(2a).','Теңдеуді ax²+bx+c=0 түріне келтір. D=b²−4ac мәнін есепте. D≥0 болса, x=(−b±√D)/(2a).'),
 'rational':b('Сначала исключи нули исходных знаменателей. Умножь уравнение на общий знаменатель и реши уравнение числителя. Проверь допустимость каждого корня.','Алдымен бастапқы бөлімдердің нөлдерін алып таста. Теңдеуді ортақ бөлімге көбейтіп, алым теңдеуін шеш. Әр түбірдің жарамдылығын тексер.'),
 'linear-inequalities':b('Приведи неравенство к выражению с нулём справа. Найди границу и проверь знак с обеих сторон. При делении на отрицательное число знак неравенства меняется.','Теңсіздіктің оң жағын нөлге келтір. Шекараны тауып, екі жағындағы таңбаны тексер. Теріс санға бөлгенде теңсіздік белгісі өзгереді.'),
 'quadratic-inequalities':b('Найди корни квадратного трёхчлена. Они делят прямую на интервалы. На каждом выбери число и проверь знак. При нестрогом неравенстве включи допустимые корни.','Квадрат үшмүшенің түбірлерін тап. Олар сан түзуін аралықтарға бөледі. Әр аралықтан сан таңдап, таңбасын тексер. Қатаң емес теңсіздікте жарамды түбірлерді қос.'),
 'rational-inequalities':b('Найди нули числителя и знаменателя. Проверь знак дроби на каждом промежутке. Нули знаменателя исключаются при любом знаке неравенства.','Алым мен бөлімнің нөлдерін тап. Әр аралықта бөлшектің таңбасын тексер. Теңсіздік белгісіне қарамастан бөлімнің нөлдері алынып тасталады.'),
 'school-absolute-value':b('Модуль числа — расстояние до нуля. Поэтому |a| неотрицателен. Сначала вычисли выражение внутри модуля, затем выполни внешние действия.','Санның модулі — нөлге дейінгі қашықтық. Сондықтан |a| теріс емес. Алдымен модуль ішіндегі өрнекті есептеп, кейін сыртқы амалдарды орында.'),
 'school-gcd-lcm':b('Разложи числа на простые множители. Для НОД возьми общие множители с наименьшими степенями, для НОК — все множители с наибольшими степенями.','Сандарды жай көбейткіштерге жікте. ЕҮОБ үшін ортақ көбейткіштердің ең кіші дәрежелерін, ЕКОЕ үшін барлық көбейткіштердің ең үлкен дәрежелерін ал.'),
}
TITLES={
 'numbers':b('Порядок действий','Амалдардың орындалу реті'), 'negatives':b('Действия с отрицательными числами','Теріс сандармен амалдар'),
 'fractions':b('Действия с дробями','Бөлшектермен амалдар'),'school-decimals':b('Десятичные дроби','Ондық бөлшектер'),
 'powers':b('Числовые степени','Санның дәрежелері'),'radicals':b('Вычисление корней','Түбірлерді есептеу'),
 'linear':b('Линейные уравнения','Сызықтық теңдеулер'),'quadratic':b('Квадратные уравнения','Квадрат теңдеулер'),
 'rational':b('Рациональные уравнения и ОДЗ','Рационал теңдеулер және ММЖ'),
 'linear-inequalities':b('Линейные неравенства','Сызықтық теңсіздіктер'),'quadratic-inequalities':b('Квадратные неравенства','Квадрат теңсіздіктер'),
 'rational-inequalities':b('Рациональные неравенства','Рационал теңсіздіктер'),'school-absolute-value':b('Вычисления с модулем','Модульді есептеу'),
 'school-gcd-lcm':b('НОД и НОК','ЕҮОБ және ЕКОЕ'),
}
def fmt(expr):return str(expr).replace('**','^')
def instruction(e):return e['context'].split('\n\n')[-1].lower()
def skill_title(topic,proof):
    details={
        'sum-difference':b('сложение и вычитание','қосу және азайту'),
        'product':b('умножение','көбейту'),'quotient':b('деление','бөлу'),
        'mixed-operations':b('несколько действий','бірнеше амал'),
        'linear-fraction-coefficients':b('дробные коэффициенты','бөлшек коэффициенттер'),
        'linear-integer-coefficients':b('целые коэффициенты','бүтін коэффициенттер'),
    }
    if 'lcm' in proof:return b('Наименьшее общее кратное (НОК)','Ең кіші ортақ еселік (ЕКОЕ)')
    if 'gcd' in proof:return b('Наибольший общий делитель (НОД)','Ең үлкен ортақ бөлгіш (ЕҮОБ)')
    detail=details.get(proof.get('method'))
    return {lang:TITLES[topic][lang]+(': '+detail[lang] if detail else '') for lang in ('ru','kk')}
def number_theory(prompt,context):
    lcm='least common multiple' in context;gcd='greatest common factor' in context or 'greatest common divisor' in context
    if not lcm and not gcd:raise Unsupported('instruction-not-number-theory')
    # Strip only delimiters; never strip prose that might change the question.
    body=re.sub(r'^\s*\d+[.)]\s*','',prompt).replace('\\(','').replace('\\)','').strip().rstrip('.')
    if not re.fullmatch(r'\d{1,4}\s*(?:,\s*(?:and\s+)?|and\s+)\d{1,4}',body):raise Unsupported('number-theory-input')
    a,c=map(int,re.findall(r'\d+',body))
    if not a or not c:raise Unsupported('positive-integers-required')
    result=s.ilcm(a,c) if lcm else s.igcd(a,c)
    label='НОК' if lcm else 'НОД';labelkk='ЕКОЕ' if lcm else 'ЕҮОБ'
    def factors(n):return ' · '.join(str(p)+(f'^{power}' if power>1 else '') for p,power in s.factorint(n).items()) or '1'
    steps=[RULES['school-gcd-lcm'],b(f'{a} = {factors(a)}; {c} = {factors(c)}.',f'{a} = {factors(a)}; {c} = {factors(c)}.'),b(f'{label}({a}; {c}) = {result}.',f'{labelkk}({a}; {c}) = {result}.')]
    return 'school-gcd-lcm',b(f'Найди {label} чисел {a} и {c}.',f'{a} және {c} сандарының {labelkk} мәнін тап.'),str(result),steps,{'lcm' if lcm else 'gcd':[a,c]},set(),1
def interval_answer(result):
    if result is s.S.EmptySet:return '∅'
    if result is s.S.Reals:return '(-inf;+inf)'
    if isinstance(result,s.Union):return 'U'.join(interval_answer(arg) for arg in result.args)
    if isinstance(result,s.FiniteSet):
        if any(not v.is_Rational for v in result):raise Unsupported('non-rational-endpoint')
        return '{'+';'.join(map(str,sorted(result,key=float)))+'}'
    if isinstance(result,s.Interval):
        def end(v):
            if v is s.S.NegativeInfinity:return '-inf'
            if v is s.S.Infinity:return '+inf'
            if not v.is_Rational:raise Unsupported('non-rational-endpoint')
            return str(v)
        return ('(' if result.left_open else '[')+end(result.start)+';'+end(result.end)+(')' if result.right_open else ']')
    raise Unsupported('unsupported-solution-set')

def inequality(tex,context):
    if not re.search(r'solve.*inequal',context):raise Unsupported('instruction-not-inequality')
    tex=re.sub(r'\\(?:geq|ge)(?![a-zA-Z])','>=',tex);tex=re.sub(r'\\(?:leq|le)(?![a-zA-Z])','<=',tex)
    tex=tex.replace('≥','>=').replace('≤','<=')
    match=re.fullmatch(r'([^<>=]+)(>=|<=|>|<)([^<>=]+)',tex)
    if not match:raise Unsupported('compound-inequality')
    left,relation,right=match.groups();lhs,rhs=Formula(left),Formula(right)
    if len(lhs.variables|rhs.variables)!=1:raise Unsupported('not-one-unknown')
    expr=s.cancel(lhs.value-rhs.value);num,den=s.fraction(expr)
    if s.Poly(num,X).degree()>2 or s.Poly(den,X).degree()>2:raise Unsupported('inequality-degree')
    denominators=lhs.denominators+rhs.denominators
    boundaries=set(s.solve(num,X));excluded=set()
    for d in denominators:
        if d.has(X):excluded.update(s.solve(d,X))
    boundaries.update(excluded)
    boundaries={v for v in boundaries if v.is_real is not False}
    if any(not v.is_Rational for v in boundaries):raise Unsupported('non-rational-endpoint')
    op={'>':s.Gt,'<':s.Lt,'>=':s.Ge,'<=':s.Le}[relation]
    result=s.solve_univariate_inequality(op(expr,0),X,relational=False)-s.FiniteSet(*excluded)
    answer=interval_answer(result)
    topic='rational-inequalities' if any(d.has(X) for d in denominators) else 'quadratic-inequalities' if s.Poly(num,X).degree()==2 else 'linear-inequalities'
    prompt=b(f'Реши {lhs.ascii} {relation} {rhs.ascii}. Введи промежутки, объединение — U; нет решений — ∅.',f'{lhs.ascii} {relation} {rhs.ascii} теңсіздігін шеш. Аралықтарды енгіз, бірігу — U; шешімі жоқ болса — ∅.')
    steps=[RULES[topic],b('Переносим всё влево: '+fmt(expr)+' '+relation+' 0.','Барлығын сол жаққа ауыстырамыз: '+fmt(expr)+' '+relation+' 0.')]
    if excluded:steps.append(b('Исключаем нули знаменателя: '+', '.join(map(str,sorted(excluded,key=float)))+'.','Бөлімнің нөлдерін алып тастаймыз: '+', '.join(map(str,sorted(excluded,key=float)))+'.'))
    if boundaries:steps.append(b('Границы промежутков: '+', '.join(map(str,sorted(boundaries,key=float)))+'.','Аралықтардың шекаралары: '+', '.join(map(str,sorted(boundaries,key=float)))+'.'))
    points=[-s.oo,*sorted(boundaries,key=float),s.oo];probes=[]
    for a,c in zip(points,points[1:]):
        x=c-1 if a==-s.oo and c!=s.oo else a+1 if c==s.oo and a!=-s.oo else s.Rational(0) if a==-s.oo else (a+c)/2
        value=expr.subs(X,x);probes.append(str(x))
        steps.append(b(f'Проба x={x}: выражение равно {value}; '+('неравенство верно.' if bool(op(value,0)) else 'неравенство неверно.'),f'x={x} сынағы: өрнек {value} мәніне тең; '+('теңсіздік дұрыс.' if bool(op(value,0)) else 'теңсіздік орындалмайды.')))
    steps.append(b('При строгом знаке нули числителя не включаем; при нестрогом — включаем, если знаменатель не равен нулю.','Қатаң белгіде алымның нөлдерін қоспаймыз; қатаң емес белгіде бөлім нөл болмаса, қосамыз.'))
    proof={'inequality':{'expression':'('+lhs.ascii+'-'+rhs.ascii+')','relation':relation},'boundaries':list(map(str,sorted(boundaries,key=float))),'probes':probes}
    return topic,prompt,answer,steps,proof,lhs.variables|rhs.variables,min(3,1+int(topic!='linear-inequalities')+int(topic=='rational-inequalities'))
def equation(tex,context):
    if not re.search(r'\bsolve\b',context) or re.search(r'graph|substitution|square root property|completing|quadratic formula',context):
        raise Unsupported('instruction-needs-specific-method')
    if tex.count('=')!=1:raise Unsupported('unsupported-equation')
    lhs,rhs=(Formula(t) for t in tex.split('='))
    if len(lhs.variables|rhs.variables)!=1:raise Unsupported('not-one-unknown')
    num,den=s.fraction(s.cancel(lhs.value-rhs.value));poly=s.Poly(num,X)
    degree=poly.degree()
    if degree not in (1,2):raise Unsupported('equation-degree-or-identity')
    if any(not c.is_Rational for c in poly.all_coeffs()):raise Unsupported('non-rational-coefficients')
    original_den=lhs.denominators+rhs.denominators
    variable_den=[d for d in original_den if d.has(X)]
    if any(s.Poly(d,X).degree()>2 for d in variable_den):raise Unsupported('domain-too-complex')
    candidates=s.solve(poly.as_expr(),X)
    if any(not r.is_Rational and r.is_real is not False for r in candidates):raise Unsupported('irrational-answer-format')
    roots=sorted([r for r in candidates if r.is_Rational and all(d.subs(X,r)!=0 for d in original_den)],key=float)
    if any(s.cancel((lhs.value-rhs.value).subs(X,r))!=0 for r in roots):raise Unsupported('substitution-failed')
    topic='rational' if variable_den else 'linear' if degree==1 else 'quadratic'
    answer='{'+ ';'.join(map(str,roots))+'}' if roots else '∅'
    prompt=b(f'Реши уравнение {lhs.ascii} = {rhs.ascii}. Введи все корни в виде {{a;b}}; если корней нет — ∅.',f'{lhs.ascii} = {rhs.ascii} теңдеуін шеш. Барлық түбірді {{a;b}} түрінде енгіз; түбір жоқ болса — ∅.')
    steps=[RULES[topic]]
    if variable_den:
        domain='; '.join(fmt(d)+' ≠ 0' for d in variable_den)
        steps.append(b('ОДЗ: '+domain,'ММЖ: '+domain))
    steps.append(b('После переноса и приведения подобных: '+fmt(num)+' = 0.','Мүшелерді ауыстырып, ұқсас мүшелерді біріктіргенде: '+fmt(num)+' = 0.'))
    if degree==1:
        a,c=poly.all_coeffs();steps.append(b(f'{a}·x = {fmt(-c)}; x = ({fmt(-c)})/({a}) = {fmt(-c/a)}.',f'{a}·x = {fmt(-c)}; x = ({fmt(-c)})/({a}) = {fmt(-c/a)}.'))
    else:
        a,bc,c=poly.all_coeffs();D=bc**2-4*a*c
        steps.append(b(f'a={a}, b={bc}, c={c}; D=({bc})²−4·({a})·({c})={D}.',f'a={a}, b={bc}, c={c}; D=({bc})²−4·({a})·({c})={D}.'))
        if D>=0:steps.append(b(f'x = (−({bc})±√({D}))/(2·({a})).',f'x = (−({bc})±√({D}))/(2·({a})).'))
        else:steps.append(b('D<0, действительных корней нет.','D<0, нақты түбір жоқ.'))
    for r in roots:
        value=fmt(lhs.value.subs(X,r));steps.append(b(f'Проверка x={r}: левая часть = правая часть = {value}.',f'x={r} тексеру: сол жақ = оң жақ = {value}.'))
    rejected=[r for r in candidates if r.is_Rational and r not in roots]
    if rejected:steps.append(b('Исключаем недопустимые значения: '+', '.join(map(str,rejected))+'.','Жарамсыз мәндерді алып тастаймыз: '+', '.join(map(str,rejected))+'.'))
    method='rational-degree-'+str(degree) if variable_den else 'quadratic' if degree==2 else 'linear-fraction-coefficients' if any(c.q!=1 for c in poly.all_coeffs()) else 'linear-integer-coefficients'
    return topic,prompt,answer,steps,{'equation':[lhs.ascii,rhs.ascii],'roots':list(map(str,roots)),'denominators':list(map(fmt,original_den)),'method':method},lhs.variables|rhs.variables, min(3,1+int(degree==2)+int(bool(variable_den)))

def numeric(tex,context,page):
    if not re.search(r'\b(simplify|evaluate|add|subtract|multiply|divide|perform|find the value)\b',context):raise Unsupported('instruction-not-numeric-evaluation')
    if re.search(r'round|estimate|convert|scientific notation|exponential|prime factor|identify|classify|rewrite|variable|for\s+[a-z]\s*=',context):raise Unsupported('instruction-has-extra-requirements')
    f=Formula(tex)
    if f.variables:raise Unsupported('symbolic-expression')
    if not f.operations and not f.trace:raise Unsupported('no-operation-to-practice')
    if not f.value.is_Rational:raise Unsupported('non-rational-answer')
    # Topic selection is mathematical, not a chapter-level guessed tag.
    slug=page['url'].lower()
    topic='school-absolute-value' if '|' in tex else 'radicals' if '\\sqrt' in tex else 'powers' if '^' in tex and re.search('exponent|power',slug) else 'school-decimals' if re.search(r'\d\.\d',tex) else 'fractions' if '\\frac' in tex or '\\dfrac' in tex else 'negatives' if '-' in tex.replace('−','-') else 'numbers'
    if '^' in tex and topic=='numbers':topic='numbers' # mixed order of operations stays here
    prompt=b('Вычисли '+f.ascii+'. Запиши точный ответ; дробь можно ввести через /.',f.ascii+' мәнін есепте. Дәл жауапты жаз; бөлшекті / арқылы енгізуге болады.')
    steps=[RULES[topic]]
    for expr,result in f.trace:steps.append(b(expr+' = '+result,expr+' = '+result))
    if not f.trace:steps.append(b('Число уже записано в точном виде: '+str(f.value)+'.','Сан дәл түрде берілген: '+str(f.value)+'.'))
    ops=f.operation_kinds
    method='sum-difference' if ops and ops<={'+','-'} else 'product' if ops=={'*'} else 'quotient' if ops=={'/'} else 'power' if ops=={'^'} else 'mixed-operations' if ops else 'single-value'
    return topic,prompt,str(f.value),steps,{'expression':f.ascii,'method':method},set(),min(3,1+int(f.operations>3)+int(f.operations>7))

def main():
    tasks=[];proofs=[];pending=[];seen={};source_keys=set()
    # Previously published hand-reviewed adaptations retain their identifiers.
    legacy=ROOT/'.sites-runtime/source-review/legacy-source-keys.json'
    if legacy.exists():source_keys=set(json.loads(legacy.read_text(encoding='utf8')))
    index=json.loads((ROOT/'content/source-library/index.json').read_text(encoding='utf8'))
    for row in sorted(index['pages'],key=lambda r:r['id']):
        if row['status']!='draft':continue
        p=json.loads((ROOT/'content/source-library'/f"{row['id']}.json").read_text(encoding='utf8'))
        for e in p['exercises']:
            identity={'pageId':p['id'],'ordinal':e['ordinal'],'sourceNumber':e['sourceNumber']}
            try:
                if p['license']!='CC BY 4.0':raise Unsupported('license')
                if e['hasFigure']:raise Unsupported('requires-figure')
                context=instruction(e)
                if e['kind']!='exercise-candidate' and not re.search(r'following exercises',context):raise Unsupported('example-not-practice')
                if re.search('least common multiple|greatest common factor|greatest common divisor',context):result=number_theory(e['prompt'],context)
                else:
                    match=re.fullmatch(r'\s*\d+[.)]\s*\\\((.+)\\\)\s*\.?',e['prompt'],re.S)
                    if not match:raise Unsupported('prose-multipart-or-shared-context')
                    tex=match[1].strip()
                    if re.search(r'[<>≥≤]|\\(?:geq?|leq?)(?![a-zA-Z])',tex):result=inequality(tex,context)
                    elif '=' in tex:result=equation(tex,context)
                    else:result=numeric(tex,context,p)
                topic,prompt,answer,steps,proof,variables,difficulty=result
                if len(proof.get('expression',''))>250 or any(len(t)>250 for t in proof.get('equation',[])):raise Unsupported('answer-checker-expression-limit')
                source_key=p['sha256']+':'+e['sourceNumber']
                if source_key in source_keys:raise Unsupported('already-in-hand-adapted-bank')
                fingerprint=json.dumps([topic,prompt,answer],sort_keys=True,ensure_ascii=False)
                if fingerprint in seen:raise Unsupported('duplicate-of:'+seen[fingerprint])
                condition_key=re.sub(r'\s+',' ',e['prompt']).strip()
                suffix=hashlib.sha256(condition_key.encode()).hexdigest()[:12]
                id=f"source-auto-{p['id']}-{suffix}";seen[fingerprint]=id
                sub=topic+':source-exact-'+('equation' if 'equation' in proof else 'intervals' if 'inequality' in proof else 'lcm' if 'lcm' in proof else 'gcd' if 'gcd' in proof else 'arithmetic')
                if proof.get('method'):sub=topic+':source-exact-'+proof['method']
                steps.append(b('Ответ: '+answer,'Жауабы: '+answer))
                adaptation=b('Инструкция, подсказки и решение переведены ENT Math. Ответ проверен точными вычислениями; независимая проверка перевода ожидается.','Нұсқаулық, кеңестер және шешім ENT Math арқылы аударылды. Жауап дәл есептеумен тексерілді; аударманың тәуелсіз тексеруі күтіледі.')
                if variables and variables!={'x'}:
                    note=', '.join(sorted(variables))+' → x.'
                    adaptation['ru']+=' Обозначение неизвестного заменено: '+note
                    adaptation['kk']+=' Белгісіздің белгіленуі ауыстырылды: '+note
                hint2=steps[1] if len(steps)>2 else RULES[topic]
                task={'id':id,'topicId':topic,'prompt':prompt,'answer':answer,'type':'expression' if 'equation' in proof or 'inequality' in proof else 'number','difficulty':difficulty,
                    'hints':{lang:[RULES[topic][lang],hint2[lang]] for lang in ('ru','kk')},'solution':{lang:[st[lang] for st in steps] for lang in ('ru','kk')},
                    'errors':{'ru':['Проверь знаки, порядок действий и допустимость деления. Причину твоей ошибки можно установить по шагам решения.'],'kk':['Таңбаларды, амалдардың ретін және бөлудің жарамдылығын тексер. Қатенің себебін шешу қадамдары арқылы анықтауға болады.']},
                    'skill':skill_title(topic,proof),'subtopic':{'id':sub,'title':skill_title(topic,proof)},'skillIds':[sub],'methodFamily':sub,
                    'purpose':'practice','reviewStatus':'math-checked-translation-pending','version':'source-exact-2026-10-07-v1',
                    'source':{k:p[k] for k in ('url','sha256','checkedAt','license','licenseUrl','book','authors')}}
                task['source'].update(exercise=e['sourceNumber'],adaptation=adaptation,archivePageId=p['id'],archiveOrdinal=e['ordinal'])
                if 'equation' in proof:task['answerFormat']='root-set'
                elif 'inequality' in proof:task['answerFormat']='interval'
                else:task['answerFormat']='exact-number'
                tasks.append(task);proofs.append({'id':id,**identity,**proof,'answer':answer,'sourceAnswers':e['sourceAnswers']})
            except (Unsupported,s.PolynomialError,NotImplementedError,ValueError,ZeroDivisionError) as error:
                pending.append({**identity,'reason':str(error)[:120]})
    out=ROOT/'content/promoted';out.mkdir(exist_ok=True)
    for name,data in [('verification',proofs),('pending',pending),('tasks',tasks)]:
        temporary=out/(name+'.tmp')
        temporary.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        temporary.replace(out/(name+'.json'))
    report={'generatedAt':'2026-10-07','ready':len(tasks),'topics':dict(collections.Counter(t['topicId'] for t in tasks)),
        'pending':len(pending),'reasons':dict(collections.Counter(x['reason'].split(':')[0] for x in pending)),
        'translationReview':'pending','complete':False}
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report,ensure_ascii=True))

if __name__=='__main__':main()
