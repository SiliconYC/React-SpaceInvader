# P3/C4 边缘岩石模型及可验证遮挡契约

- 真正的 Three.js 实体源：`src/render/ForegroundRocks.ts`，调用 #44 的 `createAsteroidGeometry` 生成四块低多边形、可实时三轴旋转的岩石；没有二维截图、外链、贴图和高成本屏幕景深。
- 原始模型工艺与种子保存在仓库的 TypeScript 源文件中，材质仅使用深蓝灰、低对比半哑光。靠镜头的 z=3 **只用于视觉**，玩家、敌机和子弹全部仍在原来的 XY 规则平面。
- 使用 #36 `CombatSceneLayers.addForeground` 和 `isSafeEdgeDecoration`，对每块旋转三维模型做保守投影包围盒，在每次渲染时验证主战场外缘、HUD 顶部、触控底部；不安全则隐藏，画面侧边空间不足也会缩小模型。触屏窄屏自动隐藏。背景不写入深度缓冲，交战单位在前景之后绘制。
- 运行时共有 4 个前景网格/绘制候选，资源离开渲染器时释放；漂移/转动仅由规则 tick 推导，暂停冻结，减少动态效果静止。
- 单测：`tests/foreground.test.ts`。真实 Chromium 截屏及玩法回归：`tests/p3-foreground.browser.spec.ts`，产物见对应 PR CI artifacts（包括桌面、左右移动射击、390px 竖屏）。部署后另由 Pages 工作流做在线 Chromium/WebGL 验收。
- 对任何无法通过 #36 投影安全门禁的屏幕尺寸**明确宁可隐藏岩石，也绝不遮挡射击**，不改变玩家移动边界，不新增三维碰撞。
