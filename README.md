# 侵略者仓库（React-SpaceInvader）

基于 **React + TypeScript + Three.js + Vite** 的浏览器游戏：用立体模型呈现经典二维《太空侵略者》，而不引入三维飞行操作。

> **当前状态：** Issue #3–#8 已实现首关一波的完整游戏闭环：敌阵进攻/发射、玩家移动/开火、计分与生命、暂停、胜败及重新开始。多波次、双关卡及切换留给 Issue #9。见 [P1 路线图](docs/ROADMAP.md)。

## 核心设计（2.5D）

- **玩法二维化：** 玩家只左右移动和射击；敌机编队横移、折返、下降并开火；玩家、敌人、子弹的逻辑位置、运动和碰撞均位于同一 `(x,y)` 战斗平面。
- **画面三维化：** Three.js 绘制立体飞船、敌机、光影、特效与过场镜头，**不参与规则判定**；作战镜头以稳定、清晰为主。
- **关卡数据化：** 独立 JSON 配置决定敌机编队、波次、速度、射击频率和胜负条件；数据须先校验。游戏核心独立于 React/Three.js，可用固定种子无界面测试。
- 无登录/后端/云存档，不从外部 CDN 加载必需运行时代码，使用原创素材；玩家界面简体中文。

玩家控制：点击「开始」后按 ←/→ 或 A/D 左右移动；**空格射击，按住自动连发（每 12 个逻辑 tick 一发），松开即停止连发**。失焦、暂停及重置释放按键和发射状态。三维模型只呈现纯逻辑引擎中的二维位置。

## 视觉风格

默认沉浸式宽屏战场、大画布、极少 HUD、无常驻网格或技术指标；调试模式才显示网格和逻辑状态。设计约束见 [AGENTS.md](AGENTS.md)。

## 关卡数据（v1）

示例：`public/levels/first-contact.json`。只需改 JSON 中 `waves[0].formation` 的行列、起点或间距，重建部署即可改变敌阵，无需修改 TypeScript。严格验证字段：`schemaVersion=1`、`id`、`metadata`、`world`、`waves`、`difficulty`、`victory`。每波包含 `spawnAtSeconds`、`formation`（type、rows、columns、startX、startY、spacingX、spacingY）、`movement` 与 `attack`；所有数字须为有限且合法范围，禁止越界或未知敌机类型。**#6 首波敌阵已按 JSON 的 `movement.horizontalSpeed`（世界单位/秒）、`descentPerTurn`（世界单位/次）、`startDirection`（-1/1）、`moveEveryTicks`（60Hz 时钟的整数间隔）及 `difficulty.speedMultiplier` 运动。** #7 已增加玩家射击；#8 已增加敌方发射、玩家三格生命、碰撞与终局判定；#9 才处理多波次。 若配置无效，界面直接显示中文报错，绝不静默回退硬编码阵型。

## 胜负与攻击规则（#8）

- 敌机按当前波次 JSON 的 `attack.shotsPerMinute`、`attack.projectileSpeed` 和 `difficulty.fireRateMultiplier` 定时射击，只从各列最底部存活敌机中以种子确定的随机数挑选发射者；`shotsPerMinute=0` 表示禁用。所有敌弹沿相同二维坐标平面向下飞行，扫描式 AABB 判定相对移动的玩家碰撞。
- 玩家初始 3 条生命，每次中弹扣 1 条、随后 60 个逻辑 tick 保护，命中弹立即消失；生命耗尽或敌机抵达防线则失败。清空敌人且没有等待波次则胜利，终局冻结行动和子弹，可点击「重新开始」重置计时、随机状态和分数。
- 本阶段只执行第一波。若 JSON 配置了后续波次，第一波清空后**不会提前宣布胜利**；下一波生成/通关留给 #9。页面采用无大面板的极简 HUD（分数、生命和结算文字）。

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
