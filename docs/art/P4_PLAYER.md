# P4/A2 玩家原创建模（#73）

**资产源与运行模型：** `src/render/P4PlayerGeometry.ts`（可编辑封闭机身放样、多截面带厚度机翼）和 `src/render/ShipModels.ts`（Three.js 正式材质与组装）；全部运行时几何由本地源码确定性生成，无外链/预渲染贴图/GLB。

玩家机主要结构是连续 20 边截面的饱满机身、翼根至翼尖逐级收弦的实体机翼、两个轴向发动机舱、可辨识尾喷环与一体式凸起驾驶舱。翼型与机身是新写的 `BufferGeometry`，并非主要靠 BoxGeometry/SphereGeometry/ExtrudeGeometry 拼装；保留一件结构性挤出尾片及球面驾驶舱部件。体型宽约 2.34 世界单位，保持旧的 2.5 宽逻辑命中盒与固定 XY pivot，驾驶舱厚度只供视觉。

**所有权和版权：** 仓库原创参数化三维素材，没有使用第三方模型或字体/图片。HTML Canvas 只由 Three.js WebGL 实时绘制。

**机器验收：** `tests/models.test.ts` 检验连续曲面几何、双翼、双喷、厚度、命中盒；`tests/p4-player.browser.spec.ts` 保存 P4 真 WebGL 正常战斗、前视、倾斜、竖屏与移动连续帧；旧 P3 模型和交互测试必须通过。

**待人工审查：** 轮廓、配色、高光、商业精致度均未得到用户认可，不能用 CI 通过替代。
