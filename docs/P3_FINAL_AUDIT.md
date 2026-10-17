# P3 最终验收与差距记录（Issue #50）

> 注意：这是**可复现的技术验收**，不能把源概念图、软件渲染截图或自动化通过写成“用户已认可商业级美术”。最终 PR 与线上实际运行的结果以 GitHub Actions 执行状态和附件为准。

## 真实源文件、运行时和目标概念图

| 对象 | 可编辑/原图 Git 路径 | 实际网页源码/文件 | 当前一致性与差异 |
| --- | --- | --- | --- |
| 1600×900 参考 Q 版图 | `docs/art/reference/p3-lowpoly-q-concept.svg` | 不是游戏背景，不能被当成 Three.js 截图 | **这张图是项目内重新绘制的参考，而非用户此前选中“第二张概念图”的原始像素文件**，故不能声称与原始概念图一一精确匹配 |
| 银河星云 | `public/art/backgrounds/galaxy-v2-source.png`、`scripts/art/generate_galaxy.py` | `public/art/backgrounds/galaxy-v2.webp`、`src/render/GalaxyBackdrop.ts` | 原图 134,363 字节，优化文件 6,536 字节（Git 目录记录），实际 TextureLoader 在同源子路径加载；不是把整个游戏做成一张图片 |
| 玩家及三种敌机 | `src/render/ShipModels.ts` | `BattlefieldRenderer.ts`，实体网格与批量 InstancedMesh | 真实挤出/低面数几何，XY 规则命中盒未变；是否达到成熟商业游戏的观感**仍需人工视觉判断** |
| 带环天体 | `src/render/RingedPlanet.ts` | SphereGeometry + RingGeometry | 真三维，球环可单独倾斜、转动 |
| 后景陨石 | `src/render/AsteroidField.ts` | 4 个 InstancedMesh 批次/12 个低模实体 | 真三维移动/旋转，纵深仅用于展示 |
| 前景近景岩石 | `src/render/ForegroundRocks.ts` | `src/render/CombatSceneLayers.ts` 安全投影门禁 | 窄屏隐藏，所有模型不允许遮挡战斗及触控 |
| 色板、打击效果、HUD | `src/render/P3Palette.ts`、`src/render/CombatFX.ts`、`src/App.tsx`、`src/style.css` | 真实灯光、低模碎片与 HTML/内联 SVG | 统一低干扰 Q 版，但不是后处理辉光渲染的逐像素复刻 |
| 关卡主题 | `src/levels/visualThemes.ts`、`public/levels/*.json` | 复用同一图像及已有模型，应用两套白名单颜色 | 当前两种场景可通过纯数据切换、无外网或动态脚本 |

## 自动化证据

- `npm run verify` 运行核心规则、类型检查、编译、产物、难度基线与 `scripts/audit-p3-assets.mjs`；结果 JSON 为 `artifacts/p3-asset-audit.json`。
- `tests/p3-final.browser.spec.ts` 真实 Chromium 生成 1920×1080、1440×900、玩家左右边缘、40 架敌机压力以及 390×844 和 844×390 触屏模拟的 **WebGL 原生截图**；同时记录渲染调用、GPU 几何/纹理、特效上限与软件浏览器渲染帧率，导出 `p3-final-performance.json`。
- 原有 `tests/mobile.browser.spec.ts` 与 `tests/feedback.browser.spec.ts` 检查上下文丢失恢复、重复切关和重置、受击/护甲/胜负、密集粒子、音量/排行榜/触控；全量浏览器测试在 PR 和合并后的 Pages 各运行一次。
- `.github/workflows/deploy.yml` 必须按 `build-sha.txt` 检查公网 Pages SHA，并取回 JS，加载线上真实 WebGL 和所有测试截图。完成后在 Issue #50 留下**准确执行编号、提交与结论**，不得在工作流结束前先写通过。

## 技术阈值和限制

- 单场景目标：正常画面 draw calls < 72、几何 < 100、纹理 < 30、动画粒子池 <= 72；并且玩家到达最左/最右边界时屏幕坐标仍在画布范围。
- 性能数据来自 GitHub Ubuntu Actions 的 Chromium WebGL，可能为 SwiftShader **软件 GPU**；测试会记录真正 renderer 和样本 FPS，但不可据此推论真实 iPhone、Android 或独显运行表现。
- 自动化能证明资源存在、场景类型、合法输入与事件回归，**无法自动证明实际美术已达到用户要求的成熟商业作品水准**。对于这两项差距，必须保留明确后续验收记录，而不是做虚假完成声明。
- 参考图与实况图需由人对照：玩家头身/翼比例、敌机三类剪影差异、天体环、星云干扰度、遮挡、材质质感、HUD。概念参考比实际实时模型更加理想化是潜在未达标项，不能以一张源 SVG 贴进画布作弊。

## 范围

只审计 P3 #35～#49 交付并完善测试留痕，不新增核心玩法或第三维碰撞；不改 `main`。Issue #34 只有 #35～#50 全部关闭、CI 与 Pages 真实可用时才可以关闭。未做的实际手机 GPU 与人工审美验收须以**待验**标注，独立留待后续阶段。
