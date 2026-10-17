# P3/D1 材质、灯光与色板

- 资产来源：`src/render/P3Palette.ts`（可编辑 sRGB 色板、半哑光参数及真实 Three.js 灯光设置），`src/render/ShipModels.ts`（原创可转动的实体几何，不是贴纸）。
- 统一形象：蓝白玩家、浅青推进器，橙色 Scout、珊瑚红 Raider、淡紫 Guardian；深蓝星云与淡灰蓝岩石只做衬底，避免高频反光。
- 共四盏低成本灯：暖白主方向光、冷蓝轮廓光、柔和半球光、微弱全局环境光；相机使用 sRGB/ACES，曝光 1.07。船体 roughness 约 0.66、metalness 0.09；小面积发光保持对比，不添加全屏 Bloom、阴影贴图、外部纹理或渲染目标。
- 使用现有 Q 版网格与合批渲染；XY 命中规则不参与材质调整。
- 证据：`tests/p3-lighting.test.ts`，`tests/p3-lighting.browser.spec.ts` 三幅真实 Chromium 截屏（桌面、Guardian 特写、手机竖屏），保留发布后 Pages 在线测试及截图。
- 性能：该调整没有添加网格、贴图、全屏后处理或阴影 Pass。手机 GPU 的实际性能必须依赖真实设备测量，CI 软件 WebGL 的数据不可冒充真机 FPS。
