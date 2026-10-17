# P3/D2 战斗视觉资源契约

- `src/render/BattlefieldRenderer.ts`：双向弹丸仍基于原本 XY 子弹位置，使用单个短 CapsuleGeometry，青白玩家弹、暖橘敌弹。原本胶囊缩短、发光强度下降；无光束贴图与大范围泛光。
- `src/render/CombatFX.ts`：真实低面数 Tetrahedron/Octahedron 碎片以及短命 RingGeometry，统一响应原本 `GameEvent` 的射击、敌机击毁、护甲损伤、玩家受击、波次/结果。Tetrahedron 会实际绕 X、Z 旋转；粒子特效仅在视觉图层。
- 每个特效只引用共享几何/材质，同一渲染会话复用不超过 72 个 Mesh，事件 ID 去重、资源按引擎重置/暂停清空。不可用特效触发真实命中、得分或二次声音。关闭画布后释放全部 GPU 几何/材质。
- 不使用 screen-space 后处理与透明拖尾纹理，避免噪点占屏，且不修改 `src/core`。
- 可验证证据：`tests/p3-combat-fx.browser.spec.ts`、`tests/feedback.browser.spec.ts`；真实 Chromium 截图在 CI artifacts；发布后另通过线上 Pages 检查。
