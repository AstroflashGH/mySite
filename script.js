import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// DOM Elements
const startButton = document.getElementById("startButton");
const volumeControl = document.querySelector(".volume-control");
const volumeSlider = document.getElementById("volumeSlider");
const volumeDisplay = document.getElementById("volumeDisplay");
const darkToggle = document.getElementById("darkModeToggle");
const audio = document.getElementById("bgAudio");
const astroflashTitle = document.querySelector(".animated-title");

// Global state
let isDarkMode = true;
document.body.classList.add('dark');
let renderer = null;
let currentScene = 0; // 0 = original scene, 1 = new scene
let scenes = [];
let cameras = [];
let animationFunctions = [];
let audioContext, audioSource, analyser, dataArray;

// Dark mode toggle functionality
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle('dark');
  darkToggle.textContent = isDarkMode ? "☀️" : "🌙";
  console.log('Dark mode toggled:', isDarkMode);
}

darkToggle.addEventListener("click", toggleDarkMode);

// Volume slider display update
volumeSlider.addEventListener("input", () => {
  const volume = volumeSlider.value;
  volumeDisplay.textContent = volume + "%";
  if (audio) {
    audio.volume = volume / 100;
  }
});

// Scene cycling functionality
function cycleScene() {
  if (scenes.length > 0) {
    currentScene = (currentScene + 1) % scenes.length;
    console.log('Switched to scene:', currentScene);
    
    // Add visual feedback
    astroflashTitle.style.transform = 'scale(1.1)';
    astroflashTitle.style.color = '#ff00ff';
    setTimeout(() => {
      astroflashTitle.style.transform = 'scale(1)';
      astroflashTitle.style.color = '';
    }, 200);
  }
}

astroflashTitle.addEventListener("click", cycleScene);
astroflashTitle.style.cursor = "pointer";

