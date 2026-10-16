# P1 路线图：经典二维规则 + Three.js 三维表现

## 产品决定

- 使用 React + Three.js 构建有立体模型与视觉特效的 **2.5D《太空侵略者》**。
- 玩家只左右移动、向上射击；敌机集体横移、碰壁反向并下降，也向玩家开火。
- 玩家、敌机和子弹的**全部逻辑坐标与弹道共享二维战斗平面**，不实现三维飞行、纵深瞄准及三维碰撞。
- Three.js 是展示层，不是规则真值；正常战斗采用清晰稳定的镜头，过场允许三维运镜。
- 关卡由独立、版本化、经严格校验的 JSON 数据驱动。P1 至少两份可玩关卡、多波次。
- 每次独立交付合并 `dev`，均应能通过 <https://siliconyc.github.io/React-SpaceInvader/> 看到与验证可运行增量。

## 已建立的 7 个 Issue（#3 基础战场已交付，其余待实施）

| 顺序 | Issue | 独立用户可见验收 |
| --- | --- | --- |
| 1 | [#3 二维战场、确定性核心与测试](https://github.com/SiliconYC/React-SpaceInvader/issues/3) | 固定二维边界、60Hz 核心与三维网格；单测和浏览器冒烟 |
| 2 | [#4 玩家飞船左右移动](https://github.com/SiliconYC/React-SpaceInvader/issues/4) | 键盘左右移动且不能越界 |
| 3 | [#5 JSON 关卡与敌机编队](https://github.com/SiliconYC/React-SpaceInvader/issues/5) | 改 JSON 即可改变屏幕敌人阵形 |
| 4 | [#6 敌机折返与下降](https://github.com/SiliconYC/React-SpaceInvader/issues/6) | 编队横移、碰壁、下降均可见 |
| 5 | [#7 玩家射击、碰撞与计分](https://github.com/SiliconYC/React-SpaceInvader/issues/7) | 可实际击落敌人并累计积分 |
| 6 | [#8 敌机射击、生命与胜负](https://github.com/SiliconYC/React-SpaceInvader/issues/8) | 能完成一整局并重新开始 |
| 7 | [#9 多波次、双关卡与端到端验收](https://github.com/SiliconYC/React-SpaceInvader/issues/9) | 两种数据配置关卡可完整游玩 |

## 开发顺序及边界

阶段依赖原则上是 `#3 → #4 → #5 → #6 → #7 → #8 → #9`；后项不能把前项未验收的功能算作完成。一次优先实施 1–2 个相关 Issue，允许无冲突内容并行，但不为并行扩大架构。

一个 Issue 从最新 `dev` 建独立分支，子任务细粒度提交/推送，通过最终必需检查后 PR 合并 `dev`、关闭 Issue，再核对 GitHub Pages 实际效果。CI 可以取消同一 PR 过时测试，不能略过最新提交验收。

**P1 完成定义：** 一个无需外部服务的简体中文游戏，在 GitHub Pages 能选择至少两个数据驱动关卡，进行左右移动与射击，看到敌机进攻，计分、扣血、暂停、胜负、多波次以及重新开始均可工作；有确定性无界面测试和浏览器证据。

## P2 候选（暂不立 Issue）

可在 P1 验收后挑选：原创模型与音画精修、不同敌机技能与首领、触控输入、关卡图形化编辑器、本机存档和 PWA 离线。反对先实现复杂大型框架而延误完整游戏闭环。
