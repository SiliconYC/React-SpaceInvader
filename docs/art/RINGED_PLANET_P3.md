# P3/C2 环形天体实资产

- 实际 Three.js 生成源码：`src/render/RingedPlanet.ts`，无外部模型文件、纹理、图片或引用第三方作品；由可编辑三维参数源即时建立真实 `SphereGeometry`、`RingGeometry` 与独立网格材质。
- 星球：24×12 面数的多边形球，三角面四色弱对比蓝紫条带、半哑光材质；光环：半径 1.38～2.13 的 64 节、6 同心段环形网格，绕 X/Y/Z 实际倾斜，片段有真实三维前后深度关系。
- 图层：`CombatSceneLayers.celestial`，相机视向下 `z=-18`，玩家/敌机/双方子弹始终使用 `z=0` 权威逻辑，任何视觉重叠均在背后，不遮挡。
- 安全：视口缩放定位于右上外缘，竖屏缩小；按引擎 tick 极慢转动，暂停、减少动态效果冻结；退出应用单独释放球/环材质和几何。
- 调试：`?planetInspect=side` 改变真实网格 3D 姿态，浏览器截图 `p3-c2-ringed-planet-desktop.png`、`p3-c2-ringed-planet-portrait.png` 和 `p3-c2-ringed-planet-tilt.png`。概念稿只是参考，以上截图源自 Three.js 实测。
