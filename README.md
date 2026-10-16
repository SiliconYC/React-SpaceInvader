# 侵略者仓库（React-SpaceInvader）

基于 **React + TypeScript + Three.js + Vite** 的浏览器游戏：用立体模型呈现经典二维《太空侵略者》，而不引入三维飞行操作。

> **当前状态：** React / Three.js 联通测试已建立，**游戏功能尚未实现**；第一阶段 Issue #3–#9 已创建，见 [P1 路线图](docs/ROADMAP.md)。

## 核心设计（2.5D）

- **玩法二维化：** 玩家只左右移动和射击；敌机编队横移、折返、下降并开火；玩家、敌人、子弹的逻辑位置、运动和碰撞均位于同一 `(x,y)` 战斗平面。
- **画面三维化：** Three.js 绘制立体飞船、敌机、光影、特效与过场镜头，**不参与规则判定**；作战镜头以稳定、清晰为主。
- **关卡数据化：** 独立 JSON 配置决定敌机编队、波次、速度、射击频率和胜负条件；数据须先校验。游戏核心独立于 React/Three.js，可用固定种子无界面测试。
- 无登录/后端/云存档，不从外部 CDN 加载必需运行时代码，使用原创素材；玩家界面简体中文。

## 运行与部署

- 默认开发/PR 合并分支：`dev`（不改 `main`）。
- [在线 Pages](https://siliconyc.github.io/React-SpaceInvader/)：GitHub Pages 的 **Source = GitHub Actions**，合并 `dev` 后自动构建发布。地址基础路径 `/React-SpaceInvader/`。
- Node.js 22。当前本地命令：`npm install`、`npm run dev`、`npm run verify`（类型检查、Vite 生产构建、静态资源冒烟）。
- [Issue #3](https://github.com/SiliconYC/React-SpaceInvader/issues/3) 须补齐锁文件和 `npm ci` 可复现安装；此项尚未实现，不得声称依赖已经完全锁定。
- Pages 成功发布不等同实际浏览器可玩验收；各个功能 Issue 应提供实际交互与逻辑测试证据。

## 开发规范与文档

- [AGENTS.md](AGENTS.md)：AI 开发规则、2.5D 硬约束、独立分支与 PR、CI 精简和验收。
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：二维逻辑与三维渲染隔离、数据驱动关卡、测试及发布。
- [docs/ROADMAP.md](docs/ROADMAP.md)：P1 七项 Issue、依赖顺序、最小完整可玩闭环。

每个 Issue 从 `dev` 建立独立短期分支，细粒度 Commit/Push，独立 PR 合并后部署 GitHub Pages，再验收增量。**当前仅更新规划文档，不实现游戏功能。**
