import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// 仅供工程初始化检查：不包含游戏规则、敌机或关卡。
export default function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<'ready' | 'error' | 'loading'>('loading');

  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setWebgl('error');
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x080e1d, 1);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 0, 5.5);
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const geometry = new THREE.IcosahedronGeometry(1.45, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4ab7ef,
      wireframe: true,
      roughness: 0.5,
    });
    const probe = new THREE.Mesh(geometry, material);
    probe.rotation.set(0.2, 0.4, 0.15);
    scene.add(probe);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };

    window.addEventListener('resize', resize);
    resize();
    setWebgl('ready');

    return () => {
      window.removeEventListener('resize', resize);
      scene.remove(probe);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main className="page">
      <header className="top">
        <div className="eyebrow">REACT · THREE.JS · WEBGL</div>
        <h1>侵略者</h1>
        <p>3D 太空侵略者 · 基础环境验证</p>
      </header>
      <div className="viewport" ref={viewportRef} aria-label="Three.js 三维联通测试画面" role="img" />
      <div className="footer">
        <span className={webgl === 'error' ? 'error' : 'ok'}>
          {webgl === 'ready' ? '● Three.js / WebGL 渲染正常' : webgl === 'error' ? '● 当前浏览器无法启动 WebGL' : '● 正在检查 WebGL'}
        </span>
        <span>仅用于验证部署 · 游戏内容尚未开发</span>
      </div>
    </main>
  );
}