// Custom shader material for procedural effects (Scene 1)
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float time;
  uniform float audioData;
  
  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    
    vec3 pos = position;
    float wave = sin(pos.x * 10.0 + time * 2.0) * cos(pos.y * 8.0 + time * 1.5) * audioData * 1.5;
    pos += normal * wave;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float time;
  uniform float audioData;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  
  void main() {
    float noise = sin(vPosition.x * 20.0 + time) * cos(vPosition.y * 15.0 + time * 0.5) * sin(vPosition.z * 25.0 + time * 2.0);
    
    vec3 color = mix(color1, color2, sin(time + vUv.x * 5.0) * 0.5 + 0.5);
    color = mix(color, color3, cos(time * 1.5 + vUv.y * 3.0) * 0.5 + 0.5);
    
    float intensity = (audioData * 2.0 + noise * 0.5) * (1.0 + sin(time * 3.0) * 0.3);
    color *= intensity;
    
    float fresnel = pow(1.0 - dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 2.0);
    color += fresnel * audioData * vec3(1.0, 0.3, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Tunnel shader for Scene 2
const tunnelVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float time;
  uniform float audioData;
  
  void main() {
    vUv = uv;
    vPosition = position;
    
    vec3 pos = position;
    float ripple = sin(length(pos.xy) * 8.0 - time * 4.0) * audioData * 0.3;
    pos.z += ripple;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const tunnelFragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float time;
  uniform float audioData;
  
  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center);
    
    float tunnel = sin(dist * 20.0 - time * 6.0) * 0.5 + 0.5;
    float rings = sin(dist * 50.0 - time * 10.0) * 0.3 + 0.7;
    
    vec3 color1 = vec3(1.0, 0.0, 1.0); // Magenta
    vec3 color2 = vec3(0.0, 1.0, 1.0); // Cyan
    vec3 color3 = vec3(1.0, 1.0, 0.0); // Yellow
    
    vec3 color = mix(color1, color2, tunnel);
    color = mix(color, color3, rings);
    
    float intensity = (1.0 - dist) * (audioData * 2.0 + 0.5);
    color *= intensity;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Create Scene 1 (Original)
function createScene1() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  
  const objects = [];
  const materials = [];
  const cubeMaterials = [];

  // Main torus knot with custom shader
  const mainGeometry = new THREE.TorusKnotGeometry(2, 0.6, 200, 32);
  const shaderMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      time: { value: 0 },
      audioData: { value: 0 },
      color1: { value: new THREE.Color(0xff0080) },
      color2: { value: new THREE.Color(0x8000ff) },
      color3: { value: new THREE.Color(0x00ffff) }
    }
  });
  const mainMesh = new THREE.Mesh(mainGeometry, shaderMaterial);
  scene.add(mainMesh);
  objects.push(mainMesh);
  materials.push(shaderMaterial);

  // Create particle system
  const particleCount = 100;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 50;
    positions[i + 1] = (Math.random() - 0.5) * 50;
    positions[i + 2] = (Math.random() - 0.5) * 50;
    
    colors[i] = Math.random();
    colors[i + 1] = Math.random();
    colors[i + 2] = Math.random();
  }
  
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const particleMaterial = new THREE.PointsMaterial({
    size: 2,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true
  });
  
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // Create multiple rotating spheres
  for (let i = 0; i < 8; i++) {
    const sphereGeo = new THREE.IcosahedronGeometry(1.2, 4);
    const sphereMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(i / 8, 1, 0.7),
      transparent: false,
      opacity: 1.0,
      shininess: 100,
      emissive: new THREE.Color().setHSL(i / 8, 0.5, 0.2)
    });
    
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    const angle = (i / 8) * Math.PI * 2;
    sphere.position.set(Math.cos(angle) * 12, Math.sin(angle) * 12, 0);
    scene.add(sphere);
    objects.push(sphere);
    materials.push(sphereMat);
  }

  // Create ring of cubes
  for (let i = 0; i < 12; i++) {
    const cubeGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x440044
    });
    
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    const angle = (i / 12) * Math.PI * 2;
    cube.position.set(Math.cos(angle) * 6, 0, Math.sin(angle) * 6);
    scene.add(cube);
    objects.push(cube);
    materials.push(cubeMat);
    cubeMaterials.push(cubeMat);
  }

  // Complex lighting setup
  const lights = [];
  
  for (let i = 0; i < 6; i++) {
    const light = new THREE.PointLight(0xffffff, 2, 30);
    const angle = (i / 6) * Math.PI * 2;
    light.position.set(Math.cos(angle) * 15, Math.sin(angle) * 10, 5);
    light.castShadow = true;
    scene.add(light);
    lights.push(light);
  }

  const spotlight = new THREE.SpotLight(0xff00ff, 3, 50, Math.PI / 6);
  spotlight.position.set(0, 20, 10);
  spotlight.target = mainMesh;
  spotlight.castShadow = true;
  scene.add(spotlight);

  const ambientLight = new THREE.AmbientLight(0x220033, 0.3);
  scene.add(ambientLight);

  camera.position.set(0, 0, 15);

  // Animation function for Scene 1
  const animateScene1 = (time) => {
    const avgFrequency = getAverageFrequency();
    const frequencyArray = getFrequencyArray();
    const normalizedAudio = avgFrequency / 255;

    // Update shader uniforms
    shaderMaterial.uniforms.time.value = time;
    shaderMaterial.uniforms.audioData.value = normalizedAudio;

    // Animate main torus knot
    mainMesh.rotation.x += 0.01 + normalizedAudio * 0.02;
    mainMesh.rotation.y += 0.015 + normalizedAudio * 0.03;
    mainMesh.rotation.z += 0.008;
    mainMesh.scale.setScalar(1 + normalizedAudio * 0.5);

    // Animate spheres
    const sphereStartIndex = 1;
    objects.slice(sphereStartIndex, sphereStartIndex + 8).forEach((sphere, i) => {
      if (sphere.geometry && sphere.geometry.type === 'IcosahedronGeometry') {
        const freq = frequencyArray[i] / 255;
        sphere.rotation.x += 0.02 + freq * 0.05;
        sphere.rotation.y += 0.03 + freq * 0.04;
        sphere.scale.setScalar(1 + freq * 0.8);
        
        const angle = (i / 8) * Math.PI * 2 + time * 0.5;
        sphere.position.x = Math.cos(angle) * (12 + freq * 3);
        sphere.position.y = Math.sin(angle) * (12 + freq * 3);
        sphere.position.z = Math.sin(time + i) * 3;

        const hue = (time * 0.1 + i * 0.125) % 1;
        sphere.material.color.setHSL(hue, 1, 0.7);
        sphere.material.emissive.setHSL(hue, 0.5, 0.2 + freq * 0.3);
      }
    });

    // Animate cubes
    cubeMaterials.forEach((material, i) => {
      const freq = frequencyArray[i % frequencyArray.length] / 255;
      
      const hue = (time * 0.05 + freq * 0.5 + i * 0.1) % 1;
      const saturation = 0.8 + freq * 0.2;
      const lightness = 0.5 + freq * 0.3;
      
      material.color.setHSL(hue, saturation, lightness);
      material.emissive.setHSL(hue, saturation * 0.5, lightness * 0.5);

      const cube = objects[9 + i];
      cube.rotation.x += 0.03 + freq * 0.06;
      cube.rotation.y += 0.02 + freq * 0.04;
      cube.rotation.z += 0.04 + freq * 0.05;
      
      const angle = (i / 12) * Math.PI * 2 - time * 0.3;
      cube.position.x = Math.cos(angle) * 6;
      cube.position.z = Math.sin(angle) * 6;
      cube.position.y = Math.sin(time * 2 + i) * 2 + freq * 4;
    });

    // Animate particles
    const positions = particles.geometry.attributes.position.array;
    const colors = particles.geometry.attributes.color.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += Math.sin(time + positions[i] * 0.01) * 0.02;
      
      const colorIndex = Math.floor(i / 3) % frequencyArray.length;
      const freq = frequencyArray[colorIndex] / 255;
      colors[i] = freq;
      colors[i + 1] = Math.sin(time + i * 0.1) * 0.5 + 0.5;
      colors[i + 2] = Math.cos(time + i * 0.05) * 0.5 + 0.5;
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;
    particles.rotation.y += 0.001 + normalizedAudio * 0.01;

    // Animate lights
    lights.forEach((light, i) => {
      const freq = frequencyArray[i] / 255;
      light.intensity = 1 + freq * 3;
      light.color.setHSL((time * 0.1 + i * 0.2) % 1, 1, 0.5);
      
      const angle = (i / lights.length) * Math.PI * 2 + time * 0.2;
      light.position.x = Math.cos(angle) * 15;
      light.position.z = Math.sin(angle) * 15;
      light.position.y = Math.sin(time + i) * 8;
    });

    // Camera movement
    camera.position.x = Math.sin(time * 0.1) * 5;
    camera.position.y = Math.cos(time * 0.15) * 3;
    camera.position.z = 15 + Math.sin(time * 0.05) * 5;
    camera.lookAt(0, 0, 0);
  };

  return { scene, camera, animate: animateScene1 };
}

