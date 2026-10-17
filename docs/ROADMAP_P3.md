# P3 美术升级分组与执行顺序

**目标：** 将现有完成 P1/P2 的 2.5D《太空侵略者》升级到用户选择的**第二张 Q 版低多边形概念图**的质量。**总枢纽 [#34](https://github.com/SiliconYC/React-SpaceInvader/issues/34)**。开发目标是实际可玩的 Three.js 模型与 Git 内素材，并非图片视频演示。P3 当前全部为**未开始的待实施 Issue**。

## 任务分组

| 组 | Issue | 内容 |
| --- | --- | --- |
| **A 场景基础** | [#35](https://github.com/SiliconYC/React-SpaceInvader/issues/35) · [#36](https://github.com/SiliconYC/React-SpaceInvader/issues/36) · [#37](https://github.com/SiliconYC/React-SpaceInvader/issues/37) | 弱透视投影、分层/遮挡安全区、美术素材契约和参考图入库 |
| **B 三维单位** | [#38](https://github.com/SiliconYC/React-SpaceInvader/issues/38) · [#39](https://github.com/SiliconYC/React-SpaceInvader/issues/39) · [#40](https://github.com/SiliconYC/React-SpaceInvader/issues/40) · [#41](https://github.com/SiliconYC/React-SpaceInvader/issues/41) | Q 版玩家机、三类 Q 版敌机、玩家翻飞、敌机姿态动画 |
| **C 太空背景** | [#42](https://github.com/SiliconYC/React-SpaceInvader/issues/42) · [#43](https://github.com/SiliconYC/React-SpaceInvader/issues/43) · [#44](https://github.com/SiliconYC/React-SpaceInvader/issues/44) · [#45](https://github.com/SiliconYC/React-SpaceInvader/issues/45) | 真正生成并提交 Git 的星云图、3D 带环天体、3D 动态陨石、无遮挡前景 |
| **D 光效与 UI** | [#46](https://github.com/SiliconYC/React-SpaceInvader/issues/46) · [#47](https://github.com/SiliconYC/React-SpaceInvader/issues/47) · [#48](https://github.com/SiliconYC/React-SpaceInvader/issues/48) | 材质/光色、发射与爆炸风格、极简 HUD |
| **E 数据与验收** | [#49](https://github.com/SiliconYC/React-SpaceInvader/issues/49) · [#50](https://github.com/SiliconYC/React-SpaceInvader/issues/50) | 关卡视觉主题、P3 线上综合验收与性能 |

## 建议分配为 6 个顺序执行的 Chat Session

1. **Session A · 3 个 Issue：** #35、#36、#37。先固定战斗投影、无遮挡分层和资产提交标准；一个 Issue 一个分支/PR。
2. **Session B · 2 个 Issue：** #38、#39。真正重制玩家和敌机；可在 A 组完成后并行，但若改同一模型文件则串行。#37 应先归档参考图。
3. **Session C · 4 个 Issue：** #42、#43、#44、#45。图片生成与模型各自独立，可先并行 #42/#43/#44；#45 在 #44 与 #36 完成后开始。
4. **Session D · 3 个 Issue：** #40、#41、#46。#40 依赖 #38，#41 依赖 #39；#46 收口模型/背景色彩和灯光，单独测试。
5. **Session E · 2 个 Issue：** #47、#48。统一打击反馈和 HUD，与既有音效、积分和触控兼容。
6. **Session F · 2 个 Issue：** #49、#50。数据主题最终接入、真实 Pages 画面/遮挡/性能/设备验收；不提前关闭总枢纽。

共 **16 个子 Issue**；总枢纽 #34 只有全部验收完成后才关闭。所有子 Issue 都必须有自己独立的验收与合并目标 `dev`，不要把几个子 Issue 混到一个长寿命分支完成。

## 几个需要尤其重视的风险

- **弱透视误判：** XY 平面与屏幕平行、视轴尽量垂直，投影必须实际测量。远机位 PerspectiveCamera 只是增强模型厚度/远近空间感，不应扭曲平面单位的位置大小。保留正交方案作为验收后可采用的回退。
- **遮挡：** 近景岩石不得掩盖子弹、敌机、玩家或手机虚拟按钮；中央主战斗区永远最清晰。
- **3D 假实现：** 除银河/星云允许 2D 图外，行星、环、陨石、飞船必须为真实 Three.js 网格；模型或图片不入 Git 即不算交付。
- **概念图与现实差距：** 对图中银河、灯光、主体比例、HUD、色板建立真实浏览器截图对照，不允许用全屏宣传图代替运行场景，不追复杂贴图写实。
- **性能和连续开发：** 沿用 `dev`、独立 PR、必要 CI、Pages 可验证、资源回收、触控操作与本地成绩，不重新开发 P1/P2。

完整美术契约：[ART_DIRECTION_P3.md](ART_DIRECTION_P3.md)。软件工程/命令规范以根 [AGENTS.md](../AGENTS.md) 为准。
