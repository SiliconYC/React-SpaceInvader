# P4 A 组最终美术样板审查材料（#75 / #69）

## 状态与门槛

- 技术实施：提交、CI、线上浏览器验证应以对应 PR 和发布工作流最终结果为准；不得提前填“全部通过”。
- **最终美术状态：待用户评价／未批准。**
- **P4 B/C/D 组不得启动。** 本材料、截图、性能数据均不能代替用户人工认可，也不能自动关闭 #69。
- 用户选择的“第二张概念图原始文件”**并不在仓库中**，已有 `docs/art/reference/p3-lowpoly-q-concept.svg` 是后绘参考，禁止说是原图。

## 真模型与来源

| 单位 | 源文件及实际浏览器生成方式 | 特征 |
| --- | --- | --- |
| 玩家 | `src/render/P4PlayerGeometry.ts` + `src/render/ShipModels.ts` | 连续放样机身、真实实体机翼、两个发动机舱和凸起独立驾驶舱 |
| Scout | `src/render/P4PlayerGeometry.ts` + `src/render/ShipModels.ts` | 较薄翼型、独眼、柔和护甲、实例化 24/40 架 |
| 场景 | `src/render/CombatProjection.ts` + `src/render/P3Palette.ts` | Stage/Breathing 实际相机，Studio/Soft 实际四光源 A/B |

素材均为 Git 中可编辑的原创代码生成，无第三方模型依赖、无外部贴图链接。保留既有银河 WebP 和 P3 背景，并未重做 #76～#83。

## 标准化三栏对照

1. **P3：** [P3 最终真实 Pages Chromium 截图附件，工作流 39021612762](https://github.com/SiliconYC/React-SpaceInvader/actions/runs/39021612762)，SHA `e2c35a0a2fd8863f23babadfa8eaa6c0c4afd566`。
2. **P4 A1～A4：** 每个 P4 PR / 最后 Pages 发布 workflow 的 `p4-a1-*`、`p4-a2-*`、`p4-a3-*`、`p4-a4-*` 原生 WebGL 截图、同名 JSON 指标附件。截图由 Playwright 真实 Chromium 打开游戏页面、正常状态和独立模型三维近景获得，未合成。
3. **概念参考：** 用户选中的原始概念图仍待取得，不能以仓库自绘 SVG 冒充，也不能由 CI 自动批准相似度。

## 取舍与已知缺口

- 无辉光后处理，无全屏 AO，无额外 render target；依靠大面积主光与柔和补光表达光泽。Studio 生产候选，Soft 为真实可切换对照（`?light=soft`），结论需人工比较。
- GPU 资源数、调用次数、WebGL 软件帧率可被浏览器量化；**真实手机 GPU、用户实际手感和审美质量未证明**。
- 三类机型只更新了 Player 和 Scout，Raider/Guardian 仍是 P3 资产。整体游戏不应被宣称全部美术完成。
- P3/ P4 对照必须使用相同视口、关卡、种子与战斗状态，近景不能替代常规对局。
