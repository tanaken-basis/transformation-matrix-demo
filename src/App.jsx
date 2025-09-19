import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MathJaxContext, MathJax } from "better-react-mathjax";

/**
 * Transformation Matrix Demo
 * - 3D: three.js + OrbitControls
 * - Math: show 4x4 matrices via MathJax v3
 * - Operations: [World, Local]-space translation & rotation ([pre, post]-multiply)
 * - Object state: single 4x4 matrix T (orientation + position)
 *
 * Controls:
 *  - Change x, y, z, angle, axis (X/Y/Z)
 *  - Apply Translation (World, Local), Apply Rotation (World, Local)
 *  - Reset Object, Reset View
 */

/**
 * セットアップ:
  # Vite + React プロジェクト作成
  npm create vite transformation-matrix-demo -- --template react
  cd transformation-matrix-demo
  # 依存関係インストール
  npm install
  npm install three better-react-mathjax
  npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer
  # ファイル
  `./src/App.jsx` と `./src/index.css` を置き換える
  `./index.html` と `./package.json` と `README.md `を置き換える
  `./tailwind.config.js` と `./postcss.config.js` と `./favicon.ico` を追加
  # 開発サーバ起動
  npm run dev
**/

// ---- MathJax ----
const mjConfig = {
  tex: {
    packages: { "[+]": ["ams"] }, // bmatrix/pmatrix 等
    inlineMath: [["$", "$"], ["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"], ["$$", "$$"]],
  },
};

// ---- i18n translations ----
const translations = {
  en: {
    title: "Transformation Matrix Demo",
    hud_orbit: "3D: drag = orbit, wheel = zoom, right-drag = pan",
    btn_resetView: "Reset View",
    btn_resetObject: "Reset Object",
    intro_p1: "The object's state is a 4×4 matrix T (top-left 3×3 is rotation, last column is position).",
    intro_pre: "World-space ops are applied as T' = M T (pre-multiply) and local-space ops are applied as T' = T M (post-multiply).",
    section_current: "Current 4×4 Matrix (World)",
    section_transTitle: "Translation Matrix",
    section_transNote: "※ Translation uses ",
    section_rotTitle: "Rotation Matrix",
    section_rotNote: "※ Rotation uses ",
    label_tx: "x",
    label_ty: "y",
    label_tz: "z",
    label_angle: "angle (deg)",
    label_axis: "axis",
    btn_applyTrans: "Apply Translation",
    btn_applyRot: "Apply Rotation",
    footer_note: "Note: THREE.Matrix4 is column-major. The display uses rows; columns map to [right, up, forward, position].",
    ui_language: "Language ",
    presision: "Precision",
  },
  ja: {
    title: "変換行列のデモ",
    hud_orbit: "3D: ドラッグ=回転, ホイール=ズーム, 右ドラッグ=パン",
    btn_resetView: "視点リセット",
    btn_resetObject: "オブジェクトリセット",
    intro_p1: "物体の状態は 4×4 行列 T（上3×3が回転、最後の列が位置）で保持しています。",
    intro_pre: "World座標での操作は T' = M T（変換行列Mの前からの掛け算）で適用され、Local座標での操作は T' = T M（変換行列Mの後ろからの掛け算）で適用されます。",
    section_current: "現在の 4×4 行列（World）",
    section_transTitle: "並進行列",
    section_transNote: "※ 平行移動は ",
    section_rotTitle: "回転行列",
    section_rotNote: "※ 回転は ",
    label_tx: "x",
    label_ty: "y",
    label_tz: "z",
    label_angle: "角度（度）",
    label_axis: "軸",
    btn_applyTrans: "並進を適用",
    btn_applyRot: "回転を適用",
    footer_note: "表記について：THREE.Matrix4 は列優先（column-major）です。上の行列表示は行ごとに並べ、列は [right, up, forward, position] に対応します。",
    ui_language: "Language ",
    presision: "桁数",
  }
};

