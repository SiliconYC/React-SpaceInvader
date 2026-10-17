# #49 版本 1 的可选视觉主题

- 默认主题 `nebula-blue`（第一关）；第二种 `violet-drift`（第二关）。只需在 `public/levels/*.json` 修改 `visualTheme` 即可交换外观，不触碰速度、世界 XY、碰撞、计分、波次、音频和成绩。
- 保持关卡 `schemaVersion: 1`。新增的根字段 `visualTheme` 可选；旧关卡缺省等价于 `nebula-blue`。`src/levels/visualThemes.ts` 为唯一 **纯数据白名单**，资源仅能引用在 Git 中已有的 `public/art/backgrounds/galaxy-v2.webp`。
- 运行时两个主题复用**同一原始银河 WebP、同一行星/陨石/前景实体网格和同一主角/敌机资源**，仅更改背景色、银河图色调、行星/岩石色调和轮廓光颜色，不增加 draw call、纹理、模型或 GPU 后处理。
- 任意网址、路径穿越、脚本、未知 ID、非字符串均不能被当成外部 URL；`resolveVisualTheme` 保守回退并通过场景元素的 `data-visual-theme-warning` 输出诊断；业务关卡仍可玩。
- 切关重新建立渲染会话、释放旧纹理、GPU 网格、几何和材质，复用现有 `dispose()` 路径；源图及其生成脚本未更动：`public/art/backgrounds/galaxy-v2-source.png`、`scripts/art/generate_galaxy.py`。
- 验证：`tests/visual-themes.test.ts` 确保版本/安全/游戏一致；`tests/p3-themes.browser.spec.ts` 真实 Chromium 两主题截图、Pages 子路径、无外网请求、切关重置和非法主题回退；图像始终来自运行中的真实 Three.js 场景，不以参考 SVG 代替。
