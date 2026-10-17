# P4/B2 银河与带环行星 · 素材档案与验收（#77）

## 原创来源和可再现文件
- 本次两套星云的绘制源为 `scripts/art/generate_p4_galaxy.py`：带方向性的多层云刷、弯曲亮丝、交错暗尘带、稀疏独立星点，不是几层纯色渐变或单张随机噪声。这是**原创确定性算法绘画**，不是扩散模型的成果；不冒称生成式图像模型产物，也无外部贴图/版权依赖。
- 可编辑原图：`public/art/backgrounds/galaxy-p4-veil-source.png` 与 `galaxy-p4-arc-source.png`。
- Three.js 实际加载：同目录下 `galaxy-p4-veil.webp`（默认）与 `galaxy-p4-arc.webp`（替代方案）。
- 这些 PNG/WebP 已由一次性离线图像作业**真实生成并提交到 Git**。不在浏览器端计算、依赖外链或将示意图作为运行截图。P3 旧背景 `galaxy-v2.webp` 保留用于真浏览器同视口对照。
- 浏览器测试接口：`?galaxy=legacy`（旧版）、`?galaxy=veil`（默认）、`?galaxy=arc`（第二方案），`?planetInspect=side`（倾斜验证）。

## 实时 Three.js 行星
- `src/render/RingedPlanet.ts`：真实球体、按纬度和经度变化的原生顶点色、细分环纹、独立外薄环。
- 真实倾斜的 `RingGeometry` 由 WebGL 深度缓冲与球体处理前后遮挡，整组可旋转，非烘焙静态画面。
- 与背景协调的柔和表面色、固定主画面边缘的天体位置；全程独立于二维碰撞及敌机数据。

## 验收
- `tests/p4-b2.browser.spec.ts`：1920×1080 与 390×844 下旧版和两种新背景正常游戏等参数真 Chromium 截图，天体三维倾角、子弹实时战斗与 Draw Calls/资源 JSON。
- 核实文件大小/真实解码、同源纹理 URL、加载失败纯色回退，释放资源；手机 GPU 必须另由 #70 实机评估，CI 软件 GPU 不等于手机验收。
- **审美批准依旧未获得**，不能把技术成功或本文件当成 #69 的人工美术验收。
