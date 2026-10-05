'use client';

type Language = 'ru' | 'kk';
type Material = Record<string, unknown>;

export type ContentFieldsProps = {
  json: string;
  onChange: (json: string) => void;
  lang: Language;
};

const isObject = (value: unknown): value is Material =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const languageName = { ru: 'Русский', kk: 'Қазақша' };

/** Edits only the named field; publication and mathematical review stay in the parent. */
export default function ContentFields({ json, onChange, lang }: ContentFieldsProps) {
  const tr = (ru: string, kk: string) => lang === 'ru' ? ru : kk;
  let material: Material;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isObject(parsed)) throw new Error('Expected a material');
    material = parsed;
  } catch {
    return <p className="muted" role="status">{tr(
      'Загрузите урок или задачу, чтобы открыть поля редактирования. Если вы изменяли расширенные данные, исправьте их формат.',
      'Өңдеу өрістерін ашу үшін сабақты не есепті жүктеңіз. Кеңейтілген деректерді өзгерткен болсаңыз, пішімін түзетіңіз.',
    )}</p>;
  }

  const lesson = isObject(material.lesson) ? material.lesson : null;
  const isTask = isObject(material.prompt) && !lesson;
  if (!lesson && !isTask) return <p className="muted">{tr(
    'Для этого материала пока нет отдельной формы. Загрузите урок или задачу; экзаменационные правила доступны в расширенных данных.',
    'Бұл материал үшін жеке форма әзірге жоқ. Сабақты не есепті жүктеңіз; емтихан ережелері кеңейтілген деректерде қолжетімді.',
  )}</p>;

  const valueAt = (path: string[]): unknown => {
    let current: unknown = material;
    for (const key of path) current = isObject(current) ? current[key] : undefined;
    return current;
  };
  const changeAt = (path: string[], value: unknown) => {
    const update = (current: Material, keys: string[]): Material => {
      const [key, ...rest] = keys;
      if (!rest.length) return { ...current, [key]: value };
      const child = isObject(current[key]) ? current[key] : {};
      return { ...current, [key]: update(child, rest) };
    };
    onChange(JSON.stringify(update(material, path), null, 2));
  };
  const textField = (path: string[], label: string, language: Language, rows = 3, hint?: string) => {
    const value = valueAt(path);
    return <label className="field" key={path.join('.')}>
      <span>{label}</span>
      {rows === 1
        ? <input lang={language} value={typeof value === 'string' ? value : ''}
          onChange={event => changeAt(path, event.target.value)} />
        : <textarea lang={language} rows={rows} value={typeof value === 'string' ? value : ''}
          onChange={event => changeAt(path, event.target.value)} />}
      {hint && <small className="muted">{hint}</small>}
    </label>;
  };
  const stepsField = (name: 'solution' | 'hints', language: Language, label: string) => {
    const path = [name, language];
    const value = valueAt(path);
    return <label className="field" key={path.join('.')}>
      <span>{label}</span>
      <textarea lang={language} rows={5}
        value={Array.isArray(value) ? value.map(String).join('\n') : typeof value === 'string' ? value : ''}
        onChange={event => changeAt(path, event.target.value === '' ? [] : event.target.value.split('\n'))} />
      <small className="muted">{tr(
        name === 'solution' ? 'Каждый шаг решения пишите с новой строки.' : 'Каждую подсказку пишите с новой строки: от небольшого намёка к следующему шагу.',
        name === 'solution' ? 'Әр шешу қадамын жаңа жолға жазыңыз.' : 'Әр көмек сөзді жаңа жолға жазыңыз: шағын ишарадан келесі қадамға дейін.',
      )}</small>
    </label>;
  };

  return <div className="content-fields">
    <p className="muted">{tr(
      'Редактируйте текст обычными полями. Русская и казахская версии сохраняются вместе с остальными данными материала.',
      'Мәтінді қарапайым өрістерде өңдеңіз. Орысша және қазақша нұсқалар материалдың қалған деректерімен бірге сақталады.',
    )}</p>
    {(['ru', 'kk'] as const).map(language => <section key={language} lang={language}>
      <h3>{languageName[language]}</h3>
      {lesson ? <>
        {textField(['title', language], tr('Название урока', 'Сабақ атауы'), language, 1)}
        {textField(['lesson', 'goal', language], tr('Чему научится ученик', 'Оқушы не үйренеді'), language)}
        {textField(['lesson', 'explanation', language], tr('Объяснение темы', 'Тақырыптың түсіндірмесі'), language, 6)}
        {textField(['lesson', 'simpler', language], tr('Более простое объяснение', 'Қарапайым түсіндірме'), language, 4)}
        {textField(['lesson', 'formula', language], tr('Формулы и условия применения', 'Формулалар және қолдану шарттары'), language, 3,
          tr('Можно вводить обычные математические знаки: √, π, ≤, x².', 'Кәдімгі математикалық таңбаларды енгізуге болады: √, π, ≤, x².'))}
        {textField(['lesson', 'terms', language], tr('Термины и обозначения', 'Терминдер және белгілеулер'), language, 3)}
      </> : <>
        {textField(['prompt', language], tr('Условие задачи', 'Есептің шарты'), language, 5)}
        {stepsField('solution', language, tr('Решение по шагам', 'Қадамдық шешім'))}
        {stepsField('hints', language, tr('Последовательные подсказки', 'Бірізді көмек сөздер'))}
      </>}
    </section>)}
    {isTask && <label className="field">
      <span>{tr('Проверенный ответ', 'Тексерілген жауап')}</span>
      {Array.isArray(material.answer)
        ? <textarea rows={Math.max(3, Math.min(8, material.answer.length + 1))}
          value={material.answer.map(String).join('\n')}
          onChange={event => changeAt(['answer'], event.target.value === '' ? [] : event.target.value.split('\n'))} />
        : <input value={typeof material.answer === 'string' ? material.answer : ''}
          onChange={event => changeAt(['answer'], event.target.value)} />}
      <small className="muted">{tr(
        Array.isArray(material.answer)
          ? 'Один ответ на строку. В соответствии сохраняйте порядок элементов слева. Названия выбранных вариантов должны точно совпадать с вариантами задачи.'
          : 'Число или выражение. Сверьте ответ с решением и ограничениями задачи перед отправкой на проверку.',
        Array.isArray(material.answer)
          ? 'Әр жауапты бөлек жолға жазыңыз. Сәйкестендіруде сол жақ элементтер ретін сақтаңыз. Таңдалған жауап атаулары есеп нұсқаларымен дәл сәйкес болуы тиіс.'
          : 'Сан не өрнек. Тексеруге жіберер алдында жауапты шешіммен және есептің шектеулерімен салыстырыңыз.',
      )}</small>
    </label>}
  </div>;
}
