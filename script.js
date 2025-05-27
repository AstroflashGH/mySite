import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// DOM Elements
const startButton = document.getElementById("startButton");
const volumeControl = document.querySelector(".volume-control");
const volumeSlider = document.getElementById("volumeSlider");
const volumeDisplay = document.getElementById("volumeDisplay");
const darkToggle = document.getElementById("darkModeToggle");
const audio = document.getElementById("bgAudio");

// Global state
let isDarkMode = false;
let renderer = null;

// Dark mode colors
const COLORS = {
  light: 0x000000,
  dark: 0x0a0a0a
};

// Dark mode toggle functionality
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle('dark');
  darkToggle.textContent = isDarkMode ? "☀️" : "🌙";
  
  console.log('Dark mode toggled:', isDarkMode); // Debug log
  
  // Update renderer background if it exists
  if (renderer) {
    const bgColor = isDarkMode ? COLORS.dark : COLORS.light;
    renderer.setClearColor(bgColor);
    console.log('Renderer background updated to:', bgColor.toString(16)); // Debug log
  }
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

// Main application start
startButton.addEventListener("click", async () => {
  console.log('Starting 3D scene...'); // Debug log
  
  // Fade out start button
  startButton.classList.add("fade-out");
  setTimeout(() => startButton.remove(), 500);
  
  // Show volume control
  volumeControl.style.display = "flex";

  // Setup audio
  try {
    audio.volume = 0.5;
    await audio.play();
  } catch (err) {
    console.warn("Audio playback blocked:", err);
    alert("Audio playback was blocked. Please enable audio for the full experience.");
  }

  // Setup Web Audio API for visualization
  let audioContext, audioSource, analyser, dataArray;
  
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioSource = audioContext.createMediaElementSource(audio);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);
  } catch (err) {
    console.warn("Web Audio API setup failed:", err);
    // Create dummy data for visualization
    dataArray = new Uint8Array(32).fill(50);
  }

  // Three.js Setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    1000
  );
  
  // Create renderer with initial background color
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Set initial background color based on current mode
  const initialBgColor = isDarkMode ? COLORS.dark : COLORS.light;
  renderer.setClearColor(initialBgColor);
  console.log('Initial renderer background:', initialBgColor.toString(16)); // Debug log
  
  document.body.appendChild(renderer.domElement);

  // Create 3D objects
  const geometry = new THREE.TorusKnotGeometry(1, 0.3, 128, 16);
  const material = new THREE.MeshStandardMaterial({
    color: 0xff00ff,
    emissive: 0xff00ff,
    emissiveIntensity: 0.2,
    roughness: 0.3,
    metalness: 0.2
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Lighting
  const pointLight = new THREE.PointLight(0xff00ff, 1.5, 100);
  pointLight.position.set(2, 2, 2);
  scene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0x220022, 0.5);
  scene.add(ambientLight);

  // Position camera
  camera.position.z = 5;

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Get audio data
    let avgFrequency = 50; // Default value
    if (analyser && dataArray) {
      try {
        analyser.getByteFrequencyData(dataArray);
        avgFrequency = dataArray.reduce((a, b) => a + b) / dataArray.length;
      } catch (err) {
        // Use default value if audio analysis fails
      }
    }

    // Rotate mesh
    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.012;

    // Scale based on audio
    const scale = 1 + avgFrequency / 200;
    mesh.scale.set(scale, scale, scale);

    // Change color based on audio
    const hue = (avgFrequency * 3) % 360;
    const emissiveColor = new THREE.Color(`hsl(${hue}, 100%, 60%)`);
    mesh.material.emissive.set(emissiveColor);
    mesh.material.color.set(emissiveColor);
    
    // Update point light color
    pointLight.color.set(emissiveColor);

    // Render scene
    renderer.render(scene, camera);
  }

  // Start animation
  animate();
});