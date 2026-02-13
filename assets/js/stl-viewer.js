import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

var CONTAINER_SELECTOR = '.stl-viewer-container';
var LOADING_CLASS = 'stl-viewer-loading';
var HINT_CLASS = 'stl-viewer-hint';

var MODEL_COLOR = 0xE4C49F;
var BACKGROUND_COLOR = 0x1a1a2e;
var AMBIENT_INTENSITY = 0.6;
var DIRECTIONAL_INTENSITY = 0.8;
var CAMERA_FOV = 50;
var CAMERA_NEAR = 0.1;
var CAMERA_FAR = 2000;
var FIT_OFFSET = 1.6;
var DAMPING_FACTOR = 0.1;
var AUTO_ROTATE_SPEED = 1.0;
var HINT_TEXT = 'drag to rotate · scroll to zoom';
var LOADING_TEXT = 'loading...';

function initViewer(container) {
  var stlUrl = container.getAttribute('data-stl');
  if (!stlUrl) return;

  var loadingEl = document.createElement('div');
  loadingEl.className = LOADING_CLASS;
  loadingEl.textContent = LOADING_TEXT;
  container.appendChild(loadingEl);

  var hintEl = document.createElement('div');
  hintEl.className = HINT_CLASS;
  hintEl.textContent = HINT_TEXT;
  container.appendChild(hintEl);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);

  var camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    container.clientWidth / container.clientHeight,
    CAMERA_NEAR,
    CAMERA_FAR
  );

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  var ambientLight = new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY);
  scene.add(ambientLight);

  var dirLight1 = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY);
  dirLight1.position.set(1, 1, 1);
  scene.add(dirLight1);

  var dirLight2 = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY * 0.5);
  dirLight2.position.set(-1, -0.5, -1);
  scene.add(dirLight2);

  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = DAMPING_FACTOR;
  controls.autoRotate = true;
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED;

  var loader = new STLLoader();
  loader.load(stlUrl, function(geometry) {
    if (loadingEl.parentNode) {
      loadingEl.parentNode.removeChild(loadingEl);
    }

    var material = new THREE.MeshPhongMaterial({
      color: MODEL_COLOR,
      specular: 0x444444,
      shininess: 60
    });
    var mesh = new THREE.Mesh(geometry, material);

    geometry.computeBoundingBox();
    var box = geometry.boundingBox;
    var center = new THREE.Vector3();
    box.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);

    scene.add(mesh);

    var size = new THREE.Vector3();
    box.getSize(size);
    var maxDim = Math.max(size.x, size.y, size.z);
    var fov = camera.fov * (Math.PI / 180);
    var distance = (maxDim / 2) / Math.tan(fov / 2) * FIT_OFFSET;

    camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  var resizeObserver = new ResizeObserver(function() {
    var width = container.clientWidth;
    var height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resizeObserver.observe(container);
}

var containers = document.querySelectorAll(CONTAINER_SELECTOR);
Array.prototype.slice.call(containers).forEach(initViewer);
