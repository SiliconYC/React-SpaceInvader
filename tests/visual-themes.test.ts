import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,statSync } from 'node:fs';
import { parseLevel } from '../src/levels/parse.ts';
import { DEFAULT_VISUAL_THEME,resolveVisualTheme,VISUAL_THEMES } from '../src/levels/visualThemes.ts';
import { GameEngine } from '../src/core/engine.ts';

const source=JSON.parse(readFileSync(new URL('../public/levels/first-contact.json',import.meta.url),'utf8'));
test('P3/E1: two approved data-only palettes share Git assets, never remote scripts or URLs',()=>{
  assert.deepEqual(Object.keys(VISUAL_THEMES).sort(),['nebula-blue','violet-drift']);
  const themes=Object.values(VISUAL_THEMES);
  assert.equal(VISUAL_THEMES['nebula-blue'].background,'art/backgrounds/galaxy-reactmono-veil.webp');
  assert.equal(VISUAL_THEMES['violet-drift'].background,'art/backgrounds/galaxy-p4-veil.webp');
  const source=statSync(new URL('../docs/art/sources/galaxy-reactmono-redesign-source.png',import.meta.url));
  const runtime=statSync(new URL('../public/art/backgrounds/galaxy-reactmono-veil.webp',import.meta.url));
  assert.ok(source.size>1_000_000,'the generated PNG source is retained in Git');
  assert.ok(runtime.size<300_000,'the same-origin runtime texture stays small');
  assert.notEqual(themes[0].galaxyTint,themes[1].galaxyTint);
  assert.notEqual(themes[0].sky,themes[1].sky);
  assert.equal(resolveVisualTheme(undefined).id,DEFAULT_VISUAL_THEME);
  assert.equal(resolveVisualTheme('violet-drift').id,'violet-drift');
  for(const untrusted of ['https://malicious.invalid/a.png','../../favicon.ico','javascript:alert(1)','unknown',null,23,{url:'evil'}]){
    const result=resolveVisualTheme(untrusted);
    assert.equal(result.id,DEFAULT_VISUAL_THEME);
    assert.ok(result.warning);
  }
});
test('P3/E1: legacy v1 stays compatible, bad theme falls back without touching XY rules',()=>{
  const legacy=structuredClone(source); delete legacy.visualTheme;
  const wrong=structuredClone(source);wrong.visualTheme='../../evil.webp';
  const violet=structuredClone(source);violet.visualTheme='violet-drift';
  const baseline=parseLevel(legacy);
  const malicious=parseLevel(wrong);
  const alternate=parseLevel(violet);
  assert.equal(baseline.schemaVersion,1);
  assert.equal(baseline.visualTheme,'nebula-blue');
  assert.equal(baseline.visualThemeWarning,null);
  assert.equal(malicious.visualTheme,'nebula-blue');
  assert.match(malicious.visualThemeWarning!,/回退/);
  assert.equal(alternate.visualTheme,'violet-drift');
  for(const level of [baseline,malicious,alternate]){
    const game=new GameEngine(20261017,level.world,level);
    assert.equal(game.snapshot().enemies.length,24);
    assert.equal(game.snapshot().world.width,36);
    assert.equal(game.snapshot().world.height,24);
  }
  assert.deepEqual(baseline.waves,alternate.waves);
  assert.deepEqual(baseline.difficulty,alternate.difficulty);
});
