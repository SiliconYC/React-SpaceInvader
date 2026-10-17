# P3/B：真实 Three.js 模型资产清单

每种模型使用 **Git 中的 TypeScript 参数化网格源码**，不使用外部 GLB、2D 飞船图片、MP4 或贴图。运行时由 `createShipTemplates` 实际创建 `Mesh`；`BattlefieldRenderer` 把网格作为战斗节点渲染。创建资源通过 `GpuResource[]` 跟踪并在退出时释放，所有模型使用原创通用几何构成。概念图见 `docs/art/reference/p3-lowpoly-q-concept.svg`，与下述实际模型不同。

| 模型 | 本轮实际源码和部件 | 授权与归属 | 浏览器实机证据 |
|---|---|---|---|
| 玩家机 (#38) | `src/render/ShipModels.ts#q-player-pivot`；实体宽翼、鼓起的陶瓷机背、凸起的深蓝透明感座舱、分离双推进舱与青色尾喷 | 2026-10-17 原创参数化 Three.js 网格，无第三方模型/图像/贴图；仓库自行持有和修改 | Playwright `p3-b1-player-gameplay.png`、`p3-b1-player-close-front.png`、`p3-b1-player-close-tilt.png`、`p3-b1-player-portrait.png`（CI artifact）；`?shipPreview=player` 和 `&shipAngle=tilt` 是仅用于截图的真实 WebGL 调试视角 |
| Scout / Raider / Guardian (#39) | 待 #39 独立 PR | 待核实 | 待 #39 |

**概念稿 ≠ 源码模型 ≠ Chromium 游戏截图。** 正式检查必须打开运行页面和实际截图。玩家命中盒 `PLAYER_WIDTH`、`PLAYER_HEIGHT`、`PLAYER_SPEED` 与子弹生成器不由本文件定义，因此三轴翻转不会改变规则。
