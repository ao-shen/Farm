import * as THREE from 'three';

import { Text } from 'troika-three-text';

import * as Stats from 'stats.js';

import * as BufferGeometryUtils from './THREE/BufferGeometryUtils.js';
import { OrbitControls } from './THREE/OrbitControls.js';
import { GLTFLoader } from './THREE/GLTFLoader.js';

import { onWindowResize, onMouseUp, onMouseMove, onMouseDown, onKeyDown } from './events.js';
import { BLOCK, Block } from './block.js';

export function init(Farm) {

    // STATS

    Farm.stats = new Stats();
    Farm.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(Farm.stats.dom);

    // THREE

    const textureLoader = new THREE.TextureLoader();
    let modelLoader = new GLTFLoader();
    let texture, material, geometry;

    // Tnit 3D Scene
    initScene(Farm);

    // Tnit 2D Scene
    initHudScene(Farm);

    // Load Buildings
    loadBuildingAssets(Farm);

    // Load Entities
    loadEntitiesAssets(Farm);

    // Init World
    initWorld(Farm);

    // Init Overlays
    initOverlays(Farm);

    // Init Events
    initEvents(Farm);

    return Farm;
}

function initScene(Farm) {

    let texture, material, geometry;

    // init 3D Scene

    Farm.scene = new THREE.Scene();
    Farm.scene.background = new THREE.Color(0xcccccc);
    Farm.scene.fog = new THREE.FogExp2(0xcccccc, 0.0001);

    Farm.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
    Farm.renderer.setPixelRatio(window.devicePixelRatio);
    Farm.renderer.setSize(window.innerWidth, window.innerHeight);
    Farm.renderer.setClearColor(0x000000, 0);
    Farm.renderer.autoClear = false;
    Farm.renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(Farm.renderer.domElement);

    Farm.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);

    // controls

    Farm.controls = new OrbitControls(Farm.camera, Farm.renderer.domElement);
    Farm.controls.listenToKeyEvents(window); // optional

    //controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)

    Farm.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    Farm.controls.dampingFactor = 0.05;

    Farm.controls.screenSpacePanning = false;

    Farm.controls.minDistance = 1;
    Farm.controls.maxDistance = 5000;

    Farm.controls.minPolarAngle = 0;
    Farm.controls.maxPolarAngle = Math.PI / 2 - 0.01;

    Farm.controls.keyPanSpeed = 20;

    Farm.controls.zoomSpeed = 2;

    Farm.camera.position.set(15, 70, 35);
    Farm.controls.target.set(20, 0, 35);
    Farm.controls.update();

    // Lights

    let dirLight1 = new THREE.DirectionalLight(0xaaaaaa);
    dirLight1.position.set(1, 1, 1);
    Farm.scene.add(dirLight1);

    let dirLight2 = new THREE.DirectionalLight(0x002288);
    dirLight2.position.set(-1, -1, -1);
    Farm.scene.add(dirLight2);

    let ambientLight = new THREE.AmbientLight(0x222222);
    Farm.scene.add(ambientLight);

    const light = new THREE.AmbientLight(0x202020); // soft white light
    Farm.scene.add(light);

    geometry = new THREE.SphereGeometry(2, 32, 16);
    material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(0, 0, 0);
    Farm.scene.add(sphere);
}