// ---- Matrix → LaTeX (with precision & color) ----
function mat4ToLatex(m, label = "T", precision) {
  // THREE.Matrix4 stores column-major: [n11,n21,n31,n41, n12,n22,...]
  const e = m.elements;
  const fmt = (x, color) => `\\color{${color}}{${Number(x).toFixed(precision)}}`;
  const colors = [
    label === "M_{trans}" ? "white" : 'red',
    label === "M_{trans}" ? "white" : 'yellowgreen',
    label === "M_{trans}" ? "white" : 'cyan',
    label === "M_{rot}" ? "white" : 'orange',
    label === "M_{rot}" ? "white" : 'plum',
    label === "M_{rot}" ? "white" : 'pink',
    'white'
  ];
  const rows = [
    `${fmt(e[0], colors[0])} & ${fmt(e[4], colors[1])} & ${fmt(e[8] , colors[2])} & ${fmt(e[12], colors[3])}`,
    `${fmt(e[1], colors[0])} & ${fmt(e[5], colors[1])} & ${fmt(e[9] , colors[2])} & ${fmt(e[13], colors[4])}`,
    `${fmt(e[2], colors[0])} & ${fmt(e[6], colors[1])} & ${fmt(e[10], colors[2])} & ${fmt(e[14], colors[5])}`,
    `${fmt(e[3], colors[6])} & ${fmt(e[7], colors[6])} & ${fmt(e[11], colors[6])} & ${fmt(e[15], colors[6])}`,
  ].join(" \\\\\n");
  return `\\[ \\small ${label} = \\begin{bmatrix} ${rows} \\end{bmatrix} \\]`;
}

function MatrixBlock({ matrix, label, precision }) {
  const tex = useMemo(() => mat4ToLatex(matrix, label, precision), [matrix, label, precision]);
  return (
    <MathJax dynamic hideUntilTypeset="first">
      {tex}
    </MathJax>
  );
}


