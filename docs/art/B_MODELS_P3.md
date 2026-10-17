# P3/B：真实 Three.js 模型资产清单

每种模型使用 **Git 中的 TypeScript 参数化网格源码**，不使用外部 GLB、2D 飞船图片、MP4 或贴图。运行时由 `createShipTemplates` 实际创建 `Mesh`；`BattlefieldRenderer` 把网格作为战斗节点渲染。创建资源通过 `GpuResource[]` 跟踪并在退出时释放，所有模型使用原创通用几何构成。概念图见 `docs/art/reference/p3-lowpoly-q-concept.svg`，与下述实际模型不同。

| 模型 | 本轮实际源码和部件 | 授权与归属 | 浏览器实机证据 |
|---|---|---|---|
| 玩家机 (#38) | `src/render/ShipModels.ts#q-player-pivot`；实体宽翼、鼓起的陶瓷机背、凸起的深蓝透明感座舱、分离双推进舱与青色尾喷 | 2026-10-17 原创参数化 Three.js 网格，无第三方模型/图像/贴图；仓库自行持有和修改 | Playwright `p3-b1-player-gameplay.png`、`p3-b1-player-close-front.png`、`p3-b1-player-close-tilt.png`、`p3-b1-player-portrait.png`（CI artifact）；`?shipPreview=player` 和 `&shipAngle=tilt` 是仅用于截图的真实 WebGL 调试视角 |
| Scout (#39) | `src/render/ShipModels.ts#scout`：窄幅三叉翼、两片浅金上翼面、单独凸起侦测眼 | 2026-10-17 自研参数化网格、无第三方贴图/模型 | `p3-b2-scout-close.png` 与 `p3-b2-scout-squad.png` |
| Raider (#39) | `src/render/ShipModels.ts#raider`：两侧分离炮舱、外展钳翼、厚机背和暗色座舱 | 同上 | `p3-b2-raider-close.png` 与 `p3-b2-raider-squad.png` |
| Guardian (#39) | `src/render/ShipModels.ts#guardian`：多层盾形装甲、双肩装甲及中央凸出青色能量核 | 同上 | `p3-b2-guardian-close.png` 和既有守卫阵截图 |

**概念稿 ≠ 源码模型 ≠ Chromium 游戏截图。** 正式检查必须打开运行页面和实际截图。玩家命中盒 `PLAYER_WIDTH`、`PLAYER_HEIGHT`、`PLAYER_SPEED` 与子弹生成器不由本文件定义，因此三轴翻转不会改变规则。

全部敌机保持 `src/render/BattlefieldRenderer.ts` 中的逐型号逐部件 `InstancedMesh`：同一型号 24 架仍共用一组几何/材质，正常页面无额外贴图（预期 `data-gpu-textures=0`）。`?shipPreview=scout|raider|guardian` 是真实 WebGL 近景验收视角，不是离线概念画。实际模型几何尺寸与守卫可受两次击中等**逻辑完全解耦**。

## #40 玩家动画层契约

`src/render/PlayerShipMotion.ts` 只读取权威快照的 x、tick、phase 与展示时钟，从不发送游戏命令或重新计算规则碰撞。渲染器中 `authoritative-player-xy` 根节点始终放在 `toDisplayXY(state.player.position)` 的平面 `z=0`；内层 `playerVisual` 才允许滚转、偏航、俯仰、轻度 bob 和射击瞬间短后坐。停顿时冻结，重置时清零，媒体设置减少动态效果时完全静止。运动幅度限制：最大滚转约 12°、偏航约 5°、视觉 bob 小于 0.05 世界单位。

真实浏览器双向运动截图：`p3-b3-player-bank-right.png`、`p3-b3-player-bank-left.png`（PR 的 Chromium 工件），并有暂停、减少动态效果和逻辑射击起点回归测试。没有额外贴图、模型资产与碰撞类型变更。
