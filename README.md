# 侵略者仓库（React-SpaceInvader）

基于 **React + TypeScript + Three.js + Vite** 的浏览器游戏：用立体模型呈现经典二维《太空侵略者》，而不引入三维飞行操作。

> **当前状态：** P1 Issue #3–#9 已实现完整的双关卡可玩闭环：JSON 关卡选择、多波次进攻、玩家射击/躲避、计分生命、暂停、胜负和重新开始。见 [P1 路线图](docs/ROADMAP.md)。

## 核心设计（2.5D）

- **玩法二维化：** 玩家只左右移动和射击；敌机编队横移、折返、下降并开火；玩家、敌人、子弹的逻辑位置、运动和碰撞均位于同一 `(x,y)` 战斗平面。
- **画面三维化：** Three.js 绘制立体飞船、敌机、光影、特效与过场镜头，**不参与规则判定**；作战镜头以稳定、清晰为主。
- **关卡数据化：** 独立 JSON 配置决定敌机编队、波次、速度、射击频率和胜负条件；数据须先校验。游戏核心独立于 React/Three.js，可用固定种子无界面测试。
- 无登录/后端/云存档，不从外部 CDN 加载必需运行时代码，使用原创素材；玩家界面简体中文。

玩家控制：点击「开始」后按 ←/→ 或 A/D 左右移动；**空格射击，按住自动连发（每 12 个逻辑 tick 一发），松开即停止连发**。失焦、暂停及重置释放按键和发射状态。三维模型只呈现纯逻辑引擎中的二维位置。

## 视觉风格

默认沉浸式宽屏战场、大画布、极少 HUD、无常驻网格或技术指标；调试模式才显示网格和逻辑状态。设计约束见 [AGENTS.md](AGENTS.md)。

## 关卡数据（v1）

示例：`public/levels/first-contact.json`（初次接触，一波侦察敌阵）和 `public/levels/crossfire.json`（交叉火力，两波袭击/重装敌阵）。选择列表由 `public/levels/index.json` 严格读取（关卡 ID、名称、简介）。只需改 JSON 中 `waves[0].formation` 的行列、起点或间距，重建部署即可改变敌阵，无需修改 TypeScript。严格验证字段：`schemaVersion=1`、`id`、`metadata`、`world`、`waves`、`difficulty`、`victory`。每波包含 `spawnAtSeconds`、`formation`（type、rows、columns、startX、startY、spacingX、spacingY）、`movement` 与 `attack`；所有数字须为有限且合法范围，禁止越界或未知敌机类型。**#6 首波敌阵已按 JSON 的 `movement.horizontalSpeed`（世界单位/秒）、`descentPerTurn`（世界单位/次）、`startDirection`（-1/1）、`moveEveryTicks`（60Hz 时钟的整数间隔）及 `difficulty.speedMultiplier` 运动。** #7 已增加玩家射击；#8 已增加敌方发射、玩家三格生命、碰撞与终局判定；#9 已实现清空当前波、等待 `spawnAtSeconds` 最早绝对生成时刻、按 JSON 切换各波运动与攻击参数；清空最终波才判胜。若配置无效，界面直接显示中文报错，绝不静默回退硬编码阵型。

## 胜负与攻击规则（#8）

- 敌机按当前波次 JSON 的 `attack.shotsPerMinute`、`attack.projectileSpeed` 和 `difficulty.fireRateMultiplier` 定时射击，只从各列最底部存活敌机中以种子确定的随机数挑选发射者；`shotsPerMinute=0` 表示禁用。所有敌弹沿相同二维坐标平面向下飞行，扫描式 AABB 判定相对移动的玩家碰撞。
- 玩家初始 3 条生命，每次中弹扣 1 条、随后 60 个逻辑 tick 保护，命中弹立即消失；生命耗尽或敌机抵达防线则失败。清空敌人且没有等待波次则胜利，终局冻结行动和子弹，可点击「重新开始」重置计时、随机状态和分数。
- **多波次已实现**：必须清空上一波、且达到下一波 `spawnAtSeconds` 秒数（60Hz 固定时间步）才会生成下一波；清空最终波后胜利。跨波重新载入运动方向、敌机类型/数量、射击频率、弹速和难度乘数；保留玩家生命与累积分数。波间等待、暂停和重新开始均正常工作。页面采用极简 HUD（分数、波次、生命和结算文字）。

## 选择与扩展关卡

进入 Pages，左上角可在开局、重置后或结算后选择「第一关 · 初次接触」及「第二关 · 交叉火力」。战斗中和暂停时不能中途切换。关卡切换会读取并完整验证目标文件，校验失败时明确报错，旧关卡状态不会被静默破坏。要增加关卡：新增同源 `public/levels/<id>.json`，并在 `public/levels/index.json` 增加对应 ID、名称和简介；关卡文件内部 id 必须与文件名相同，元数据应与清单相符。