function initHudScene(Farm) {
    const textureLoader = new THREE.TextureLoader();
    let texture, material, geometry;

    Farm.hudScene = new THREE.Scene();

    Farm.hudCamera = new THREE.OrthographicCamera(-window.innerWidth * 0.5, window.innerWidth * 0.5, window.innerHeight * 0.5, -window.innerHeight * 0.5, 1, 100);
    Farm.hudCamera.position.set(0, 0, 10);

    /*let hudAmbientLight = new THREE.AmbientLight(0x222222);
    Farm.hudScene.add(hudAmbientLight);*/

    // HUD

    Farm.groupBuildPalette = new THREE.Group();

    let calculatedBuildPaletteHeight = window.innerWidth / 8;

    // Build Button
    Farm.texBuildButton = textureLoader.load("assets/textures/button.png");
    Farm.texStopBuildButton = textureLoader.load("assets/textures/button_inverted.png");
    material = new THREE.SpriteMaterial({ map: Farm.texBuildButton });

    Farm.spriteBuildButton = new THREE.Sprite(material);
    Farm.spriteBuildButton.center.set(0.5, 0.5);
    Farm.spriteBuildButton.scale.set(calculatedBuildPaletteHeight - 20, calculatedBuildPaletteHeight - 20, 1);
    Farm.spriteBuildButton.position.set(window.innerWidth * 0.5 - calculatedBuildPaletteHeight * 0.5, -window.innerHeight * 0.5 + calculatedBuildPaletteHeight * 0.5, 2);
    Farm.spriteBuildButton.name = "BuildButton";
    Farm.hudScene.add(Farm.spriteBuildButton);

    Farm.textBuildButton = new Text();
    Farm.textBuildButton.text = 'BUILD';
    Farm.textBuildButton.font = 'assets/fonts/carrot.otf';
    Farm.textBuildButton.fontSize = 45;
    Farm.textBuildButton.outlineWidth = 5;
    Farm.textBuildButton.outlineColor = 0xFF9900;
    Farm.textBuildButton.color = 0xFFFFFF;
    Farm.textBuildButton.anchorX = 'center';
    Farm.textBuildButton.anchorY = 'middle';
    Farm.textBuildButton.textAlign = 'center';
    Farm.textBuildButton.position.set(window.innerWidth * 0.5 - calculatedBuildPaletteHeight * 0.5, -window.innerHeight * 0.5 + calculatedBuildPaletteHeight * 0.5, 3);
    Farm.textBuildButton.name = "BuildButton";
    Farm.hudScene.add(Farm.textBuildButton);

    // Build Palette
    textureLoader.load("assets/textures/palette.png", function(texture) {

        Farm.texBuildPalette = texture;

        material = new THREE.SpriteMaterial({ map: Farm.texBuildPalette });

        Farm.spriteBuildPalette = new THREE.Sprite(material);
        Farm.spriteBuildPalette.center.set(0.5, 0.5);
        Farm.spriteBuildPalette.scale.set(window.innerWidth, calculatedBuildPaletteHeight, 1);
        Farm.groupBuildPalette.add(Farm.spriteBuildPalette);
        Farm.spriteBuildPalette.position.set(0, -window.innerHeight * 0.5 + calculatedBuildPaletteHeight * 0.5, 1);
        Farm.spriteBuildPalette.name = "BuildPalette";
        Farm.hudScene.add(Farm.groupBuildPalette);
        Farm.groupBuildPalette.visible = false;
    });

    let selectSize = calculatedBuildPaletteHeight - 35;

    let thumbnailSize = calculatedBuildPaletteHeight - 40;
    let thumbnailY = -window.innerHeight * 0.5 + calculatedBuildPaletteHeight * 0.5;

    Farm.selectSize = selectSize;
    Farm.thumbnailSize = thumbnailSize;
    Farm.thumbnailY = thumbnailY;

    textureLoader.load("assets/textures/green_overlay.png", function(texture) {

        Farm.texBuildPaletteSelect = texture;

        material = new THREE.SpriteMaterial({ map: Farm.texBuildPaletteSelect });

        Farm.spriteBuildPaletteSelect = new THREE.Sprite(material);
        Farm.spriteBuildPaletteSelect.center.set(0.5, 0.5);
        Farm.spriteBuildPaletteSelect.scale.set(selectSize, selectSize, 1);
        Farm.groupBuildPalette.add(Farm.spriteBuildPaletteSelect);
        Farm.spriteBuildPaletteSelect.position.set(0, 0, 2);
        Farm.spriteBuildPaletteSelect.name = "BuildPaletteSelect";
    });


    for (let i = 0; i < Farm.BUILDINGS.length; i++) {

        let curBuilding = Farm.BUILDINGS[i];
        textureLoader.load(curBuilding.thumbnail, function(texture) {

            material = new THREE.SpriteMaterial({ map: texture });

            curBuilding.spriteThumbnail = new THREE.Sprite(material);
            curBuilding.spriteThumbnail.center.set(0.5, 0.5);
            curBuilding.spriteThumbnail.scale.set(thumbnailSize, thumbnailSize, 1);
            Farm.groupBuildPalette.add(curBuilding.spriteThumbnail);
            curBuilding.spriteThumbnail.position.set(-window.innerWidth * 0.5 + 20 + (i + 0.5) * (thumbnailSize + 20), thumbnailY, 2);
            curBuilding.spriteThumbnail.name = "BuildPalette_" + curBuilding.name;
        });
    }
}

