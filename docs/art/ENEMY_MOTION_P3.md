# P3/B4：敌机可复现三轴姿态，不改变编队规则

真实运行时代码：`src/render/EnemyShipMotion.ts`（确定性 ID→相位；按引擎 tick 驱动三类姿态）与 `src/render/BattlefieldRenderer.ts`（为现有 `InstancedMesh` 的每一个部件生成 `translation(XY,0) × localRotation × smallVisualLift × partMatrix`），**没有新资产或任何 3D 玩法**。

- Scout：约 3.4 Hz 视觉轻摆，滚转 ≤6.1°，轻微抬升 ≤0.043 世界单位。
- Raider：按编队左右方向侧倾约 5.5°，叠加慢摆；两侧机炮始终从原来 **XY 规则** 发射。
- Guardian：低频、幅度小的偏航，滚转 ≤2°，大面积稳重装甲保持阵形可读。
- 每架敌机依赖自身稳定字符串 ID 计算相位，同 seed、同 tick、同 ID 得到同样结果，无任何 `Math.random` 或时钟漂移。
- **休眠/暂停：** 游戏时钟不推进，姿态矩阵保持原值；待开始/失败/胜利及重置姿态归零。
- `prefers-reduced-motion: reduce` 时关闭全部姿态和 bob，仍显示真实低模模型。
- 只给可视部件添加三轴变化，弹道、逻辑位置、hitbox、敌阵折返及分数都来自 `GameSnapshot`，没有读写权威规则状态。

证据：CI 的真实 Chromium `p3-b4-scout-inflight.png`、`p3-b4-raider-inflight.png`、`p3-b4-guardian-inflight.png`，配合 `tests/enemy-motion.test.ts`、`tests/p3-enemy-motion.browser.spec.ts`；绘制调用数与 GPU 资源延续 #39 批处理。参考概念图不是这些 WebGL 截图。