// ---- Main App ----
export default function TransformationMatrixDemo() {
  const [lang, setLang] = useState("ja");
  const t = (k) => (translations[lang] && translations[lang][k]) || k;

  // Transform mode: 'world' (pre-multiply) or 'local' (post-multiply)
  const [mode, setMode] = useState('world');
  const isWorld = mode === 'world';
  
  // UI: matrix precision
  const [precision, setPrecision] = useState(2);

  // THREE scene setup
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);

  // Transformable object & its 4x4 matrix T
  const objectRef = useRef(null);
  const TRef = useRef(new THREE.Matrix4().identity());
  const [version, setVersion] = useState(0); // force React rerender when T changes

  // World transform inputs
  const [tx, setTx] = useState(0.5);
  const [ty, setTy] = useState(0.0);
  const [tz, setTz] = useState(0.0);
  const [angleDeg, setAngleDeg] = useState(15);
  const [axis, setAxis] = useState("Y"); // X, Y, Z

  // Build world transform matrices from inputs
  const M_wTrans = useMemo(() => {
    const m = new THREE.Matrix4();
    m.makeTranslation(Number(tx) || 0, Number(ty) || 0, Number(tz) || 0);
    return m;
  }, [tx, ty, tz]);

  const M_wRot = useMemo(() => {
    const m = new THREE.Matrix4();
    const a = (Number(angleDeg) || 0) * Math.PI / 180;
    if (axis === "X") m.makeRotationX(a);
    else if (axis === "Y") m.makeRotationY(a);
    else m.makeRotationZ(a);
    return m;
  }, [angleDeg, axis]);

  // Initialize 3D once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x0b1020, 1);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    // make canvas fill container
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(6, 5, 8);
    cameraRef.current = camera;

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    // Ground: grid + plane
    const grid = new THREE.GridHelper(40, 40, 0x999999, 0x444444);
    grid.position.y = 0;
    scene.add(grid);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
        color: 0x112233,
        metalness: 0.1,
        roughness: 0.9,
        side: THREE.DoubleSide,
        transparent: true,  // 透過を有効化
        opacity: 0.5        // 半透明に設定（0=完全透明, 1=不透明）
      })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.001; // avoid z-fighting
    scene.add(plane);
    
    // Fixed reference objects
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 2.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x777777 })
    );
    pillar.position.set(5, 1.25, -2.5);
    scene.add(pillar);

    const cone_A = new THREE.Mesh(
      new THREE.ConeGeometry(2, 2, 4), // 半径=1, 高さ=2, 底面の分割数=4
      new THREE.MeshStandardMaterial({ color: 0xffcc00 })
    );
    cone_A.position.set(-5, 1, -3);
    scene.add(cone_A);

    const cone_B = new THREE.Mesh(
      new THREE.ConeGeometry(1, 1, 4),
      new THREE.MeshStandardMaterial({ color: 0xffcc00 })
    );
    cone_B.position.set(-3, 0.5, -6);
    scene.add(cone_B);

    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.2, 16, 100),
      new THREE.MeshStandardMaterial({ color: 0xeeccee })
    );
    torus.rotation.x = -Math.PI / 2;
    torus.position.set(-3.5, 0.2, 3);
    scene.add(torus);

    // 太い軸
    function makeThickAxes(length = 1.5, radius = 0.04) {
      const group = new THREE.Group();

      // material factory with slight emissive for visibility
      const mkMat = (hex) => new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 0.25,
        roughness: 0.6,
        metalness: 0.1,
      });

      const len = length;
      const cylGeo = new THREE.CylinderGeometry(radius, radius, len, 24);
      const coneH = Math.max(0.15 * len, 0.18);
      const coneGeo = new THREE.ConeGeometry(radius * 2, coneH, 24);

      // Y (up, green)
      const matY = mkMat(0x00ff00);
      const yCyl = new THREE.Mesh(cylGeo, matY);
      yCyl.position.y = len / 2;
      const yCone = new THREE.Mesh(coneGeo, matY);
      yCone.position.y = len + coneH / 2;
      group.add(yCyl, yCone);

      // X (right, red)
      const matX = mkMat(0xff0000);
      const xCyl = new THREE.Mesh(cylGeo, matX);
      xCyl.rotation.z = -Math.PI / 2;
      xCyl.position.x = len / 2;
      const xCone = new THREE.Mesh(coneGeo, matX);
      xCone.rotation.z = -Math.PI / 2;
      xCone.position.x = len + coneH / 2;
      group.add(xCyl, xCone);

      // Z (forward, cyan)
      const matZ = mkMat(0x00ffff);
      const zCyl = new THREE.Mesh(cylGeo, matZ);
      zCyl.rotation.x = Math.PI / 2;
      zCyl.position.z = len / 2;
      const zCone = new THREE.Mesh(coneGeo, matZ);
      zCone.rotation.x = Math.PI / 2;
      zCone.position.z = len + coneH / 2;
      group.add(zCyl, zCone);

      return group;
    }

    // World axes
    // const worldAxes = new THREE.AxesHelper(2.0);
    // scene.add(worldAxes);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 32, 16), // 半径=1, 横32, 縦16 分割
      new THREE.MeshStandardMaterial({ color: 0x777777 })
    );
    sphere.position.set(0, 0, 0);
    scene.add(sphere);
    const worldAxes = makeThickAxes(0.5, 0.03);
    sphere.add(worldAxes);

    // Transformable object (box + its local axes)
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x3ba7ff, metalness: 0.2, roughness: 0.6 })
    );
    box.matrixAutoUpdate = false; // We will assign full matrix T
    scene.add(box);
    objectRef.current = box;
    const localAxes = makeThickAxes(1.8, 0.05);
    box.add(localAxes);
    
    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.5, 0);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // handle resize + container observer
    const onResize = () => {
      if (!mount || !rendererRef.current || !cameraRef.current) return;
      const rect = mount.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      rendererRef.current.setSize(w, h, false);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    // animation loop
    let rafId = 0;
    const renderLoop = () => {
      rafId = requestAnimationFrame(renderLoop);
      controls.update();
      renderer.render(scene, camera);
    };
    renderLoop();

    // initial sync of object matrix T
    applyMatrixToObject();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const applyMatrixToObject = () => {
    if (!objectRef.current) return;
    objectRef.current.matrix.copy(TRef.current);
    // ensure normal matrix etc are recomputed by three
    objectRef.current.matrixWorldNeedsUpdate = true;
    setVersion((v) => v + 1); // trigger UI & MathJax update
  };

  // -- World operations --
  const applyTranslation = () => {
    const M = new THREE.Matrix4().copy(M_wTrans);
        if (isWorld) {
          // WORLD: T' = M · T (pre)
          TRef.current.premultiply(M);
        } else {
          // LOCAL: T' = T · M (post)
          TRef.current.multiply(M);
        }
        applyMatrixToObject();
  };

  const applyRotation = () => {
    const M = new THREE.Matrix4().copy(M_wRot);
        if (isWorld) {
          // WORLD: T' = M · T (pre)
          TRef.current.premultiply(M);
        } else {
          // LOCAL: T' = T · M (post)
          TRef.current.multiply(M);
        }
        applyMatrixToObject();
  };

  const resetObject = () => {
    TRef.current.identity();
    applyMatrixToObject();
  };

  const resetView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(6, 5, 8);
    controlsRef.current.target.set(0, 0.5, 0);
    controlsRef.current.update();
  };

  // UI matrix proxies for MathJax: clone to freeze values for this render
  const T_forUI = useMemo(() => TRef.current.clone(), [version]);

  return (
    <div
      className="w-full bg-slate-900 text-slate-100 grid grid-cols-1 lg:grid-cols-2"
      style={{ height: '100dvh', minHeight: '100vh' }}
    >
      {/* 3D viewport */}
      <div
        className="relative"
        ref={mountRef}
        style={{ width: '100%', height: '70dvh', minHeight: 400 }}
      >
        <div className="absolute left-3 top-3 text-xs bg-slate-800/70 rounded-xl px-2 py-1">
          {t('hud_orbit')}
        </div>
        <div className="absolute right-3 top-3 flex gap-2">
          <button onClick={resetView} className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95">{t('btn_resetView')}</button>
          <button onClick={resetObject} className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95">{t('btn_resetObject')}</button>
        </div>
      </div>

      {/* Control panel */}
      <MathJaxContext version={3} config={mjConfig}>
        <div className="p-4 lg:p-6 overflow-y-auto space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <div className="flex items-center gap-2 text-sm">
              <span>{t('ui_language')}</span>
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg px-2 py-1 bg-slate-900 border border-slate-700">
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            {t('intro_p1')}<br/>
            {t('intro_pre')}
          </p>

          <section className="space-y-3">
            <div className="rounded-2xl p-4 bg-slate-800">
              <h3 className="font-semibold">{t('section_current')}</h3>
              <MatrixBlock matrix={T_forUI} label="T" precision={precision} />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Translation */}
            <div className="rounded-2xl p-4 bg-slate-800 space-y-3">
              <h3 className="font-semibold">{t('section_transTitle')}{isWorld ? " (World)" : " (Local)"}</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <label className="space-y-1">
                  <div>{t('label_tx')}</div>
                  <input value={tx} onChange={(e) => setTx(e.target.value)} type="number" step="0.1" className="w-full rounded-lg px-2 py-1 bg-slate-900 border border-slate-700" />
                </label>
                <label className="space-y-1">
                  <div>{t('label_ty')}</div>
                  <input value={ty} onChange={(e) => setTy(e.target.value)} type="number" step="0.1" className="w-full rounded-lg px-2 py-1 bg-slate-900 border border-slate-700" />
                </label>
                <label className="space-y-1">
                  <div>{t('label_tz')}</div>
                  <input value={tz} onChange={(e) => setTz(e.target.value)} type="number" step="0.1" className="w-full rounded-lg px-2 py-1 bg-slate-900 border border-slate-700" />
                </label>
              </div>
              <div className="text-xs text-slate-300">
                <MathJax dynamic>{`${t('section_transNote')} ${isWorld ? "\\(\\quad T' = M_{trans} \\; T \\quad \\) (World)" : "\\(\\quad T' = T \\; M_{trans} \\quad \\) (Local)"} `}</MathJax>
              </div>
              <div className="mt-2">
                <MatrixBlock matrix={M_wTrans} label={"M_{trans}"} precision={precision} />
              </div>
              <button 
                onClick={applyTranslation}
                className={isWorld ? "mt-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95" : "mt-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95"}
              >
                &#x2197; {t('btn_applyTrans')}{isWorld ? " (World)" : " (Local)"}
              </button>
            </div>

            {/* Rotation */}
            <div className="rounded-2xl p-4 bg-slate-800 space-y-3">
              <h3 className="font-semibold">{t('section_rotTitle')} {isWorld ? " (World)" : " (Local)"}</h3>
              <div className="grid grid-cols-3 gap-2 text-sm items-end">
                <label className="space-y-1 col-span-2">
                  <div>{t('label_angle')}</div>
                  <input value={angleDeg} onChange={(e) => setAngleDeg(e.target.value)} type="number" step="1" className="w-full rounded-lg px-2 py-1 bg-slate-900 border border-slate-700" />
                </label>
                <label className="space-y-1">
                  <div>{t('label_axis')}</div>
                  <select value={axis} onChange={(e) => setAxis(e.target.value)} className="w-full rounded-lg px-2 py-1 bg-slate-900 border border-slate-700">
                    <option value="X">X</option>
                    <option value="Y">Y</option>
                    <option value="Z">Z</option>
                  </select>
                </label>
              </div>
              <div className="text-xs text-slate-300">
                <MathJax dynamic>{`${t('section_rotNote')} \\(\\quad ${isWorld ? "T' = M_{rot} \\; T \\quad\\) (World)" : "T' = T \\; M_{rot} \\quad\\) (Local)"}`}</MathJax>
              </div>
              <div className="mt-2">
                <MatrixBlock matrix={M_wRot} label={"M_{rot}"} precision={precision} />
              </div>
              <button
                onClick={applyRotation}
                className={isWorld ? "mt-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95" : "mt-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95"}
              >
                &#x21ba; {t('btn_applyRot')}{isWorld ? " (World)" : " (Local)"}
              </button>
            </div>

          </section>
          
          <div className="flex items-center gap-2 text-sm">

            {/* Mode switch toggle */}
            <span>Mode </span>
            <button
              type="button"
              role="switch"
              aria-checked={isWorld}
              title={isWorld ? 'World' : 'Local'}
              onClick={() => setMode(isWorld ? 'local' : 'world')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMode(isWorld ? 'local' : 'world'); } }}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 ${isWorld ? 'bg-emerald-600' : 'bg-indigo-600'}`}
            >
              <span className="sr-only">Toggle transform mode</span>
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${isWorld ? 'translate-x-1.5' : 'translate-x-7'}`}
              />
            </button>
            <span className="text-xs opacity-80 min-w-[48px] text-center">{isWorld ? 'World' : 'Local'}</span>
          
            <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>

            {/* Precision input */}
            <label className="flex items-center gap-2">
              <span>{t('presision')}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={()=>setPrecision(p=>Math.max(0, Math.min(6, (Number(p)||0) - 1)))} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">-</button>
                <input type="number" min={0} max={6} step={1}
                  value={precision}
                  onChange={(e)=>{
                    const v = Math.round(Number(e.target.value));
                    if (Number.isFinite(v)) setPrecision(Math.max(0, Math.min(6, v)));
                  }}
                  className="w-16 text-center rounded px-2 py-1 bg-slate-800 border border-slate-700" />
                <button type="button" onClick={()=>setPrecision(p=>Math.max(0, Math.min(6, (Number(p)||0) + 1)))} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">+</button>
              </div>
            </label>

          </div>          

          {/* <section className="text-xs text-slate-400">
            <p>{t('footer_note')}</p>
          </section> */}

        </div>
      </MathJaxContext>
    </div>
  );
}
