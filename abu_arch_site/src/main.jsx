
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import "./index.css";

const ASSET = "/model/abu-arch-house.glb";

function useHouseScene(containerRef, mode = "hero") {
  const api = useRef(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(mode === "hero" ? 0x10100e : 0x151511);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(0, 1.8, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;

    scene.add(new THREE.HemisphereLight(0xf5ead7, 0x171717, 1.6));
    const key = new THREE.DirectionalLight(0xffe7bd, 3.1);
    key.position.set(5, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc5d6ff, 1.2);
    fill.position.set(-5, 4, -4);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(18, 64),
      new THREE.MeshStandardMaterial({ color: 0x171715, roughness: 0.92, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.05;
    ground.receiveShadow = true;
    scene.add(ground);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = mode === "hero" ? 2.2 : 0.22;
    controls.maxDistance = mode === "hero" ? 15 : 10;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI * 0.83;
    controls.target.set(0, 0, 0);

    let mixer = null;
    let raf = 0;
    let disposed = false;
    let modelSize = new THREE.Vector3(1, 1, 1);
    let modelCenter = new THREE.Vector3();

    const loader = new GLTFLoader();
    loader.load(
      ASSET,
      (gltf) => {
        if (disposed) return;
        const object = gltf.scene;
        modelRoot.add(object);

        const box = new THREE.Box3().setFromObject(object);
        modelCenter = box.getCenter(new THREE.Vector3());
        modelSize = box.getSize(new THREE.Vector3());
        object.position.sub(modelCenter);

        // Uniform normalization only changes world scale; model geometry/materials/proportions stay intact.
        const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
        const worldSize = 4.25;
        const scale = worldSize / maxDim;
        object.scale.setScalar(scale);

        const normalized = modelSize.clone().multiplyScalar(scale);
        const floorY = -normalized.y * 0.5;
        ground.position.y = floorY - 0.015;

        object.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.envMapIntensity = 0.8;
          }
        });

        const front = new THREE.Vector3(0, normalized.y * 0.25, normalized.z * 1.75);
        const target = new THREE.Vector3(0, normalized.y * 0.04, 0);
        camera.position.copy(front);
        controls.target.copy(target);
        camera.lookAt(target);

        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(object);
          gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
        }
        setProgress(100);
        setReady(true);
      },
      (xhr) => {
        if (xhr.total) setProgress(Math.round((xhr.loaded / xhr.total) * 100));
      },
      () => {
        setProgress(100);
        setReady(false);
      }
    );

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    const clock = new THREE.Clock();
    const tick = () => {
      if (disposed) return;
      const dt = clock.getDelta();
      mixer?.update(dt);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    api.current = {
      camera, controls, modelRoot, renderer, scene,
      get size() { return modelSize.clone().multiplyScalar(4.25 / Math.max(modelSize.x, modelSize.y, modelSize.z)); },
      reset() {
        const s = this.size;
        camera.position.set(0, s.y * 0.3, Math.max(s.x, s.z) * 1.75);
        controls.target.set(0, s.y * 0.05, 0);
      },
      waypoint(step) {
        const s = this.size;
        const w = Math.max(s.x, s.z);
        const h = Math.max(s.y, 1);
        const pts = [
          { p:[0, h*.26, w*1.78], t:[0,h*.08,0] },
          { p:[w*.72,h*.20,w*1.18], t:[0,h*.18,0] },
          { p:[w*.28,h*.11,w*.52], t:[0,h*.14,0] },
          { p:[-w*.10,h*.12,w*.08], t:[0,h*.18,0] },
          { p:[-w*.34,h*.20,-w*.18], t:[0,h*.23,0] },
          { p:[w*.52,h*.22,-w*.52], t:[0,h*.22,0] },
          { p:[-w*.65,h*.28,-w*1.2], t:[0,h*.12,0] },
          { p:[0,h*.34,w*1.78], t:[0,h*.10,0] }
        ];
        const x = pts[Math.max(0, Math.min(step, pts.length - 1))];
        return { position:new THREE.Vector3(...x.p), target:new THREE.Vector3(...x.t) };
      },
      animateTo(position, target, ms = 1500) {
        const startP = camera.position.clone();
        const startT = controls.target.clone();
        const start = performance.now();
        const ease = t => t < .5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
        const frame = (now) => {
          const t = Math.min(1, (now-start)/ms), e = ease(t);
          camera.position.lerpVectors(startP, position, e);
          controls.target.lerpVectors(startT, target, e);
          if (t < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [containerRef, mode]);

  return { api, progress, ready };
}

function HouseCanvas({ className="", mode="hero", onApi }) {
  const ref = useRef(null);
  const scene = useHouseScene(ref, mode);
  useEffect(() => { onApi?.(scene.api); }, [onApi, scene.api]);
  return (
    <>
      <div ref={ref} className={className} />
      {mode === "hero" && (
        <div className={`loading ${scene.ready ? "hidden" : ""}`}>
          <div className="loading-card">
            <div className="loading-row"><span>Loading ABU ARCH model</span><span>{scene.progress}%</span></div>
            <div className="progress"><span style={{width:`${scene.progress}%`}} /></div>
          </div>
        </div>
      )}
    </>
  );
}

function Nav() {
  const [open,setOpen] = useState(false);
  const links = [["Home","#home"],["Projects","#projects"],["About Us","#about"],["Services","#services"],["3D Experience","#experience"],["Contact","#contact"]];
  return <header className="nav">
    <div className="container nav-inner">
      <a href="#home" onClick={()=>setOpen(false)}><img className="logo" src="/assets/logo.jpg" alt="ABU ARCH" /></a>
      <nav className={`nav-links ${open?"open":""}`}>
        {links.map(([label,href])=><a key={href} href={href} onClick={()=>setOpen(false)}>{label}</a>)}
        <a className="nav-cta" href="#contact" onClick={()=>setOpen(false)}>Start a project</a>
      </nav>
      <button className="menu-btn" onClick={()=>setOpen(!open)} aria-label="Toggle navigation">{open?"×":"☰"}</button>
    </div>
  </header>
}

function Hero() {
  const [full,setFull]=useState(false);
  const api=useRef(null);
  const requestFullscreen=()=> {
    const canvas=api.current?.renderer?.domElement;
    if (!canvas) return;
    if (!document.fullscreenElement) canvas.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  return <section className="hero" id="home">
    <div className="hero-stage"><HouseCanvas mode="hero" className="hero-stage" onApi={x=>{api.current=x.current}} /></div>
    <div className="model-note">Drag to explore · Pinch to zoom</div>
    <div className="model-ui">
      <button className="icon-btn" title="Reset view" onClick={()=>api.current?.reset()}>↺</button>
      <button className={`icon-btn ${full?"active":""}`} title="Fullscreen" onClick={requestFullscreen}>⛶</button>
    </div>
    <div className="hero-content">
      <div className="hero-kicker">Architecture · Interiors · Spatial Design</div>
      <h1>Spaces with <em>presence.</em></h1>
      <p className="hero-sub">ABU ARCH shapes contemporary homes and interiors through a balance of proportion, material, light and lived experience.</p>
      <div className="hero-actions">
        <a className="btn primary" href="#experience">Enter 3D experience</a>
        <a className="btn" href="#projects">Explore projects</a>
      </div>
    </div>
    <div className="hero-meta">ABU ARCH / INDIA<br/>EST. 2026</div>
  </section>
}

const projects=[
  {no:"01", title:"Residence at Nepal", type:"Residential Architecture", img:"/assets/residence-at-nepal.jpg"},
  {no:"02", title:"Interior Design of Arsalan Siliguri", type:"Hospitality / Interior", img:"/assets/interior-arsalan.jpg"},
  {no:"03", title:"Modern Residence", type:"Residential Architecture", img:"/assets/modern-residence.jpg"},
];

function Projects() {
  return <section className="section" id="projects">
    <div className="container">
      <div className="eyebrow">Selected work</div>
      <h2 className="section-title">Architecture that<br/><span style={{color:"#c9a56a"}}>belongs</span> to its place.</h2>
      <p className="section-copy">A focused portfolio of residential and interior work. Each project is approached as a complete visual language—from facade and circulation to material palette and atmosphere.</p>
      <div className="project-grid">
        {projects.map((p,i)=><article className="project-card" key={p.title}>
          <img src={p.img} alt={p.title} loading={i?"lazy":"eager"} />
          <div className="project-info"><div className="project-number">{p.no}</div><h3>{p.title}</h3><p>{p.type}</p></div>
        </article>)}
      </div>
    </div>
  </section>
}

function About() {
  return <section className="section" id="about">
    <div className="container split">
      <div className="about-mark"><img src="/assets/logo.jpg" alt="ABU ARCH" /><span>Architecture / Interiors / Visualization</span></div>
      <div>
        <div className="eyebrow">The studio</div>
        <h2 className="section-title">Quietly bold.<br/>Precisely human.</h2>
        <p className="section-copy">ABU ARCH is a design studio creating refined architectural environments with an emphasis on clarity, warmth and enduring detail. We believe a strong building does more than look good—it makes everyday life feel considered.</p>
        <p className="section-copy">From first concept to visualization and interior detailing, our process connects the technical with the atmospheric.</p>
      </div>
    </div>
  </section>
}

function Services() {
  const items=[
    ["01","Architecture","Concept design, planning, facade language and detailed residential development."],
    ["02","Interior Design","Material palettes, furniture direction, lighting and complete spatial styling."],
    ["03","3D Visualization","Photorealistic architectural visuals and interactive model experiences."],
    ["04","Consultation","Design direction, feasibility and project review for new or evolving spaces."]
  ];
  return <section className="section" id="services">
    <div className="container">
      <div className="eyebrow">What we do</div>
      <h2 className="section-title">One studio.<br/>Complete design thinking.</h2>
      <div className="services">{items.map(x=><div className="service" key={x[0]}><div className="service-no">{x[0]}</div><h3>{x[1]}</h3><p>{x[2]}</p></div>)}</div>
    </div>
  </section>
}

function Experience() {
  const api=useRef(null), [step,setStep]=useState(0), [playing,setPlaying]=useState(false);
  const labels=["Arrival","Approach","Entrance","Living area","Interior","Room sequence","Rear view","Return outside"];
  const go=(n)=> {
    const next=(n+labels.length)%labels.length;
    const w=api.current?.waypoint(next);
    if(w){ api.current.animateTo(w.position,w.target,1450); setStep(next); }
  };
  useEffect(()=>{
    if(!playing) return;
    const id=setInterval(()=>setStep(s=>{const n=(s+1)%labels.length; const w=api.current?.waypoint(n); if(w) api.current.animateTo(w.position,w.target,1500); return n;}), 3000);
    return ()=>clearInterval(id);
  },[playing]);
  return <section className="experience" id="experience">
    <div className="container">
      <div className="experience-box">
        <HouseCanvas mode="experience" className="experience-canvas" onApi={x=>{api.current=x.current}} />
        <div className="experience-overlay" />
        <div className="experience-copy">
          <div className="eyebrow">Immersive 3D</div>
          <h2>Walk the<br/>architecture.</h2>
          <p>Use the guided route to move from arrival to the interior sequence. You can take control at any time—drag to look around, pinch or scroll to zoom.</p>
        </div>
        <div className="walk-controls">
          <button className="btn primary" onClick={()=>setPlaying(!playing)}>{playing?"Pause walkthrough":"Start 3D walkthrough"}</button>
          <button className="btn" onClick={()=>{setPlaying(false); go(0)}}>Reset view</button>
          <button className="btn" onClick={()=>go(step-1)}>‹</button>
          <button className="btn" onClick={()=>go(step+1)}>›</button>
        </div>
        <div className="step-pill">{String(step+1).padStart(2,"0")} / {String(labels.length).padStart(2,"0")} · {labels[step]}</div>
      </div>
    </div>
  </section>
}

function Contact() {
  return <section className="section contact" id="contact">
    <div className="container contact-grid">
      <div>
        <div className="eyebrow">Start a conversation</div>
        <h2 className="section-title">Have a space<br/>in mind?</h2>
        <p className="section-copy">Tell us about your project, site, or interior. We’ll help shape the next step.</p>
      </div>
      <div className="contact-card">
        <div className="contact-row"><span>Studio</span><strong>ABU ARCH</strong></div>
        <div className="contact-row"><span>Phone</span><a href="tel:+918294102337">+91 8294102337</a></div>
        <div className="contact-row"><span>WhatsApp</span><a href="https://wa.me/918294102337" target="_blank" rel="noreferrer">+91 8294102337</a></div>
        <div className="contact-buttons">
          <a className="btn" href="tel:+918294102337">Call Now</a>
          <a className="btn" href="https://wa.me/918294102337" target="_blank" rel="noreferrer">WhatsApp</a>
          <a className="btn" href="mailto:abuarch@example.com?subject=Project%20Enquiry">Enquire Now</a>
        </div>
      </div>
    </div>
  </section>
}

function Footer(){return <footer className="footer"><div className="container footer-inner"><span>© {new Date().getFullYear()} ABU ARCH</span><span>Architecture · Interiors · Visualization</span></div></footer>}

function App(){return <div className="app"><Nav/><Hero/><Projects/><About/><Services/><Experience/><Contact/><Footer/></div>}
createRoot(document.getElementById("root")).render(<App />);
