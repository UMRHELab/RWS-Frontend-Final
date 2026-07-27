// Homepage: Three.js building visualization
// Creates the interactive 3D building model used on the homepage.
// This file only controls the visual scene and does not affect dashboard data.

let scene, camera, renderer, controls, building, container;

// Runs everything needed to get the 3D scene on screen
function initThree() {
    container = document.getElementById('three-container');
    if (!container) return;

    setupScene();
    setupLights();
    buildBuilding();
    addSensorNodes();
    addFloorGrid();

    animate();
    window.addEventListener('resize', onWindowResize);
}

// Scene, camera, renderer, and mouse controls
function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(cssVar('--three-scene-bg'));

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(20, 15, 25);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
    } else {
        // No mouse controls available, just spin the building slowly instead
        controls = {
            update: () => {
                if (building) building.rotation.y += 0.003;
            }
        };
    }
}

function setupLights() {
    scene.add(new THREE.AmbientLight(cssVar('--three-ambient-light'), 0.6));

    const light = new THREE.DirectionalLight(cssVar('--three-directional-light'), 0.8);
    light.position.set(10, 20, 10);
    scene.add(light);
}

// Three stacked floors, each drawn as a solid box plus a wireframe outline
function buildBuilding() {
    building = new THREE.Group();

    const floorMat = new THREE.MeshStandardMaterial({
        color: cssVar('--three-building-fill'),
        transparent: true,
        opacity: 0.25
    });
    const wireMat = new THREE.MeshBasicMaterial({
        color: cssVar('--three-building-wire'),
        wireframe: true,
        transparent: true,
        opacity: 0.3
    });

    const floorHeight = 3.8;
    for (let i = 0; i < 3; i++) {
        const geo = new THREE.BoxGeometry(10, floorHeight, 7);
        const floor = new THREE.Mesh(geo, floorMat);
        const wire = new THREE.Mesh(geo, wireMat);
        floor.position.y = wire.position.y = i * floorHeight - floorHeight;
        building.add(floor, wire);
    }

    scene.add(building);
}

// One glowing marker per sensor station, placed where it roughly sits in the building
function addSensorNodes() {
    addSensorNode(cssVar('--three-node-cs-facility'), 0, 5.8, 0);   // CS Facility roof
    addSensorNode(cssVar('--three-node-rm1962'), 3, 0, 0.5);        // RM 1962 indoor
    addSensorNode(cssVar('--three-node-basement'), -3, -4, -0.5);   // Basement
}

function addSensorNode(color, x, y, z) {
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 32, 32),
        new THREE.MeshBasicMaterial({ color })
    );
    core.position.set(x, y, z);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 32, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 })
    );
    core.add(glow);

    building.add(core);
}

function addFloorGrid() {
    const grid = new THREE.GridHelper(40, 30, cssVar('--three-grid-color-1'), cssVar('--three-grid-color-2'));
    grid.position.y = -6;
    scene.add(grid);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}
