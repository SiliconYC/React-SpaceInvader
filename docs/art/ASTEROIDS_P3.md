# P3/C3 原创 3D 远景陨石

- 真实生成源码：`src/render/AsteroidField.ts`，四种以扰动 1 级二十面体为基础的参数几何，形状由固定种子导出；不需要外部贴图、生成器 CDN 或 GLB。
- 实际网页：12 块岩石只占用 **四个 InstancedMesh、四种 BufferGeometry、四个共享暗蓝灰材质**，一个实例不对应一个新材质或绘制调用。
- 分层：放进 `CombatSceneLayers.environment`，所有顶点围绕 z=-8～-13 的深空基准，在 XY 交战层后，绝不改变玩家/敌机/子弹的 z=0 逻辑 pivot，也没有岩石碰撞。
- 运动：从确定性编号和权威 tick/60 推导 0.13–0.17 rad/s 的低频漂移、柔和真实三轴自转与尺寸差别；暂停冻结、重置位置重复，减少动态效果时静止。
- 构图：远景主要在左右周缘，横屏可见；手机竖屏主动隐藏所有远景石块，避免变成挤压敌阵的噪音。
- 证据：源码单测 `tests/asteroids.test.ts`，真实 Chromium 截图 `p3-c3-distant-asteroids.png`、`p3-c3-asteroids-portrait-hidden.png`，所有权资源退出释放。
- 后续 #45 可复用同一几何生成器，但边缘前景必须通过 #36 的安全区门禁，不能直接加到普通战斗组。
