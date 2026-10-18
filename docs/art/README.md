# P3 美术参考原图与来源

## 真实样张

- 文件：[P3 低多边形 Q 版概念图（SVG，1600 × 900）](reference/p3-lowpoly-q-concept.svg)
- 状态：**本轮全新制作并提交的原创矢量参考原图**；由 AI Agent 于 2026-10-17 用手工参数化 SVG 图元、渐层与几何面片合成；不使用外部受版权保护素材。
- 许可：项目所有者可在本项目中修改、复制、转换及衍生；无第三方模型或贴图依赖。本说明不构成对商标或其他第三方权利的保证。
- 可编辑源：SVG 文件本身就是可编辑原稿，含飞船/敌机/天体/陨石的独立矢量绘图组；不是生成器随机链接，也不是在聊天展示后遗失的图片。
- 与用户先前选择的第二张概念图关系：**采用其已文字确定的 Q 版低多边形、深蓝太空、玩具材质与三类差异化敌机方向重新创作**；原始图片没有被获取或归档，绝不可称为已获取的用户原图。
- 用途：只供美术方向和资产细节参照。**不属于运行时游戏素材，不是 Three.js 画面截图，更不是已经完成的模型。** 后续 B/C 组必须根据此图分别制作真实 Three.js 网格和背景，并保留三栏对照截图。
- 为什么是 SVG 而非 PNG：此轮可追溯原创源直接为无损可编辑矢量图；概念参考无需强制栅格化。若后续网页确实使用栅格背景，应将原始 PNG 与优化 WebP 一并入库并登记，不能把单个 SVG 概念原图偷换成网页模型。

## 后续资产三栏对照（每个实际资产由对应 Issue 填写）

| 概念参考与造型要求 | Git 中真实源文件与运行时文件 | Chromium WebGL 实机截图和差异 |
| --- | --- | --- |
| 玩家／Scout／Raider／Guardian：参考图中不同轮廓 | B 组 #38、#39 待生产 | B 组 #38～#41 待实测 |
| 银河、环形天体、岩石：参考图仅供构图 | C 组 #42～#45 待生产 | C 组 #42～#45 待实测 |
| A 组镜头／层级 | `src/render/CombatProjection.ts` / `CombatSceneLayers.ts` | #35/#36 的 `p3-*.png` 浏览器工件，真正游戏截图 |

每个后续 PR 要完整填写三栏，不得把第一栏中的概念画当成第二栏模型或第三栏运行截图。

## ReactMono 美术升级首关银河（2026-10-18）

- 原始生成图：[galaxy-reactmono-redesign-source.png](sources/galaxy-reactmono-redesign-source.png)，1672 × 941 RGB PNG，约 1.8 MB。
- 页面运行图：[galaxy-reactmono-veil.webp](../../public/art/backgrounds/galaxy-reactmono-veil.webp)，1600 × 900，约 33 KB；由原图中心裁切/缩放、适度降低亮度和饱和度，再以 WebP quality 78 导出。生成源未修改。
- 来源：OpenAI 内置 ImageGen，2026-10-18，为本项目原创生成。画面只包含低对比星云、星尘和留白；不含飞船、敌人、行星、岩石、HUD 或文字。项目可在本项目中修改、复制和衍生；不依赖第三方图像或运行时外链。
- 提示词重点：16:9 深海军蓝背景；中心 70% 安静、暗且低对比；柔和蓝紫云带沿上方和外围；右上仅留轻微暖色氛围以衬托独立的 3D 行星；星点数量克制；禁止任何游戏主体、文字、水印或高亮焦点。
- 运行接入：`nebula-blue` 首关主题通过现有 `visualTheme` 数据读取该同源资源；`violet-drift` 暂时沿用原银河。关卡 v1、核心规则和 Three.js 行星/飞船网格没有变化。
- 处理命令：`magick galaxy-reactmono-redesign-source.png -resize '1600x900^' -gravity center -extent 1600x900 -brightness-contrast -10x-8 -modulate 100,82,100 -strip -quality 78 galaxy-reactmono-veil.webp`。
- 浏览器对照：`evidence/reactmono-redesign/before/` 与 `evidence/reactmono-redesign/after/` 保存固定桌面、手机视口下的实际 WebGL 战斗截图；自动化渲染截图不代表用户人工美术批准，也不代表实体手机 GPU 测试。