// Create Scene 2 (New Tunnel Scene)
function createScene2() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  
  const objects = [];

  // Create tunnel geometry
  const tunnelGeometry = new THREE.CylinderGeometry(10, 10, 100, 32, 50, true);
  const tunnelMaterial = new THREE.ShaderMaterial({
    vertexShader: tunnelVertexShader,
    fragmentShader: tunnelFragmentShader,
    uniforms: {
      time: { value: 0 },
      audioData: { value: 0 }
    },
    side: THREE.DoubleSide,
    transparent: true
  });
  
  const tunnel = new THREE.Mesh(tunnelGeometry, tunnelMaterial);
  tunnel.rotation.x = Math.PI / 2;
  scene.add(tunnel);
  objects.push(tunnel);

  // Create floating crystals
  const crystals = [];
  for (let i = 0; i < 20; i++) {
    const crystalGeo = new THREE.ConeGeometry(0.5, 2, 6);
    const crystalMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(Math.random(), 1, 0.8),
      transparent: true,
      opacity: 0.8,
      emissive: new THREE.Color().setHSL(Math.random(), 0.5, 0.3)
    });
    
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 80,
      (Math.random() - 0.5) * 15
    );
    crystal.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    scene.add(crystal);
    crystals.push(crystal);
    objects.push(crystal);
  }

  // Create energy orbs
  const orbs = [];
  for (let i = 0; i < 15; i++) {
    const orbGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const orbMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(
      Math.cos(i * 0.4) * 8,
      (i - 7.5) * 8,
      Math.sin(i * 0.4) * 8
    );
    
    scene.add(orb);
    orbs.push(orb);
    objects.push(orb);
  }

  // Lighting for Scene 2
  const lights = [];
  for (let i = 0; i < 4; i++) {
    const light = new THREE.PointLight(0xff00ff, 2, 20);
    const angle = (i / 4) * Math.PI * 2;
    light.position.set(Math.cos(angle) * 8, 0, Math.sin(angle) * 8);
    scene.add(light);
    lights.push(light);
  }

  const ambientLight = new THREE.AmbientLight(0x440044, 0.4);
  scene.add(ambientLight);

  camera.position.set(0, -30, 0);
  camera.lookAt(0, 0, 0);

  // Animation function for Scene 2
  const animateScene2 = (time) => {
    const avgFrequency = getAverageFrequency();
    const frequencyArray = getFrequencyArray();
    const normalizedAudio = avgFrequency / 255;

    // Update tunnel shader
    tunnelMaterial.uniforms.time.value = time;
    tunnelMaterial.uniforms.audioData.value = normalizedAudio;

    // Move camera through tunnel
    camera.position.y = -30 + Math.sin(time * 0.3) * 20;
    camera.position.x = Math.sin(time * 0.2) * 3;
    camera.position.z = Math.cos(time * 0.2) * 3;
    camera.lookAt(0, camera.position.y + 20, 0);

    // Animate crystals
    crystals.forEach((crystal, i) => {
      const freq = frequencyArray[i % frequencyArray.length] / 255;
      crystal.rotation.x += 0.02 + freq * 0.05;
      crystal.rotation.y += 0.015 + freq * 0.04;
      crystal.scale.setScalar(1 + freq * 0.5);
      
      const hue = (time * 0.1 + i * 0.1) % 1;
      crystal.material.color.setHSL(hue, 1, 0.8);
      crystal.material.emissive.setHSL(hue, 0.5, 0.3 + freq * 0.4);
      
      crystal.position.y += Math.sin(time + i) * 0.02;
    });

    // Animate orbs
    orbs.forEach((orb, i) => {
      const freq = frequencyArray[i % frequencyArray.length] / 255;
      const angle = time * 0.5 + i * 0.4;
      
      orb.position.x = Math.cos(angle) * (8 + freq * 3);
      orb.position.z = Math.sin(angle) * (8 + freq * 3);
      orb.scale.setScalar(1 + freq * 2);
      
      const hue = (time * 0.2 + i * 0.07) % 1;
      orb.material.color.setHSL(hue, 1, 0.8);
    });

    // Animate lights
    lights.forEach((light, i) => {
      const freq = frequencyArray[i] / 255;
      light.intensity = 1 + freq * 4;
      
      const angle = (i / lights.length) * Math.PI * 2 + time * 0.3;
      light.position.x = Math.cos(angle) * 8;
      light.position.z = Math.sin(angle) * 8;
      light.position.y = Math.sin(time + i) * 10;
      
      const hue = (time * 0.15 + i * 0.25) % 1;
      light.color.setHSL(hue, 1, 0.6);
    });
  };

  return { scene, camera, animate: animateScene2 };
}