**数据契约版本策略：** 当前只接受严格 `schemaVersion: 1`；未来新版本必须增加显式解析/迁移器和回归测试，不可静默补充未知字段。关卡必须有 1～16 波、严格递增且第一波从 0 秒开始，每波位置/数量/类型/攻击与运动须合法，累计敌机不超过 256；非法引用、路径遍历、重复 ID、错误范围、无法兼容的版本均拒绝。清单要求 2～16 个不重复关卡。

## 运行与部署

- 默认开发/PR 合并分支：`dev`（不改 `main`）。
- [在线 Pages](https://siliconyc.github.io/React-SpaceInvader/)：GitHub Pages 的 **Source = GitHub Actions**，合并 `dev` 后自动构建发布。地址基础路径 `/React-SpaceInvader/`。
- Node.js 22，使用已提交的 `package-lock.json`：`npm ci`、`npm run dev`、`npm run verify`（规则单测、类型检查、生产构建、静态产物检查）。
- 浏览器验收：先 `npx playwright install chromium`，再 `npm run test:browser`（依赖 Chromium，验证战场渲染、缩放坐标、命令交互与浏览器异常）。
- `src/core/` 是完全独立于 React / DOM / Three.js 的纯 TypeScript，固定 60Hz 和种子随机数；`src/render/` 仅将逻辑世界投影到三维网格。
- Pages 成功发布不等同实际浏览器可玩验收；各个功能 Issue 应提供实际交互与逻辑测试证据。

## 开发规范与文档

- [AGENTS.md](AGENTS.md)：AI 开发规则、2.5D 硬约束、独立分支与 PR、CI 精简和验收。
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：二维逻辑与三维渲染隔离、数据驱动关卡、测试及发布。
- [docs/ROADMAP.md](docs/ROADMAP.md)：P1 七项 Issue、依赖顺序、最小完整可玩闭环。

每个 Issue 从 `dev` 建立独立短期分支，细粒度 Commit/Push，独立 PR 合并后部署 GitHub Pages，再验收增量。

## P2/4 敌人行为与难度测量（Issue #23）

- `scout`（初次接触）：单发、命中一次击毁、缓慢下降，新手练习。
- `raider`（交叉火力首波）：JSON `behavior: {"armorHits":1,"volleySize":2}`，从不同存活列齐射两发；关卡降低了单位火力频次，以免突然变成满屏弹幕。
- `guardian`（交叉火力次波）：JSON `behavior: {"armorHits":2,"volleySize":1}`，需两枚玩家子弹命中、第一次出现原创装甲击中反馈，击毁才得分；其速度与射速刻意降低，不以速度和数量双重加压。
- 行为为 **v1 波次可选字段**：旧版省略则严格归一成 `armorHits=1`、`volleySize=1`，不改变 schemaVersion。指定时两项均必须是 1～3 的整数；未知字段、漏填、非法值一律报错。`src/core` 实现多列弹道与装甲耐久，WebGL 只呈现状态与事件。
- `npm run measure:difficulty`：6 个固定种子，自动逐敌追踪射击，比较真实旧 P1 参数（在脚本内恢复，不修改生产 JSON）与当前 P2，两关各统计终局、耗时、玩家/敌弹数、命中/击毁、积分。结果记在 Actions `verify` 的执行日志中；**它是可重复机器人基准，不是人类玩家体验证明**。

## P2 第二轮（#24～#26）

- **音频**：开火、受伤、击毁、波次及胜负为原创 Web Audio 合成声；右上「音频」可独立控制音效、背景氛围和音量。首次点击开始才解锁，偏好只在本机储存，无声音权限也能玩。
- **本机成绩**：非战斗时右上「成绩」查看当前关卡最高分/前八名；仅记录完成的胜负局（关卡、波次、逻辑时长及种子），可确认清空。没有账户、跨设备同步、联网榜单或防作弊。
- **手机触控**：支持同时按住左右和射击，失焦、暂停、多指结束时释放。横竖屏自适应并保留完整二维战场，触屏 GPU 像素倍率上限 1.5。WebGL 暂时失效时暂停规则推进，恢复后继续。
- 自动验收区分浏览器模拟触屏/软件 WebGL 数据和实体手机实测；性能基准保留 CI 实际数据记录，真实设备手感及人工听感尚未验证。

## P3 新阶段：Q 版低多边形 Three.js 美术升级（规划中）

已建立 [P3 总枢纽 #34](https://github.com/SiliconYC/React-SpaceInvader/issues/34) 和 **#35～#50 共 16 项**，分成投影与分层、单位与姿态、银河及天体/陨石、光效与 UI、最终验收五组。以用户在对话选定的第二张 Q 版低多边形概念图为参考，必须做到真正 Three.js 实时模型，生成图片/模型资产要提交 Git 而不能停留在聊天里。

- [P3 美术/镜头/资产规范](docs/ART_DIRECTION_P3.md)
- [P3 五组任务与 Chat Session 分配](docs/ROADMAP_P3.md)

本阶段功能尚未实现；原 P1/P2 游戏维持可玩状态。视觉新阶段不得改变 XY 单平面玩法。
