# P3 网页美术资产目录

此目录登记游戏真正加载的资源；概念样张不是运行时贴图。

| 路径 | 类型/授权 | 网页用途 | 文件大小 | 可编辑来源 |
| --- | --- | --- | --- | --- |
| `backgrounds/galaxy-v2.webp` | 原创程序生成、项目可编辑 | Three.js `GalaxyBackdrop` 同源纹理 | 6,536 B / 1600×900 | `scripts/art/generate_galaxy.py`；原始 `backgrounds/galaxy-v2-source.png` 134,363 B |

将来登记：`backgrounds/`（银河、星云 WebP/PNG）、`models/`（必要时 GLB/GLTF）、`effects/`（确有必要的效果贴图）。空目录不在 Git 中伪造。

入库流程：先核实来源与版权；将可编辑原图、生成参数或几何源码提交 Git，再将真正用于网页的精简文件放到本目录，并补充实际大小、创建者、生成工具、许可、hash 和加载调用处。全部通过 `import.meta.env.BASE_URL` 构造资源 URL，禁用临时图片链接和外部 CDN。未来 PNG 源图和 WebP 游戏优化版在确实使用栅格图片时成对提交。

对照概念图位于 [`docs/art/reference/p3-lowpoly-q-concept.svg`](../../docs/art/reference/p3-lowpoly-q-concept.svg)，**不是网页运行时素材**。后续 #38～#45 必须提交各自真实模型/贴图和实测截图。

## #42 银河贴图来源与迭代

2026-10-17，使用开源 NumPy 与 Pillow，以确定性种子独立绘制。没有使用外部第三方图像或任何嵌入的舰船、行星、岩石、HUD。生成方式：`python scripts/art/generate_galaxy.py --variant 2 --output public/art/backgrounds`；源码脚本可完整重建**真正入库的 PNG 与 WebP**。比较过 v1（低紫云对比）与 v2（两侧稍显著的蓝紫星云），保留 v2：中心交战区域仍抑制星光，留出激光、敌机和信息的高对比度。目标源画尺寸 1600×900，运行时 WebP 6.5KB 远低于 300KB。浏览器按宽高比执行 cover 裁切，纵屏优先保护中央交战区域。背景下载失败时仅保留深蓝色替代面，不改变玩法。

确认：真正 binary 文件与源代码均为 GitHub 仓库文件，不是仅在聊天展示的图片或依赖 CDN 的链接。一次性图片生成工作流用于提交二进制图片，完成后从长期 CI 中移除，不加入游戏运行依赖。

## #101 重雕（2026-10-19）

- `studio-cubeuv.png`：预滤波柔光棚 CubeUV 反射图，768×1024，165,989 B。由 `scripts/bake-studio-environment.mjs` 使用已锁定 Three.js 0.180.0 内置 MIT 许可 `RoomEnvironment` 离线生成；真实生成元数据见 `docs/art/studio-cubeuv.json`。PNG 使用 sRGB 编码、线性色值缩小 64 倍，运行时 `StudioEnvironment.ts` 还原强度；没有网络 HDR、运行时 PMREM 或外部 CDN。脚本为可编辑源，PNG 即网页实际加载的优化输出。
- `backgrounds/toy-orbit.svg`：保留 #101 原创可编辑源，降低雾层亮度，移除弧线与十字星；SVG 即运行文件，无另造源图。四种飞船全部由 `src/render/ShipModels.ts` 实时生成；`ShipOcclusion.ts` 是 Blender 5.2.2 按真实网格射线烘焙的顶点接触遮蔽数据，不是模型贴图或截图。生成命令与参数见返工文档。
