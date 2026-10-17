# P4/A1：两种实时构图与审核证据（#72）

本文件**不是美术通过证明**。以下构图均由 `src/render/CombatProjection.ts` 驱动真实 Three.js 相机，改变画幅与背景容纳比例，不改变二维战斗平面/命中判定、敌阵、操作与关卡时钟。

| 方案 | URL | 构图取舍 |
| --- | --- | --- |
| Stage（生产默认） | `?composition=stage` | 单位更大，左右边界保留安全边距，主战斗面积更饱满；手机视图为触屏操作保留纵向空间 |
| Breathing（对照） | `?composition=breathing` | 主体较小，扩充外侧空间，星空与行星可见面积增大；用于检验“过于拥挤”的风险 |

Stage 暂定为生产主方案：它解决 P3 主体过小和视觉重心分散的问题；是否**真的更好看**，以 `p4-a1-*.png` 两版 Chromium 渲染对照经人工确认后判断。参数属于视觉投影，不涉及移动、碰撞、弹道、二维 hitbox 和射击点。没有开发者 HUD、固定窄画框、整幅游戏宣传截图。

## P3 可靠基线

- P3 原版 `dev@e2c35a0a2fd8863f23babadfa8eaa6c0c4afd566`
- 正常战斗、桌面与手机截图：GitHub Actions [39021612762](https://github.com/SiliconYC/React-SpaceInvader/actions/runs/39021612762) 的 `p2-live-baseline-e2c35a0...` 附件，来自真正部署网页及 Chromium。
- P4 预定对照：`tests/p4-composition.browser.spec.ts` 每个尺寸分别输出 stage/breathing 未合成的整页截图及相机投影数据。
- 不得把独立源 SVG 当成用户此前认可的第二张概念图；原图不在当前 Git 仓库。

## 明确验收限制

Playwright 视窗宽高不是实机手机 GPU；视觉审查尚未完成，真实用户批准仍待获取。浏览器 screenshot 不证明商业产品美感。待 #73/#74/#75 后仍需重新在**同等截图条件**比对模型的实际观感。