// Audio utility functions
function getAverageFrequency() {
  if (analyser && dataArray) {
    try {
      analyser.getByteFrequencyData(dataArray);
      return dataArray.reduce((a, b) => a + b) / dataArray.length;
    } catch (err) {
      return 50;
    }
  }
  return 50;
}

function getFrequencyArray() {
  if (analyser && dataArray) {
    try {
      analyser.getByteFrequencyData(dataArray);
      const bandSize = Math.floor(dataArray.length / 8);
      const frequencyArray = [];
      for (let i = 0; i < 8; i++) {
        const start = i * bandSize;
        const end = start + bandSize;
        frequencyArray[i] = dataArray.slice(start, end).reduce((a, b) => a + b) / bandSize;
      }
      return frequencyArray;
    } catch (err) {
      return new Array(8).fill(50);
    }
  }
  return new Array(8).fill(50);
}

// Main application start
startButton.addEventListener("click", async () => {
  console.log('Starting GPU-intensive 3D scene...');
  
  startButton.classList.add("fade-out");
  setTimeout(() => startButton.remove(), 500);
  volumeControl.style.display = "flex";

  // Setup audio
  try {
    audio.volume = 0.5;
    await audio.play();
  } catch (err) {
    console.warn("Audio playback blocked:", err);
  }

  // Setup Web Audio API
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioSource = audioContext.createMediaElementSource(audio);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);
  } catch (err) {
    console.warn("Web Audio API setup failed:", err);
    dataArray = new Uint8Array(128).fill(50);
  }

  // Three.js Setup
  renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Create both scenes
  const scene1Data = createScene1();
  const scene2Data = createScene2();
  
  scenes.push(scene1Data.scene, scene2Data.scene);
  cameras.push(scene1Data.camera, scene2Data.camera);
  animationFunctions.push(scene1Data.animate, scene2Data.animate);

  // Handle window resize
  window.addEventListener("resize", () => {
    cameras.forEach(camera => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation variables
  let time = 0;

  // Main animation loop
  function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    // Run the current scene's animation
    if (animationFunctions[currentScene]) {
      animationFunctions[currentScene](time);
    }

    // Render the current scene
    if (scenes[currentScene] && cameras[currentScene]) {
      renderer.render(scenes[currentScene], cameras[currentScene]);
    }
  }

  animate();
});