# 侵略者仓库（React-SpaceInvader）

基于 **React + TypeScript + Three.js + Vite** 的浏览器游戏：用立体模型呈现经典二维《太空侵略者》，而不引入三维飞行操作。

> **当前状态：** Issue #3 已建立二维确定性核心与 Three.js 战场显示；飞船、敌机、射击、关卡尚未实现。下一步 Issue #4。见 [P1 路线图](docs/ROADMAP.md)。

## 核心设计（2.5D）

- **玩法二维化：** 玩家只左右移动和射击；敌机编队横移、折返、下降并开火；玩家、敌人、子弹的逻辑位置、运动和碰撞均位于同一 `(x,y)` 战斗平面。
- **画面三维化：** Three.js 绘制立体飞船、敌机、光影、特效与过场镜头，**不参与规则判定**；作战镜头以稳定、清晰为主。
- **关卡数据化：** 独立 JSON 配置决定敌机编队、波次、速度、射击频率和胜负条件；数据须先校验。游戏核心独立于 React/Three.js，可用固定种子无界面测试。
- 无登录/后端/云存档，不从外部 CDN 加载必需运行时代码，使用原创素材；玩家界面简体中文。

## 视觉风格

默认沉浸式宽屏战场、大画布、极少 HUD、无常驻网格或技术指标；调试模式才显示网格和逻辑状态。设计约束见 [AGENTS.md](AGENTS.md)。

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