function loadBuildingAssets(Farm) {

    let modelLoader = new GLTFLoader();

    // Load Models
    const defaultTransform = new THREE.Matrix4()
        .makeRotationX(Math.PI)
        .multiply(new THREE.Matrix4().makeScale(5, 5, 5));

    const defaultBuildingTransform = new THREE.Matrix4()
        .multiply(new THREE.Matrix4().makeScale(5, 5, 5));

    // Buildings
    for (let i = 0; i < Farm.BUILDINGS.length; i++) {

        let curBuilding = Farm.BUILDINGS[i];

        Farm.buildPaletteMap[curBuilding.name] = i;

        if (curBuilding.name == "Soil") {
            modelLoader.load(curBuilding.models[0], function(gltf) {
                let mesh = gltf.scene.children[0];

                Farm.geometrySoil = mesh.geometry.clone();

                Farm.geometrySoil.applyMatrix4(defaultTransform);

                Farm.materialSoil = mesh.material;

                Farm.meshSoil = new THREE.InstancedMesh(Farm.geometrySoil, Farm.materialSoil, 0);

                Farm.scene.add(Farm.meshSoil);
            });
        } else if (curBuilding.category == "plants") {
            curBuilding.geometries = [];
            curBuilding.materials = [];
            curBuilding.meshes = [];
            curBuilding.numStages = curBuilding.models.length;
            for (let j = 0; j < curBuilding.models.length; j++) {
                modelLoader.load(curBuilding.models[j], function(gltf) {
                    let mesh = gltf.scene.children[0];

                    curBuilding.geometries[j] = mesh.geometry.clone();

                    curBuilding.geometries[j].applyMatrix4(defaultTransform);

                    curBuilding.materials[j] = mesh.material;

                    curBuilding.meshes[j] = new THREE.InstancedMesh(curBuilding.geometries[j], curBuilding.materials[j], 0);

                    Farm.scene.add(curBuilding.meshes[j]);
                });
            }
        } else if (curBuilding.category == "buildings") {
            curBuilding.geometries = [];
            curBuilding.materials = [];
            curBuilding.meshes = [];
            curBuilding.numVariants = curBuilding.models.length;
            for (let j = 0; j < curBuilding.models.length; j++) {
                modelLoader.load(curBuilding.models[j], function(gltf) {
                    let mesh = gltf.scene.children[0];

                    mesh.geometry.applyMatrix4(defaultBuildingTransform);

                    curBuilding.geometries[j] = mesh.geometry.clone();

                    curBuilding.materials[j] = mesh.material;

                    curBuilding.meshes[j] = mesh.clone();
                });
            }
        }

    }
}

function loadEntitiesAssets(Farm) {
    let modelLoader = new GLTFLoader();
    const defaultEntityTransform = new THREE.Matrix4()
        .multiply(new THREE.Matrix4().makeScale(5, 5, 5));

    for (let i = 0; i < Farm.ENTITIES.length; i++) {
        let curEntity = Farm.ENTITIES[i];

        curEntity.geometries = [];
        curEntity.materials = [];
        curEntity.meshes = [];
        curEntity.numVariants = curEntity.models.length;

        for (let j = 0; j < curEntity.models.length; j++) {
            modelLoader.load(curEntity.models[j], function(gltf) {
                let mesh = gltf.scene.children[0];

                mesh.geometry.applyMatrix4(defaultEntityTransform);

                curEntity.geometries[j] = mesh.geometry.clone();

                curEntity.materials[j] = mesh.material;

                curEntity.meshes[j] = mesh.clone();
            });
        }
    }
}

