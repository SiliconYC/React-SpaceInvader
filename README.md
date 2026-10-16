# 侵略者仓库（React-SpaceInvader）

基于 **React + TypeScript + Three.js** 的 3D《太空侵略者》项目。目标是在浏览器中运行完整游戏，并通过外部关卡数据驱动敌人编队、波次、难度和胜负条件。

> **当前阶段：工程初始化。** 首页仅是 React 与 Three.js / WebGL 联通测试，不是游戏，更没有实现玩法或关卡。

## 运行与发布

- 开发分支、PR 合并目标、Pages 部署来源：`dev`。
- 在线地址：<https://siliconyc.github.io/React-SpaceInvader/> （只有 Actions 首次部署成功后才可用）。
- Pages 设置：**Source = GitHub Actions**，不是 `gh-pages` 分支。
- 每次合并到 `dev` 自动构建和部署；PR 只执行验证，不发布。
- Vite 项目页基础路径固定为 `/React-SpaceInvader/`，所有页面资源必须兼容此子路径。

本地要求 Node.js 22。执行 `npm install`、`npm run dev` 启动开发服务器；执行 `npm run verify` 完成类型检查、生产构建与静态资源冒烟检查。首轮先锁定直接依赖版本；后续开发须补交 npm 锁文件并改为 `npm ci`，以锁定完整依赖树。

## 技术与结构

- React 负责界面与生命周期；Three.js 负责三维渲染，不把游戏规则写进 React 组件。
- Vite 负责开发与构建；所有代码与依赖打包为站点同源静态资源，不从外部 CDN 载入运行时。
- 游戏规则、输入、碰撞、计分和关卡读取以后拆分为可独立测试的模块。
- 关卡采用带版本号的数据文件，目录规划为 `public/levels/`；数据经校验后由游戏核心读取，界面与渲染器只消费结果。详见 [架构及关卡规范](docs/ARCHITECTURE.md)。
- 不要求后端、玩家账号或服务器数据库；GitHub Pages 仅提供静态文件。

## 开发约定

先阅读 [AGENTS.md](AGENTS.md)。原则上每项 Issue 从 `dev` 建立临时分支、细粒度提交、必要测试通过后经 PR 合并到 `dev`。每次合并都应能访问 Pages 检查真实画面；严禁把仅通过构建视为已经通过浏览器验收。
