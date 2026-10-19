# #101 第二次返工：真实画面与测量

旧版为 `dev@1d8426e9726dc06621ae8da42badfaf4fb2cb304` 的独立归档服务，新版为同一 PR 提交的源文件/生产包。全部截图来自 Chromium WebGL；没有替换画布、伪造关卡、隐藏 HUD 或后期绘制模型。

## 同条件正常战斗

默认第一关、种子 **20261017**、权威逻辑 **tick=15**，普通正交镜头。手机视口真实启用触屏模拟，DPR1；完整战场不裁切。采集脚本使用浏览器虚拟时钟使两版停在同一状态，双方坐标/分数/生命/敌人数/投影跨度逐字段核对相同；完整记录在各自 `capture.json`。

| 视口 | #101 原版 | 本次重雕 |
| --- | --- | --- |
| 1920×1080 | [旧版](before/battle-1920x1080.png) | [新版](after/battle-1920x1080.png) |
| 1440×900 | [旧版](before/battle-1440x900.png) | [新版](after/battle-1440x900.png) |
| 844×390 触屏横向 | [旧版](before/battle-844x390.png) | [新版](after/battle-844x390.png) |
| 390×844 触屏竖向 | [旧版](before/battle-390x844.png) | [新版](after/battle-390x844.png) |

以实际第一架 Scout 网格（包含 tick=15 的姿态）精确包围盒和截图相机投影计算，旧/新 CSS 翼展分别为：1920 屏 **79.84/78.82px**，1440 屏 **66.54/65.69px**，手机横向 **22.59/22.30px**，竖向 **20.02/19.76px**。不是通过放大模型或改变世界比例制造差别；手机竖向的细节可辨识度仍然受像素尺寸限制。

## 真实模型近景（不能代替上面的战斗图）

| 单位 | #101 原版 | 本次重雕 |
| --- | --- | --- |
| 玩家 | [旧版](before/closeup-player.png) | [新版](after/closeup-player.png) |
| Scout | [旧版](before/closeup-scout.png) | [新版](after/closeup-scout.png) |
| Raider | [旧版](before/closeup-raider.png) | [新版](after/closeup-raider.png) |
| Guardian | [旧版](before/closeup-guardian.png) | [新版](after/closeup-guardian.png) |

这些是游戏自己的 `?shipPreview=<kind>&shipAngle=tilt` 诊断镜头，使用同一批实时网格与材质。Raider 最终修正了炮口在倾角叠加下被自身壳体遮住的几何问题，并重新烘焙 AO；炮口现在有连接壳体的立体唇口和凹入内膛。

## 连续实战与桌面 GPU

- Apple M1 / Chrome Metal 的实时完整录屏：[旧版](before-live/combat.webm)、[新版](after-live/combat.webm)。未调速或补帧，包含移动、换向、连射、击毁和暂停。
- [旧版硬件数据](before-live/performance.json)、[新版硬件数据](after-live/performance.json)。1920×1080 DPR1，在开局 24 架敌机、没有玩家射击的三秒 RAF 采样中，均约 **60.0 FPS**，p95 **16.8ms**。报告的实际驱动是 `ANGLE Metal Renderer: Apple M1`。这是短时桌面硬件采样，未冒充手机或长期测量。
- 固定战斗图的 draw calls：**49→29**；GPU 几何对象数 **83→42**；纹理对象 **1→2**。对象数减少不等于总显存按同一比例减少；新反射 atlas GPU RGBA8 约 3 MiB。
- 软件 Chromium 数据另存 [旧版](before-live/software-performance.json)、[新版](after-live/software-performance.json)，对应 [旧软件录屏](before-live/combat-swiftshader.webm)、[新软件录屏](after-live/combat-swiftshader.webm)。该次共享 CPU 软件光栅采样约 **4.14→2.94 FPS**，p95 **516.7→666.6ms**，没有隐瞒软件渲染退步，也没有以此冒充真实硬件。主战斗资源和真实桌面采样须结合阅读，实体手机按 #70 继续待验。

采集源：`scripts/capture-toy-rebuild.mjs`；视频/测量源：`scripts/record-toy-rebuild.mjs`（`TOY_GPU=metal` 为本地 Chrome Metal，默认 SwiftShader）。单独的 [桌面 GPU 探测](desktop-gpu.json) 与 [对应战斗帧](desktop-gpu.png) 也已归档。

## 技术验收与人工结论

- `npm run verify`：最终源码 90/90 单测、类型/生产构建/子路径/难度与资产审计通过。
- 最终针对性浏览器 10/10 通过，包含反射恢复前后逐字节截图一致、加载失败兜底、主题、D2 开场/胜败/换波、构图、光照、边界输入；完整 83 项以本 PR 的 CI 与合并后 Pages 工作流为准。
- Apple M1/Metal 本地全套初跑82/83通过，剩余一项是旧测试硬编码4173端口，将4200服务误识为外部资源；已改为严格核对配置的baseURL含子路径，补跑验证。
- 最初运行时 PMREM 和 Physical 变体造成的首屏初始化失败有记录；已换为离线可重新上传的 CubeUV 图片和统一 Standard PBR。未放宽 WebGL readiness 超时。
- 本文不代表用户认可美术。#101、#69、#70、#71 保持开放；原始第二张概念图与实体手机验收仍未补齐。
