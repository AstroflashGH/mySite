import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// DOM Elements
const startButton = document.getElementById("startButton");
const volumeControl = document.querySelector(".volume-control");
const volumeSlider = document.getElementById("volumeSlider");
const volumeDisplay = document.getElementById("volumeDisplay");
const darkToggle = document.getElementById("darkModeToggle");
const audio = document.getElementById("bgAudio");

// Global state
let isDarkMode = true;
let renderer = null;

// Dark mode toggle functionality
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle('dark');
  darkToggle.textContent = isDarkMode ? "🌙" : "☀️";
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

// Custom shader material for procedural effects
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
    // Increased the multiplier for audioData from 0.3 to 1.5 for larger oscillation
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
    console.warn("Audio playbook blocked:", err);
  }

  // Setup Web Audio API
  let audioContext, audioSource, analyser, dataArray;
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
    dataArray = new Uint8Array(128).fill(50); // Fallback for no audio data
  }

  // Three.js Setup with enhanced settings
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  
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

  // Create multiple complex geometries
  const objects = [];
  const materials = [];
  const cubeMaterials = []; // New array to hold cube materials

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
    const sphereGeo = new THREE.IcosahedronGeometry(1.2, 4); // Increased size from 0.5 to 1.2
    const sphereMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(i / 8, 1, 0.7), // Increased lightness from 0.5 to 0.7
      transparent: false, // Made them fully opaque
      opacity: 1.0, // Full opacity
      shininess: 100,
      emissive: new THREE.Color().setHSL(i / 8, 0.5, 0.2) // Added emissive glow
    });
    
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    const angle = (i / 8) * Math.PI * 2;
    sphere.position.set(Math.cos(angle) * 12, Math.sin(angle) * 12, 0); // Moved further out from 8 to 12
    scene.add(sphere);
    objects.push(sphere);
    materials.push(sphereMat);
  }

  // Create ring of cubes
  for (let i = 0; i < 12; i++) {
    const cubeGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff, // Initial color
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
    cubeMaterials.push(cubeMat); // Store cube material for individual color control
  }

  // Complex lighting setup
  const lights = [];
  
  // Multiple colored point lights
  for (let i = 0; i < 6; i++) {
    const light = new THREE.PointLight(0xffffff, 2, 30);
    const angle = (i / 6) * Math.PI * 2;
    light.position.set(Math.cos(angle) * 15, Math.sin(angle) * 10, 5);
    light.castShadow = true;
    scene.add(light);
    lights.push(light);
  }

  // Spotlight
  const spotlight = new THREE.SpotLight(0xff00ff, 3, 50, Math.PI / 6);
  spotlight.position.set(0, 20, 10);
  spotlight.target = mainMesh;
  spotlight.castShadow = true;
  scene.add(spotlight);

  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x220033, 0.3);
  scene.add(ambientLight);

  camera.position.set(0, 0, 15);

  // Post-processing effects (simplified bloom effect)
  const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderTarget.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation variables
  let time = 0;

  // GPU-intensive animation loop
  function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    // Get audio data
    let avgFrequency = 50;
    let frequencyArray = new Array(8).fill(50);
    
    if (analyser && dataArray) {
      try {
        analyser.getByteFrequencyData(dataArray);
        avgFrequency = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        // Get frequency bands for different effects
        const bandSize = Math.floor(dataArray.length / 8);
        for (let i = 0; i < 8; i++) {
          const start = i * bandSize;
          const end = start + bandSize;
          frequencyArray[i] = dataArray.slice(start, end).reduce((a, b) => a + b) / bandSize;
        }
      } catch (err) {
        // Use default values
      }
    }

    const normalizedAudio = avgFrequency / 255;

    // Update shader uniforms
    shaderMaterial.uniforms.time.value = time;
    shaderMaterial.uniforms.audioData.value = normalizedAudio;

    // Animate main torus knot
    mainMesh.rotation.x += 0.01 + normalizedAudio * 0.02;
    mainMesh.rotation.y += 0.015 + normalizedAudio * 0.03;
    mainMesh.rotation.z += 0.008;
    mainMesh.scale.setScalar(1 + normalizedAudio * 0.5);

    // Animate spheres - fixed indexing after removing donuts
    const sphereStartIndex = 1; // After main torus knot (0)
    objects.slice(sphereStartIndex, sphereStartIndex + 8).forEach((sphere, i) => {
      if (sphere.geometry && sphere.geometry.type === 'IcosahedronGeometry') {
        const freq = frequencyArray[i] / 255;
        sphere.rotation.x += 0.02 + freq * 0.05;
        sphere.rotation.y += 0.03 + freq * 0.04;
        sphere.scale.setScalar(1 + freq * 0.8);
        
        const angle = (i / 8) * Math.PI * 2 + time * 0.5;
        sphere.position.x = Math.cos(angle) * (12 + freq * 3); // Updated radius to match new position
        sphere.position.y = Math.sin(angle) * (12 + freq * 3);
        sphere.position.z = Math.sin(time + i) * 3;

        // Enhanced color animation for better visibility
        const hue = (time * 0.1 + i * 0.125) % 1; // Slower, more distinct color changes
        sphere.material.color.setHSL(hue, 1, 0.7);
        sphere.material.emissive.setHSL(hue, 0.5, 0.2 + freq * 0.3);
      }
    });

    // Animate cubes and change their color with music
    cubeMaterials.forEach((material, i) => {
      const freq = frequencyArray[i % frequencyArray.length] / 255;
      
      const hue = (time * 0.05 + freq * 0.5 + i * 0.1) % 1;
      const saturation = 0.8 + freq * 0.2;
      const lightness = 0.5 + freq * 0.3;
      
      material.color.setHSL(hue, saturation, lightness);
      material.emissive.setHSL(hue, saturation * 0.5, lightness * 0.5);

      const cube = objects[9 + i]; // Updated index after removing donuts
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

    // Render scene
    renderer.render(scene, camera);
  }

  animate();
});