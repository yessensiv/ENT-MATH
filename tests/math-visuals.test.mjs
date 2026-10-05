import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/math-visuals.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const visuals = {};
runInNewContext(`${compiled}\nexports.testRadians = angleInPi; exports.testStyles = css;`, { exports: visuals, require });
const totals = [10, 20, 50, 100];

test('fraction tiles preserve an exactly representable share and otherwise select the closest whole count', () => {
  for (const oldTotal of totals) for (const newTotal of totals) for (let numerator = 0; numerator <= oldTotal; numerator++) {
    const result = visuals.convertFractionParts(numerator, oldTotal, newTotal);
    // Compare every legal tile count through integer cross-products, independent of floating-point rounding.
    const distance = n => Math.abs(n * oldTotal - numerator * newTotal);
    const closestDistance = Math.min(...Array.from({ length: newTotal + 1 }, (_, n) => distance(n)));
    assert.ok(Number.isInteger(result.parts) && result.parts >= 0 && result.parts <= newTotal);
    assert.equal(distance(result.parts), closestDistance, `${numerator}/${oldTotal} → ${newTotal} tiles`);
    assert.equal(result.rounded, distance(result.parts) !== 0);
    assert.ok(Math.abs(result.originalPercent - numerator * 100 / oldTotal) < 1e-10);
    assert.ok(Math.abs(result.actualPercent - result.parts * 100 / newTotal) < 1e-10);
  }
  const formerlySilentChange = visuals.convertFractionParts(5, 20, 10);
  assert.equal(formerlySilentChange.originalPercent, 25);
  assert.equal(formerlySilentChange.actualPercent, 30);
  assert.equal(formerlySilentChange.rounded, true);
});

test('invalid fractions cannot create a negative, overflowing, or nonintegral tile count', () => {
  for (const args of [[-1, 20, 10], [21, 20, 10], [1.2, 20, 10], [1, 0, 10], [1, -20, 10], [1, 20.5, 10], [1, 20, 0], [1, 20, 10.5], [NaN, 20, 10], [1, Infinity, 10]]) {
    assert.throws(() => visuals.convertFractionParts(...args), { name: 'RangeError' });
  }
});

test('all whole-degree angles from 0 to 360 produce exact reduced fractions of π', () => {
  for (let degrees = 0; degrees <= 360; degrees++) {
    const notation = visuals.testRadians(degrees);
    if (!degrees) { assert.equal(notation, '0'); continue; }
    const match = /^(\d*)π(?:\/(\d+))?$/.exec(notation);
    assert.ok(match, `${degrees}° has a valid π notation`);
    const numerator = Number(match[1] || 1), denominator = Number(match[2] || 1);
    assert.equal(numerator * 180, degrees * denominator);
    for (let factor = 2; factor <= Math.min(numerator, denominator); factor++) {
      assert.ok(numerator % factor || denominator % factor, `${notation} is reduced`);
    }
  }
});

const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(m => [m[1], m[2] ?? '']));

test('each bilingual model has one active panel, keyboard tab entry, connected labels, and unique element IDs', () => {
  for (const lang of ['ru', 'kk']) for (const initial of ['functions', 'inequalities', 'trig', 'geometry', 'solids', 'fractions']) {
    const html = renderToStaticMarkup(React.createElement(visuals.default, { lang, initial }));
    const ids = [...html.matchAll(/\bid="([^"]*)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size);
    const tags = [...html.matchAll(/<(?:button|div)\b[^>]*\brole="(?:tab|tabpanel)"[^>]*>/g)].map(m => attributes(m[0]));
    const tabs = tags.filter(t => t.role === 'tab'), panels = tags.filter(t => t.role === 'tabpanel');
    assert.equal(tabs.length, 6); assert.equal(panels.length, 6);
    assert.equal(tabs.filter(t => t['aria-selected'] === 'true').length, 1);
    assert.equal(tabs.filter(t => t.tabindex === '0').length, 1);
    assert.equal(panels.filter(t => !Object.hasOwn(t, 'hidden')).length, 1);
    assert.ok(tabs.find(t => t['aria-selected'] === 'true').id.endsWith(`-${initial}`));
    for (const tab of tabs) {
      const panel = panels.find(p => p.id === tab['aria-controls']);
      assert.ok(panel); assert.equal(panel['aria-labelledby'], tab.id);
    }
    for (const id of [...html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map(m => m[1])) assert.ok(ids.includes(id));
    assert.ok(html.includes('aria-valuetext='));
    assert.ok(!html.includes('NaN') && !html.includes('Infinity'));
  }
});

test('the global stylesheet and the embedded visual stylesheet parse without errors', () => {
  assert.ok(postcss.parse(readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')).nodes.length > 0);
  assert.ok(postcss.parse(visuals.testStyles).nodes.length > 0);
});
