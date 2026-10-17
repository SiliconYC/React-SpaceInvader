# P4/B1 · Raider / Guardian 原创三维模型源与验收方法（#76）
- 源：`src/render/P4EnemyGeometry.ts`（确定性几何：截面放样、真正厚度的翼型与倒角盾板、独立枪舱与三维凸透镜）。
- 渲染入口：`src/render/ShipModels.ts`；继续使用原有 `BattlefieldRenderer` 的 `InstancedMesh` 同种部件共享模板与材质，XY 规则、命中判定、姿态和子弹发射位置均不变。
- Raider：双分叉钳翼、翼上暖色镶片、独立炮舱；Guardian：大盾轮廓、厚护肩、阶梯护甲、中央实体能量镜头。颜色并非唯一差别。
- 用户特别放行 B 组开发；#69 人工美术批准仍未获得，未取得原始选中参考图，不宣称完成美术比较。
- 浏览器证据：CI 中 `tests/p4-b1.browser.spec.ts` 产生正常游戏同屏、Raider/Guardian 近景正视及倾斜角、移动端、密集编队真实 Chromium 截图与 JSON 指标。截图为 Playwright 当前 WebGL 游戏，不是概念图。
- 验收：`npm run verify` + 浏览器全套 + 最新 PR 检查后再合并；线上 Pages 需要随后复核。GPU 软件渲染不等于实体手机性能。
