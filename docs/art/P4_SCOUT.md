# P4/A3 Scout 原创样板（#74）

`src/render/ShipModels.ts` 是实际 WebGL 资产装配文件；`src/render/P4PlayerGeometry.ts` 为仓库自有、可编辑的封闭曲面与双侧真实翼型生成器，无需导出外部 GLB。Scout 同 Player 共用造型系统而非简单换色；中心短促橙色壳体、两片弧折燕翼、深色独眼和双尾推进器，底色/受光面/光学面构成清楚的三级层次。

小尺寸读图优先级：机翼跨度 1.82、中心独眼及背甲、尾推进器；所有面都有真实 Z 厚度，三分之四近景可旋转。每个可见部件在 `BattlefieldRenderer.enemyBatches` 中用一个 InstancedMesh，24/40 架不会各自复制 draw call。Raider 和 Guardian 不在此 Issue 修改。

真实近景/普通 24 架/40 架 WebGL 截图以及 draw call JSON：`tests/p4-scout.browser.spec.ts`，CI 附件 `p4-a3-*`。所有素材为本仓库原创参数化源码；无第三方许可依赖。

**美术审查未批准。** 与 P3 和用户原始第二张概念图的最终人工对照仍须由 #69 完成。
