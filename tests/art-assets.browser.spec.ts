import { readFileSync, statSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('P3/A3: 真正入库的原创参考图可以由 Chromium 解码，不是聊天外链或运行时冒充',async({page},info)=>{
  const path='docs/art/reference/p3-lowpoly-q-concept.svg';
  const svg=readFileSync(path,'utf8');
  expect(statSync(path).size).toBeGreaterThan(12000);
  expect(statSync(path).size).toBeLessThan(150000);
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  expect(svg).toContain('viewBox="0 0 1600 900"');
  expect(svg).toContain('</svg>');
  expect(svg).not.toMatch(/<image\b|https?:\/\//g); // no externally loaded images
  const data=Buffer.from(svg).toString('base64');
  await page.setViewportSize({width:1280,height:720});
  await page.setContent(`<html><head><meta charset="utf-8"><style>html,body{margin:0;background:#07152b}img{display:block;width:100vw;height:100vh;object-fit:contain}</style></head><body><img alt="P3 Q 版原创美术参考" src="data:image/svg+xml;base64,${data}"></body></html>`);
  const image=page.locator('img');
  await image.evaluate(async img=>{await (img as HTMLImageElement).decode();});
  expect(await image.evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBe(1600);
  expect(await image.evaluate(e=>(e as HTMLImageElement).naturalHeight)).toBe(900);
  await page.screenshot({path:info.outputPath('p3-concept-source-preview.png'),fullPage:true});
});