function initWorld(Farm) {

    const textureLoader = new THREE.TextureLoader();

    // ground

    for (let state of Farm.GROUND_STATES) {
        state.uv[0] += 0.01;
        state.uv[1] += 0.01;
        state.uv[2] -= 0.01;
        state.uv[3] += 0.01;
        state.uv[4] -= 0.01;
        state.uv[5] -= 0.01;
        state.uv[6] += 0.01;
        state.uv[7] -= 0.01;
    }

    var quad_normals = [
        0, 1, 0
    ];

    let groundVertices = [];
    let groundNormals = [];
    Farm.groundUVs = [];
    let groundIndices = [];
    for (let x = 0; x < Farm.numBlocks.x; x++) {
        for (let z = 0; z < Farm.numBlocks.z; z++) {

            Farm.blocks[x + ',' + z] = new Block(x, z);

            groundVertices.push((x - 0.5) * Farm.blockSize);
            groundVertices.push(0);
            groundVertices.push((z - 0.5) * Farm.blockSize);
            groundVertices.push((x + 0.5) * Farm.blockSize);
            groundVertices.push(0);
            groundVertices.push((z - 0.5) * Farm.blockSize);
            groundVertices.push((x + 0.5) * Farm.blockSize);
            groundVertices.push(0);
            groundVertices.push((z + 0.5) * Farm.blockSize);
            groundVertices.push((x - 0.5) * Farm.blockSize);
            groundVertices.push(0);
            groundVertices.push((z + 0.5) * Farm.blockSize);
            groundNormals.push(...quad_normals);
            groundNormals.push(...quad_normals);
            groundNormals.push(...quad_normals);
            groundNormals.push(...quad_normals);
            Farm.groundUVs.push(...Farm.GROUND_STATES[0].uv);
            let curIdx = (x * Farm.numBlocks.z + z) * 4;
            groundIndices.push(curIdx + 0);
            groundIndices.push(curIdx + 2);
            groundIndices.push(curIdx + 1);
            groundIndices.push(curIdx + 0);
            groundIndices.push(curIdx + 3);
            groundIndices.push(curIdx + 2);
        }
    }

    Farm.groundGeometry = new THREE.BufferGeometry();
    Farm.groundGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(groundVertices), 3));
    Farm.groundGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(groundNormals), 3));
    Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));
    Farm.groundGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(groundIndices), 1));

    Farm.texGroundBlock = textureLoader.load('assets/textures/ground.png');
    Farm.texGroundBlock.anisotropy = 1;
    Farm.texGroundBlock.magFilter = THREE.NearestFilter;
    Farm.texGroundBlock.minFilter = THREE.NearestFilter;

    Farm.texSoilBlock = textureLoader.load('assets/textures/soil.png');
    Farm.texSoilBlock.anisotropy = 1;
    Farm.texSoilBlock.magFilter = THREE.NearestFilter;
    Farm.texSoilBlock.minFilter = THREE.NearestFilter;


    let groundMaterial = new THREE.MeshLambertMaterial({
        map: Farm.texGroundBlock,
        side: THREE.DoubleSide,
    });

    Farm.groundMesh = new THREE.Mesh(Farm.groundGeometry, groundMaterial);

    Farm.scene.add(Farm.groundMesh);

    // Farm Sides

    let blocksPerSize = 16;
    let numSides = Math.floor(Farm.numBlocks.x / blocksPerSize);
    let geometry, texture, material, mesh;
    const matrix = new THREE.Matrix4();

    // Road
    geometry = new THREE.PlaneGeometry(Farm.blockSize * blocksPerSize, Farm.blockSize * blocksPerSize);
    geometry.rotateX(Math.PI / 2);
    geometry.rotateY(-Math.PI / 2);
    texture = textureLoader.load('assets/textures/road.png');
    material = new THREE.MeshLambertMaterial({
        map: texture,
        side: THREE.DoubleSide,
    });
    mesh = new THREE.InstancedMesh(geometry, material, numSides);
    for (let i = 0; i < numSides; i++) {
        matrix.makeTranslation(
            ((i + 0.5) * blocksPerSize - 0.5) * Farm.blockSize,
            0,
            ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize
        );
        mesh.setMatrixAt(i, matrix);
    }
    Farm.scene.add(mesh);

    // River
    geometry = new THREE.PlaneGeometry(Farm.blockSize * blocksPerSize, Farm.blockSize * blocksPerSize);
    geometry.rotateX(Math.PI / 2);
    texture = textureLoader.load('assets/textures/river.png');
    material = new THREE.MeshLambertMaterial({
        map: texture,
        side: THREE.DoubleSide,
    });
    mesh = new THREE.InstancedMesh(geometry, material, numSides);
    for (let i = 0; i < numSides; i++) {
        matrix.makeTranslation(
            ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize,
            0,
            ((i + 0.5) * blocksPerSize - 0.5) * Farm.blockSize
        );
        mesh.setMatrixAt(i, matrix);
    }
    Farm.scene.add(mesh);

    // Waiting Lists

    Farm.plantsAwaitingHarvest.init(Farm);
}

function initOverlays(Farm) {

    let texture, material, geometry;

    const textureLoader = new THREE.TextureLoader();

    // Ground Raycaster

    texture = textureLoader.load('assets/textures/white_overlay.png');
    Farm.blockLine = createOverlayMesh(texture);
    Farm.hudScene.add(Farm.blockLine);

    // Build Area

    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3));

    material = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, linewidth: 3 });

    Farm.buildAreaRect = new THREE.Line(geometry, material);
    Farm.hudScene.add(Farm.buildAreaRect);
}

function initEvents(Farm) {

    // Events

    window.addEventListener('resize', function() {
        onWindowResize(Farm);
    });

    window.addEventListener('mousemove', function(event) {
        onMouseMove(Farm, event);
    });

    window.addEventListener('mouseup', function(event) {
        onMouseUp(Farm, event);
    });

    window.addEventListener('mousedown', function(event) {
        onMouseDown(Farm, event);
    });

    window.addEventListener('keydown', function(event) {
        onKeyDown(Farm, event);
    });
}

function createOverlayMesh(texture) {

    var quad_uvs = [
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0
    ];

    var quad_indices = [
        0, 2, 1, 0, 3, 2
    ];
    var uvs = new Float32Array(quad_uvs);
    // Use the four vertices to draw the two triangles that make up the square.
    var indices = new Uint32Array(quad_indices)

    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    let material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });

    return new THREE.Mesh(geometry, material);
}