import * as THREE from './three/src/Three';

import { Text } from 'troika-three-text';

import * as Stats from 'stats.js';

import * as BufferGeometryUtils from './three_utils/BufferGeometryUtils.js';
import { OrbitControls } from './three_utils/OrbitControls.js';
import { GLTFLoader } from './three_utils/GLTFLoader.js';
import { OutlinePass } from './three_utils/OutlinePass.js';
import { EffectComposer } from './three_utils/EffectComposer.js';
import { RenderPass } from './three_utils/RenderPass.js';
import { ShaderPass } from './three_utils/ShaderPass.js';
import { FXAAShader } from './three_utils/FXAAShader.js';
import { Sky } from './three_utils/Sky.js';
import * as SkeletonUtils from './three_utils/SkeletonUtils';
import { GPUComputationRenderer } from './three_utils/GPUComputationRenderer';

import { onWindowResize, onMouseUp, onMouseMove, onMouseDown, onKeyDown, onKeyUp } from './events.js';
import { BLOCK, Block } from './block.js';
import { NineSlicePlane } from './nine_slice.js';
import { onUpdateWater } from './water_update.js';
import { initGrassBlades } from './grass_blades.js';
import * as Restaurant from './restaurant';
import { spawnCustomers } from './customer.js';
import { load } from './load_save.js';
import { leafVertexShader } from './shaders/leaf_vertex.js';
import { grassFragmentShader } from './shaders/grass_fragment.js';
import { leafFragmentShader } from './shaders/leaf_fragment.js';
import { ShaderChunk } from './three/src/Three';
import { leafDepthShader } from './shaders/leaf_depth.js';
import { plantVertexShader } from './shaders/plant_vertex.js';
import { groundFragmentShader } from './shaders/ground_fragment';
import { groundVertexShader } from './shaders/ground_vertex';
import { waterFragmentShader } from './shaders/water_fragment';

let GLTFModelLoader = new GLTFLoader();

function asyncModelLoader(url) {
    return new Promise((resolve, reject) => {
        GLTFModelLoader.load(url, data => resolve(data), null, reject);
    });
}

export async function init(Farm) {

    if (Farm.alreadyLoaded) {
        return;
    }
    Farm.alreadyLoaded = true;

    // STATS

    Farm.stats = new Stats();
    Farm.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(Farm.stats.dom);

    // Init 3D Scene
    initScene(Farm);

    // Init 2D Scene
    initHudScene(Farm);

    // Init Info Boxes
    initInfoBoxes(Farm);

    // Load Buildings
    loadBuildingAssets(Farm);

    // Load Entities
    loadEntitiesAssets(Farm);

    // Init World
    await initWorld(Farm);

    // Init Grass Blades
    initGrassBlades(Farm);

    // Init Overlays
    initOverlays(Farm);

    // Load the map before any events happen
    await load(Farm);

    // Init Events
    initEvents(Farm);

    // Start Water Updates
    setInterval(function() { onUpdateWater(Farm); }, 50);

    // Start Spawning Customers
    setTimeout(function() { spawnCustomers(Farm); }, 2000);

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
    Farm.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    Farm.renderer.shadowMap.enabled = true;
    document.body.appendChild(Farm.renderer.domElement);

    //Farm.camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 0.1, 100);
    Farm.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);

    Farm.renderer.getContext().getExtension('EXT_frag_depth');

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

    Farm.camera.position.set(-25, 60, 40);
    Farm.controls.target.set(35, 0, 40);
    Farm.controls.update();

    // Add Sky
    let sky = new Sky();
    sky.scale.setScalar(10000);
    Farm.scene.add(sky);

    let sun = new THREE.Vector3();

    const effectController = {
        turbidity: 10,
        rayleigh: 1,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.995,
        elevation: 30,
        azimuth: 220,
        exposure: 1
    };

    const uniforms = sky.material.uniforms;
    uniforms['turbidity'].value = effectController.turbidity;
    uniforms['rayleigh'].value = effectController.rayleigh;
    uniforms['mieCoefficient'].value = effectController.mieCoefficient;
    uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

    const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
    const theta = THREE.MathUtils.degToRad(effectController.azimuth);

    sun.setFromSphericalCoords(1, phi, theta);

    uniforms['sunPosition'].value.copy(sun);

    Farm.sun = sun;

    Farm.renderer.toneMappingExposure = effectController.exposure;

    Farm.effectController = effectController;

    // Environment 
    /*geometry = new THREE.PlaneGeometry(1000, 1000);
    material = new THREE.MeshBasicMaterial({ color: 0x0a400a, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotateX(Math.PI / 2);
    plane.position.set(0, -0.1, 0);
    Farm.scene.add(plane);
    const pmremGenerator = new THREE.PMREMGenerator(Farm.renderer);
    Farm.scene.environment = pmremGenerator.fromScene(Farm.scene).texture;
    Farm.scene.remove(plane);*/

    let hemiLight = new THREE.HemisphereLight(0xb1eeff, 0x60a060, 1.75);
    Farm.scene.add(hemiLight);

    // Shadow
    const light = new THREE.DirectionalLight(0xffeeb1, 2);
    light.position.set(sun.x, sun.y, sun.z);
    light.castShadow = true;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;

    const d = 128;

    light.shadow.camera.left = -d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = -d;
    light.shadow.camera.far = 50000;
    light.shadow.bias = 0.000;
    light.shadow.normalBias = 0.00;

    Farm.scene.add(light);
    Farm.scene.add(light.target);

    Farm.shadowLight = light;
    Farm.shadowLight.shadow.bias = -0.000001;
    Farm.shadowLight.shadow.normalBias = 0.1

    // Render Passes
    Farm.composer = new EffectComposer(Farm.renderer);

    // Regular Pass
    Farm.renderPass = new RenderPass(Farm.scene, Farm.camera);
    Farm.composer.addPass(Farm.renderPass);

    // Outline Pass
    Farm.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), Farm.scene, Farm.camera);
    Farm.composer.addPass(Farm.outlinePass);
    Farm.outlinePass.Farm = Farm;

    // FXAA Pass
    let effectFXAA = new ShaderPass(FXAAShader);
    effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth / window.devicePixelRatio, 1 / window.innerHeight / window.devicePixelRatio);
    Farm.composer.addPass(effectFXAA);

    // Groups

    Farm.groupSoilAndPlants.position.set(0, -1, 0);

    Farm.scene.add(Farm.groupSoilAndPlants);

    Farm.scene.add(Farm.groupInfoable);
    Farm.scene.add(Farm.groupNonInfoable);

    // Lights

    /*let dirLight1 = new THREE.DirectionalLight(0xffeeb1, 1);
    dirLight1.position.set(1, 0.5, 1);
    Farm.scene.add(dirLight1);

    let hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x080820, 0.5);
    Farm.scene.add(hemiLight);*/
    /*let dirLight2 = new THREE.DirectionalLight(0x443322);
    dirLight2.position.set(-1, -1, -1);
    Farm.scene.add(dirLight2);*/

    /*let ambientLight = new THREE.AmbientLight(0x222222, 2);
    Farm.scene.add(ambientLight);*/

    /*geometry = new THREE.SphereGeometry(2, 32, 16);
    material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(0, 0, 0);
    Farm.scene.add(sphere);*/
}

function initHudScene(Farm) {
    const textureLoader = new THREE.TextureLoader();
    let texture, material, geometry;

    Farm.hudScene = new THREE.Scene();

    Farm.hudCamera = new THREE.OrthographicCamera(-window.innerWidth * 0.5, window.innerWidth * 0.5, window.innerHeight * 0.5, -window.innerHeight * 0.5, 1, 1000);
    Farm.hudCamera.position.set(0, 0, 500);

    /*let hudAmbientLight = new THREE.AmbientLight(0x222222);
    Farm.hudScene.add(hudAmbientLight);*/

    // HUD

    Farm.groupBuildPalette = new THREE.Group();

    let calculatedBuildPaletteHeight = window.innerWidth / 8;

    // Build Button
    Farm.texBuildButton = textureLoader.load("assets/textures/button.png");
    Farm.texBuildButton.encoding = THREE.sRGBEncoding;
    Farm.texStopBuildButton = textureLoader.load("assets/textures/button_inverted.png");
    Farm.texStopBuildButton.encoding = THREE.sRGBEncoding;
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
    //Farm.textBuildButton.outlineWidth = 5;
    //Farm.textBuildButton.outlineColor = 0xFF9900;
    Farm.textBuildButton.color = 0x12101f;
    Farm.textBuildButton.anchorX = 'center';
    Farm.textBuildButton.anchorY = 'middle';
    Farm.textBuildButton.textAlign = 'center';
    Farm.textBuildButton.position.set(window.innerWidth * 0.5 - calculatedBuildPaletteHeight * 0.5, -window.innerHeight * 0.5 + calculatedBuildPaletteHeight * 0.5, 3);
    Farm.textBuildButton.name = "BuildButton";
    Farm.hudScene.add(Farm.textBuildButton);

    // Build Palette
    let texMoney = textureLoader.load("assets/textures/money.png");
    texMoney.encoding = THREE.sRGBEncoding;
    let materialMoney = new THREE.SpriteMaterial({ map: texMoney });

    textureLoader.load("assets/textures/palette.png", function(texture) {
        texture.encoding = THREE.sRGBEncoding;

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

    // Build Palette Category Tabs
    let texTab = textureLoader.load("assets/textures/palette_tab.png");
    texTab.encoding = THREE.sRGBEncoding;
    let texTabInactive = textureLoader.load("assets/textures/palette_tab_inactive.png");
    texTabInactive.encoding = THREE.sRGBEncoding;

    // Init Building Palette Categories
    let mapCategoryNameToIdx = {};
    for (let i = 0; i < Farm.buildingPaletteCategories.length; i++) {
        mapCategoryNameToIdx[Farm.buildingPaletteCategories[i].name] = i;
        Farm.buildingPaletteCategories[i].buildingTypes = [];
        Farm.buildingPaletteCategories[i].group = new THREE.Group();;
        Farm.groupBuildPalette.add(Farm.buildingPaletteCategories[i].group);
        Farm.buildingPaletteCategories[i].group.visible = false;

        material = new THREE.SpriteMaterial({ map: texTab });
        let spriteTab = Farm.buildingPaletteCategories[i].spriteTab = new THREE.Sprite(material);
        material = new THREE.SpriteMaterial({ map: texTabInactive });
        let spriteTabInactive = Farm.buildingPaletteCategories[i].spriteTabInactive = new THREE.Sprite(material);

        spriteTab.center.set(0.5, 0.5);
        spriteTab.scale.set(calculatedBuildPaletteHeight * 0.5, calculatedBuildPaletteHeight / 256 * 64, 1);
        spriteTab.position.set(-window.innerWidth * 0.5 + (i + 1) * calculatedBuildPaletteHeight * 0.51, -window.innerHeight * 0.5 + calculatedBuildPaletteHeight * 1.1, 2);
        spriteTab.name = "BuildPaletteTabCur";
        Farm.buildingPaletteCategories[i].group.add(spriteTab);
        spriteTabInactive.center.set(0.5, 0.5);
        spriteTabInactive.scale.set(calculatedBuildPaletteHeight * 0.5, calculatedBuildPaletteHeight / 256 * 64, 1);
        spriteTabInactive.position.set(-window.innerWidth * 0.5 + (i + 1) * calculatedBuildPaletteHeight * 0.51, -window.innerHeight * 0.5 + calculatedBuildPaletteHeight * 1.1, -2);
        spriteTabInactive.name = "BuildPaletteTab_" + i;
    }
    Farm.buildingPaletteCategories[0].group.visible = true;

    for (let i = 0; i < Farm.buildingPaletteCategories.length; i++) {
        for (let j = 0; j < Farm.buildingPaletteCategories.length; j++) {
            if (i != j) {
                Farm.buildingPaletteCategories[i].group.add(Farm.buildingPaletteCategories[j].spriteTabInactive.clone());
            }
        }
    }

    let selectSize = calculatedBuildPaletteHeight * 0.71;

    let thumbnailSize = calculatedBuildPaletteHeight * 0.69;
    let thumbnailY = -window.innerHeight * 0.5 + thumbnailSize * 0.58;

    Farm.selectSize = selectSize;
    Farm.thumbnailSize = thumbnailSize;
    Farm.thumbnailY = thumbnailY;

    textureLoader.load("assets/textures/green_overlay.png", function(texture) {
        texture.encoding = THREE.sRGBEncoding;

        Farm.texBuildPaletteSelect = texture;

        material = new THREE.SpriteMaterial({ map: Farm.texBuildPaletteSelect });

        Farm.spriteBuildPaletteSelect = new THREE.Sprite(material);
        Farm.spriteBuildPaletteSelect.center.set(0.5, 0.5);
        Farm.spriteBuildPaletteSelect.scale.set(selectSize, selectSize, 1);
        Farm.groupBuildPalette.add(Farm.spriteBuildPaletteSelect);
        Farm.spriteBuildPaletteSelect.position.set(0, 0, 2);
        Farm.spriteBuildPaletteSelect.name = "BuildPaletteSelect";
    });

    // Building Thumbnails

    for (let i = 0; i < Farm.BUILDINGS.length; i++) {
        let curBuilding = Farm.BUILDINGS[i];
        let category = Farm.buildingPaletteCategories[mapCategoryNameToIdx[curBuilding.category]];
        let categoryIdx = category.buildingTypes.length;

        category.buildingTypes.push(i);

        textureLoader.load(curBuilding.thumbnail, function(texture) {
            texture.encoding = THREE.sRGBEncoding;

            material = new THREE.SpriteMaterial({ map: texture });
            curBuilding.materialThumbnail = material;

            curBuilding.spriteThumbnail = new THREE.Sprite(material);
            curBuilding.spriteThumbnail.center.set(0.5, 0.5);
            curBuilding.spriteThumbnail.scale.set(thumbnailSize, thumbnailSize, 1);
            category.group.add(curBuilding.spriteThumbnail);
            curBuilding.spriteThumbnail.position.set(-window.innerWidth * 0.5 + 20 + (categoryIdx + 0.5) * (thumbnailSize + 20), thumbnailY, 2);
            curBuilding.spriteThumbnail.name = "BuildPalette_" + curBuilding.name;

            let strPrice = `${curBuilding.price}`;

            let totalPriceWidth = strPrice.length * 0.09 + 0.07 + 0.2;

            let textPrice = new Text();
            textPrice.text = strPrice;
            textPrice.font = 'assets/fonts/carrot.otf';
            textPrice.fontSize = 0.15;
            textPrice.color = 0xd0a060;
            textPrice.outlineWidth = 0.005;
            textPrice.outlineColor = 0x302010;
            textPrice.anchorX = 'center';
            textPrice.anchorY = 'middle';
            textPrice.textAlign = 'center';
            textPrice.position.set(-totalPriceWidth * 0.5 + strPrice.length * 0.09 * 0.5, 0.65, 4);
            textPrice.frustumCulled = false;
            textPrice.name = "BuildPalette_" + curBuilding.name;
            curBuilding.spriteThumbnail.add(textPrice);

            let spriteMoney = new THREE.Sprite(materialMoney);
            spriteMoney.center.set(0.5, 0.5);
            spriteMoney.scale.set(0.3, 0.3, 1);
            spriteMoney.position.set(+totalPriceWidth * 0.5 - 0.2 * 0.5, 0.65, 3);
            spriteMoney.name = "BuildPalette_" + curBuilding.name;
            curBuilding.spriteThumbnail.add(spriteMoney);
        });
    }

    // HUD Top

    const hudTopY = window.innerHeight * 0.5 - window.innerWidth / 16 * 0.25;
    const hudTopWidth = window.innerWidth;
    const hudTopHeight = hudTopWidth / 16 * 0.5;

    textureLoader.load("assets/textures/hud_top.png", function(texture) {
        texture.encoding = THREE.sRGBEncoding;

        Farm.texHudTop = texture;

        material = new THREE.SpriteMaterial({ map: Farm.texHudTop });

        Farm.spriteHudTop = new THREE.Sprite(material);
        Farm.spriteHudTop.center.set(0.5, 0.5);
        Farm.spriteHudTop.scale.set(hudTopWidth, hudTopHeight * 2, 1);
        Farm.groupBuildPalette.add(Farm.spriteHudTop);
        Farm.spriteHudTop.position.set(0, hudTopY - window.innerWidth / 16 * 0.25, 1);
        Farm.spriteHudTop.name = "HudTop";
        Farm.hudScene.add(Farm.spriteHudTop);
    });

    // HUD Money
    let textPrice = new Text();
    textPrice.text = `${Farm.money}`;
    textPrice.font = 'assets/fonts/carrot.otf';
    textPrice.fontSize = 24;
    textPrice.color = 0xd0a060;
    textPrice.outlineWidth = 0.5;
    textPrice.outlineColor = 0x302010;
    textPrice.anchorX = 'right';
    textPrice.anchorY = 'middle';
    textPrice.textAlign = 'right';
    textPrice.position.set(0.25 * hudTopWidth, hudTopY, 3);
    textPrice.frustumCulled = false;
    Farm.hudScene.add(textPrice);
    Farm.textMoney = textPrice;

    let spriteMoney = new THREE.Sprite(materialMoney);
    spriteMoney.center.set(0.5, 0.5);
    spriteMoney.scale.set(hudTopHeight * 1.2, hudTopHeight * 1.2, 1);
    spriteMoney.position.set(0.27 * hudTopWidth, hudTopY, 3);
    Farm.hudScene.add(spriteMoney);
}

function loadBuildingAssets(Farm) {

    let modelLoader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();

    let perlinMap = textureLoader.load('assets/textures/perlin_noise.png');
    Farm.perlinMap = perlinMap;

    // Load Models
    const defaultTransform = new THREE.Matrix4()
        .multiply(new THREE.Matrix4().makeScale(5, 5, 5));

    const defaultBuildingTransform = new THREE.Matrix4()
        .multiply(new THREE.Matrix4().makeScale(5, 5, 5));

    // Buildings
    for (let i = 0; i < Farm.BUILDINGS.length; i++) {

        let curBuilding = Farm.BUILDINGS[i];

        if (curBuilding.instanced) {
            curBuilding.geometries = [];
            curBuilding.materials = [];
            curBuilding.meshes = [];
            for (let j = 0; j < curBuilding.models.length; j++) {
                modelLoader.load(curBuilding.models[j], function(gltf) {
                    let mesh = gltf.scene.children[0];

                    curBuilding.geometries[j] = mesh.geometry.clone();

                    curBuilding.geometries[j].applyMatrix4(defaultBuildingTransform);

                    curBuilding.materials[j] = mesh.material;

                    curBuilding.meshes[j] = new THREE.InstancedMesh(curBuilding.geometries[j], curBuilding.materials[j], 0);

                    curBuilding.meshes[j].receiveShadow = true;
                    curBuilding.meshes[j].castShadow = true;

                    if (curBuilding.name == "Soil") {
                        Farm.groupSoilAndPlants.add(curBuilding.meshes[j]);
                    } else {
                        Farm.scene.add(curBuilding.meshes[j]);
                    }
                });
            }
        } else if (curBuilding.category == "plants") {

            let vertexShader = plantVertexShader;

            if (curBuilding.tree) {
                vertexShader = leafVertexShader;
            }

            // Load trees
            let leafTexture = textureLoader.load(curBuilding.texture);
            leafTexture.encoding = THREE.sRGBEncoding;
            leafTexture.flipY = false;

            let uniforms = THREE.UniformsUtils.merge([
                THREE.ShaderLib.phong.uniforms,
                { diffuse: { value: new THREE.Color(0xffffff) } },
                { time: { value: 0.0 } },
                { perlinMap: { value: null } },
                { specular: { value: new THREE.Color(0x000000) } },
                { shininess: { value: 0.01 } },
                { alphaTest: { value: 0.5 } },
            ]);

            let leafMaterial = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: vertexShader,
                fragmentShader: leafFragmentShader,
                side: THREE.DoubleSide,
                lights: true,
                transparent: true,
                alphaTest: 0.5,
                extensions: {
                    fragDepth: true,
                },
            });

            let depthUniforms = THREE.UniformsUtils.merge([
                THREE.ShaderLib.depth.uniforms,
                { time: { value: 0.0 } },
                { perlinMap: { value: null } },
                { alphaTest: { value: 0.5 } },
            ]);

            let leafDepthMaterial = new THREE.ShaderMaterial({
                uniforms: depthUniforms,
                vertexShader: vertexShader,
                fragmentShader: leafDepthShader,
                side: THREE.DoubleSide,
                alphaTest: 0.5,
                extensions: {
                    fragDepth: true,
                },
            });

            uniforms.map.value = leafTexture;
            leafMaterial.map = leafTexture;
            uniforms.perlinMap.value = Farm.perlinMap;
            leafMaterial.perlinMap = Farm.perlinMap;

            depthUniforms.map.value = leafTexture;
            leafDepthMaterial.map = leafTexture;
            depthUniforms.perlinMap.value = Farm.perlinMap;
            leafDepthMaterial.perlinMap = Farm.perlinMap;

            Farm.timeUpdateMaterials.push(leafMaterial);
            Farm.timeUpdateMaterials.push(leafDepthMaterial);

            curBuilding.geometries = [];
            curBuilding.materials = [];
            curBuilding.meshes = [];
            curBuilding.customDepthMaterial = [];
            curBuilding.numStages = curBuilding.models.length;
            for (let j = 0; j < curBuilding.models.length; j++) {
                modelLoader.load(curBuilding.models[j], function(gltf) {
                    let mesh = gltf.scene.children[0];

                    curBuilding.geometries[j] = mesh.geometry.clone();

                    curBuilding.geometries[j].applyMatrix4(defaultTransform);

                    //curBuilding.materials[j] = mesh.material;
                    curBuilding.materials[j] = leafMaterial;

                    curBuilding.meshes[j] = new THREE.InstancedMesh(curBuilding.geometries[j], curBuilding.materials[j], 0);

                    /*if (curBuilding.transparentTexture) {
                        let transparentTexture = textureLoader.load(curBuilding.transparentTexture);
                        transparentTexture.encoding = THREE.sRGBEncoding;
                        transparentTexture.flipY = false;
                        let depthMat = new THREE.MeshDepthMaterial({
                            depthPacking: THREE.RGBADepthPacking,
                            map: transparentTexture,
                            alphaTest: 0.5
                        });
                        curBuilding.customDepthMaterial[j] = depthMat;
                        curBuilding.meshes[j].customDepthMaterial = depthMat;
                    }*/
                    curBuilding.customDepthMaterial[j] = leafDepthMaterial;
                    curBuilding.meshes[j].customDepthMaterial = leafDepthMaterial;

                    curBuilding.meshes[j].receiveShadow = true;
                    curBuilding.meshes[j].castShadow = true;

                    Farm.groupSoilAndPlants.add(curBuilding.meshes[j]);
                });
            }
        } else if (curBuilding.category == "buildings") {
            curBuilding.geometries = [];
            curBuilding.materials = [];
            curBuilding.meshes = [];
            curBuilding.animations = [];
            curBuilding.numVariants = curBuilding.models.length;
            for (let j = 0; j < curBuilding.models.length; j++) {
                modelLoader.load(curBuilding.models[j], function(gltf) {
                    let mesh = gltf.scene.children[0];

                    if (mesh.children.length == 0) {

                        mesh.receiveShadow = true;
                        mesh.castShadow = true;

                        mesh.geometry.computeVertexNormals();
                        mesh.geometry.applyMatrix4(defaultBuildingTransform);

                        curBuilding.geometries[j] = mesh.geometry.clone();

                        curBuilding.materials[j] = mesh.material;

                        curBuilding.meshes[j] = mesh.clone();

                    } else {

                        let idx = 0;
                        while (mesh.children[idx].type != "SkinnedMesh") idx++;

                        mesh.children[idx].receiveShadow = true;
                        mesh.children[idx].castShadow = true;

                        mesh.children[idx].geometry.computeVertexNormals();

                        mesh.scale.set(5, 5, 5);

                        curBuilding.geometries[j] = mesh.children[idx].geometry.clone();
                        curBuilding.geometries[j].applyMatrix4(defaultBuildingTransform);

                        curBuilding.materials[j] = mesh.children[idx].material;

                        curBuilding.meshes[j] = mesh; //.clone();
                    }

                    curBuilding.animations[j] = [];

                    if (gltf.animations.length > 0) {
                        gltf.animations.forEach((clip) => { curBuilding.animations[j].push(clip); });
                    }
                });
            }
        }
    }

    // Configure buildPaletteMap
    for (let i = 0; i < Farm.buildingPaletteCategories.length; i++) {
        for (let j = 0; j < Farm.buildingPaletteCategories[i].buildingTypes.length; j++) {
            Farm.buildPaletteMap[Farm.BUILDINGS[Farm.buildingPaletteCategories[i].buildingTypes[j]].name] = {
                buildingType: Farm.buildingPaletteCategories[i].buildingTypes[j],
                buildingCategory: i,
                buildingCategoryIdx: j
            };
        }
    }

    // Configure buildBuilding
    Farm.buildBuildingMaterial = new THREE.MeshStandardMaterial({
        color: 0x00FF77,
        opacity: 0.5,
        transparent: true,
        side: THREE.DoubleSide,
    });

    // Load trees
    let leafTexture = textureLoader.load('assets/textures/tree_leaf.png');
    leafTexture.encoding = THREE.sRGBEncoding;

    let uniforms = THREE.UniformsUtils.merge([
        THREE.ShaderLib.phong.uniforms,
        { diffuse: { value: new THREE.Color(0xffffff) } },
        { time: { value: 0.0 } },
        { perlinMap: { value: null } },
        { specular: { value: new THREE.Color(0x000000) } },
        { shininess: { value: 0.01 } }
    ]);

    let leafMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: leafVertexShader,
        fragmentShader: leafFragmentShader,
        side: THREE.DoubleSide,
        lights: true,
        transparent: true,
        extensions: {
            fragDepth: true,
        },
    });

    let depthUniforms = THREE.UniformsUtils.merge([
        THREE.ShaderLib.depth.uniforms,
        { time: { value: 0.0 } },
        { perlinMap: { value: null } },
    ]);

    let leafDepthMaterial = new THREE.ShaderMaterial({
        uniforms: depthUniforms,
        vertexShader: leafVertexShader,
        fragmentShader: leafDepthShader,
        side: THREE.DoubleSide,
        extensions: {
            fragDepth: true,
        },
    });

    uniforms.map.value = leafTexture;
    leafMaterial.map = leafTexture;
    uniforms.perlinMap.value = perlinMap;
    leafMaterial.perlinMap = perlinMap;

    depthUniforms.perlinMap.value = perlinMap;
    leafDepthMaterial.perlinMap = perlinMap;

    Farm.leafMaterial = leafMaterial;
    Farm.leafDepthMaterial = leafDepthMaterial;

    Farm.timeUpdateMaterials.push(leafMaterial);
    Farm.timeUpdateMaterials.push(leafDepthMaterial);

    for (let i = 0; i < Farm.TREES.length; i++) {

        let curTree = Farm.TREES[i];

        modelLoader.load(curTree.model, function(gltf) {
            let mesh = gltf.scene.children[0];

            curTree.geometry = mesh.geometry.clone();

            curTree.geometry.applyMatrix4(defaultBuildingTransform);

            curTree.material = mesh.material;

            curTree.mesh = new THREE.InstancedMesh(curTree.geometry, curTree.material, 0);

            curTree.mesh.receiveShadow = true;
            curTree.mesh.castShadow = true;

            Farm.groupSoilAndPlants.add(curTree.mesh);
        });

        modelLoader.load(curTree.leafModel, function(gltf) {
            let mesh = gltf.scene.children[0];

            curTree.leafGeometry = mesh.geometry.clone();

            curTree.leafGeometry.applyMatrix4(defaultBuildingTransform);

            curTree.leafMaterial = Farm.leafMaterial; //new THREE.MeshBasicMaterial();

            curTree.leafMesh = new THREE.InstancedMesh(curTree.leafGeometry, curTree.leafMaterial, 0);
            curTree.leafMesh.customDepthMaterial = leafDepthMaterial;

            curTree.leafMesh.receiveShadow = true;
            curTree.leafMesh.castShadow = true;

            Farm.groupSoilAndPlants.add(curTree.leafMesh);
        });

        for (let j = 0; j < curTree.leaves.length; j++) {

            curTree.leaves[j].rotationalMatrix = new THREE.Matrix4();
            curTree.leaves[j].rotationalMatrix.makeRotationFromEuler(new THREE.Euler(
                curTree.leaves[j].rx * Math.PI / 180,
                curTree.leaves[j].ry * Math.PI / 180,
                curTree.leaves[j].rz * Math.PI / 180
            ));
            curTree.leaves[j].rotationalY = Math.atan2(curTree.leaves[j].z, -curTree.leaves[j].x) + Math.PI * 0.5;
        }

    }
}

function loadEntitiesAssets(Farm) {
    let modelLoader = new GLTFLoader();
    const defaultEntityTransform = new THREE.Matrix4()
        .makeRotationY(-Math.PI / 2)
        .multiply(new THREE.Matrix4().makeScale(5, 5, 5));

    for (let i = 0; i < Farm.ENTITIES.length; i++) {
        let curEntity = Farm.ENTITIES[i];

        curEntity.geometries = [];
        curEntity.materials = [];
        curEntity.meshes = [];
        curEntity.dummies = [];
        curEntity.originalMesh = [];
        curEntity.mixers = [];
        curEntity.skinnedMeshIndicies = [];
        curEntity.animations = [];
        curEntity.numVariants = curEntity.models.length;

        for (let j = 0; j < curEntity.models.length; j++) {
            modelLoader.load(curEntity.models[j], function(gltf) {
                let mesh = gltf.scene.children[0];

                if (mesh.children.length == 0) {

                    mesh.receiveShadow = true;
                    mesh.castShadow = true;

                    mesh.geometry.applyMatrix4(defaultEntityTransform);

                    curEntity.geometries[j] = mesh.geometry.clone();

                    curEntity.materials[j] = mesh.material;

                    curEntity.meshes[j] = mesh.clone();

                } else {

                    let idx = 0;
                    while (mesh.children[idx].type != "SkinnedMesh") idx++;

                    curEntity.skinnedMeshIndicies[j] = idx;

                    mesh.children[idx].receiveShadow = true;
                    mesh.children[idx].castShadow = true;

                    mesh.children[idx].geometry.computeVertexNormals();

                    mesh.scale.set(5, 5, 5);

                    curEntity.geometries[j] = mesh.children[idx].geometry.clone();
                    curEntity.geometries[j].applyMatrix4(defaultEntityTransform);

                    curEntity.materials[j] = mesh.children[idx].material;

                    if (curEntity.instanced) {

                        curEntity.dummies[j] = mesh.children[idx];
                        curEntity.originalMesh[j] = SkeletonUtils.clone(curEntity.dummies[j]);
                        curEntity.originalMesh[j].copy(curEntity.dummies[j]);

                        curEntity.meshes[j] = new THREE.InstancedSkinnedMesh(curEntity.originalMesh[j].geometry, curEntity.originalMesh[j].material, 0);

                        curEntity.mixers[j] = new THREE.AnimationMixer(curEntity.meshes[j]);

                        Farm.groupNonInfoable.add(curEntity.meshes[j]);

                    } else {

                        curEntity.meshes[j] = mesh; //.clone();
                    }
                }

                curEntity.animations[j] = [];

                if (gltf.animations.length > 0) {
                    gltf.animations.forEach((clip) => { curEntity.animations[j].push(clip); });
                }
            });
        }
    }
}

async function initWorld(Farm) {

    let geometry, texture, material, mesh;

    const textureLoader = new THREE.TextureLoader();

    // ground
    for (let state = 0; state <= 13; state++) {
        /*Farm.GROUND_STATES[state].uv[0] += 1 / 2048;
        Farm.GROUND_STATES[state].uv[1] += 1 / 2048;
        Farm.GROUND_STATES[state].uv[2] -= 1 / 2048;
        Farm.GROUND_STATES[state].uv[3] += 1 / 2048;
        Farm.GROUND_STATES[state].uv[4] -= 1 / 2048;
        Farm.GROUND_STATES[state].uv[5] -= 1 / 2048;
        Farm.GROUND_STATES[state].uv[6] += 1 / 2048;
        Farm.GROUND_STATES[state].uv[7] -= 1 / 2048;*/
        Farm.GROUND_STATES[state].uv[1] += 1 / 512;
        Farm.GROUND_STATES[state].uv[3] += 1 / 512;
    }
    for (let state = 14; state <= 19; state++) {
        Farm.GROUND_STATES[state].uv[1] += 4 / 1024;
        Farm.GROUND_STATES[state].uv[3] += 4 / 1024;
        Farm.GROUND_STATES[state].uv[5] += 2 / 1024;
        Farm.GROUND_STATES[state].uv[7] += 2 / 1024;
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

            Farm.blocks[x + ',' + z] = new Block(Farm, x, z);

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
    Farm.texGroundBlock.encoding = THREE.sRGBEncoding;
    Farm.texGroundBlock.magFilter = THREE.NearestFilter;
    Farm.texGroundBlock.minFilter = THREE.NearestFilter;

    Farm.texSoilBlock = textureLoader.load('assets/textures/soil.png');
    Farm.texSoilBlock.encoding = THREE.sRGBEncoding;
    Farm.texSoilBlock.anisotropy = 1;
    Farm.texSoilBlock.magFilter = THREE.NearestFilter;
    Farm.texSoilBlock.minFilter = THREE.NearestFilter;

    let uniforms = THREE.UniformsUtils.merge([
        THREE.ShaderLib.phong.uniforms,
        { diffuse: { value: new THREE.Color(0x00b000) } },
        { specular: { value: new THREE.Color(0x000000) } },
        { shininess: { value: 0.01 } },
        { alphaTest: { value: 0.2 } },
        { time: { value: 0.0 } },
        { target_pos_x: { value: 0.0 } },
        { target_pos_z: { value: 0.0 } },
        { perlinMap: { value: null } },
        { grassPropertiesMap: { value: null } },
        { grassEdgeMap: { value: null } },
        { shoreRampMap: { value: null } },
        { grassFarColor: { value: new THREE.Color(0x00b000) } },
        { grassCloseColor: { value: new THREE.Color(0x008000) } },
        //{ grassCloseColor: { value: new THREE.Color(0x1f1608) } },
        { waterDiffuse: { value: new THREE.Color(0x094fb8) } },
    ]);

    let groundMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: groundVertexShader,
        fragmentShader: groundFragmentShader,
        lights: true,
        transparent: true,
        alphaTest: 0.5,
        extensions: {
            fragDepth: true,
        },
    });

    const data = new Float32Array(256 * 256 * 4);
    data.fill(1 / 256);
    Farm.grassPropertiesMap = new THREE.DataTexture(data, 256, 256, THREE.RGBAFormat, THREE.FloatType);

    var perlinMap = textureLoader.load('assets/textures/perlin_noise.png');
    perlinMap.wrapS = THREE.RepeatWrapping;
    perlinMap.wrapT = THREE.RepeatWrapping;
    perlinMap.minFilter = THREE.LinearFilter;
    perlinMap.magFilter = THREE.LinearFilter;

    var grassEdgeMap = textureLoader.load('assets/textures/shore_ground.png');
    //grassEdgeMap.wrapS = THREE.RepeatWrapping;
    //grassEdgeMap.wrapT = THREE.RepeatWrapping;
    grassEdgeMap.minFilter = THREE.LinearFilter;
    grassEdgeMap.magFilter = THREE.LinearFilter;

    var shoreRampMap = textureLoader.load('assets/textures/shore_ramp.png');
    shoreRampMap.minFilter = THREE.LinearFilter;
    shoreRampMap.magFilter = THREE.LinearFilter;

    uniforms.perlinMap.value = perlinMap;
    groundMaterial.perlinMap = perlinMap;
    uniforms.grassPropertiesMap.value = Farm.grassPropertiesMap;
    groundMaterial.grassPropertiesMap = Farm.grassPropertiesMap;
    uniforms.grassEdgeMap.value = grassEdgeMap;
    groundMaterial.grassEdgeMap = grassEdgeMap;
    uniforms.shoreRampMap.value = shoreRampMap;
    groundMaterial.shoreRampMap = shoreRampMap;

    uniforms.map.value = Farm.texGroundBlock;
    groundMaterial.map = Farm.texGroundBlock;

    /*let groundMaterial = new THREE.MeshStandardMaterial({
        map: Farm.texGroundBlock,
        side: THREE.DoubleSide,
        transparent: true,
    });*/

    Farm.groundMesh = new THREE.Mesh(Farm.groundGeometry, groundMaterial);
    Farm.groundMaterial = groundMaterial;
    Farm.timeUpdateMaterials.push(groundMaterial);

    Farm.groundMesh.receiveShadow = true;

    Farm.scene.add(Farm.groundMesh);

    // Ground intersection mesh
    geometry = new THREE.PlaneGeometry(Farm.blockSize * Farm.numBlocks.x, Farm.blockSize * Farm.numBlocks.z);
    geometry.rotateX(Math.PI / 2);
    geometry.rotateY(-Math.PI / 2);
    material = new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
    });

    Farm.groundIntersectionMesh = new THREE.Mesh(geometry, material);
    Farm.groundIntersectionMesh.position.set(Farm.blockSize * (Farm.numBlocks.x - 1) / 2, -0.01, Farm.blockSize * (Farm.numBlocks.z - 1) / 2);
    Farm.scene.add(Farm.groundIntersectionMesh);
    Farm.groundIntersectionMesh.visible = false;

    // Farm Sides

    let blocksPerSize = 16;
    let numSides = Math.floor(Farm.numBlocks.x / blocksPerSize);
    const matrix = new THREE.Matrix4();

    // River
    uniforms = THREE.UniformsUtils.merge([
        THREE.ShaderLib.phong.uniforms,
        { diffuse: { value: new THREE.Color(0x094fb8) } },
        { specular: { value: new THREE.Color(0x000000) } },
        { shininess: { value: 0.01 } },
        { alphaTest: { value: 0.5 } },
        { time: { value: 0.0 } },
        { perlinMap: { value: null } },
        { waveMap: { value: null } },
    ]);

    let waterMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: groundVertexShader,
        fragmentShader: waterFragmentShader,
        lights: true,
        extensions: {
            fragDepth: true,
        },
    });

    texture = textureLoader.load('assets/textures/river.png');
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    uniforms.perlinMap.value = perlinMap;
    waterMaterial.perlinMap = perlinMap;
    uniforms.waveMap.value = texture;
    waterMaterial.waveMap = texture;

    Farm.waterMaterial = waterMaterial;
    Farm.timeUpdateMaterials.push(waterMaterial);

    geometry = new THREE.PlaneGeometry(Farm.blockSize * blocksPerSize, Farm.blockSize * blocksPerSize);
    geometry.rotateX(-Math.PI / 2);
    //texture.encoding = THREE.sRGBEncoding;
    mesh = new THREE.InstancedMesh(geometry, waterMaterial, numSides + 1);
    mesh.receiveShadow = true;
    for (let i = -1; i < numSides; i++) {
        matrix.makeTranslation(
            ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize, 0,
            ((i + 0.5) * blocksPerSize - 0.5) * Farm.blockSize
        );
        mesh.setMatrixAt(i + 1, matrix);
    }
    Farm.scene.add(mesh);

    // Road
    geometry = new THREE.PlaneGeometry(Farm.blockSize * blocksPerSize, Farm.blockSize * blocksPerSize);
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateY(-Math.PI / 2);
    texture = textureLoader.load('assets/textures/road.png');
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.5,
    });
    mesh = new THREE.InstancedMesh(geometry, material, numSides);
    mesh.receiveShadow = true;
    for (let i = 1; i < numSides; i++) {
        matrix.makeTranslation(
            ((i + 0.5) * blocksPerSize - 0.5) * Farm.blockSize,
            0.01,
            ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize
        );
        mesh.setMatrixAt(i, matrix);
    }
    Farm.scene.add(mesh);

    let sideGroundMaterial = groundMaterial.clone();
    Farm.sideGroundMaterial = sideGroundMaterial;
    Farm.timeUpdateMaterials.push(sideGroundMaterial);
    texture = textureLoader.load('assets/textures/road.png');
    texture.encoding = THREE.sRGBEncoding;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    sideGroundMaterial.uniforms.map.value = texture;
    sideGroundMaterial.map = texture;
    sideGroundMaterial.uniforms.perlinMap.value = perlinMap;
    sideGroundMaterial.perlinMap = perlinMap;
    sideGroundMaterial.uniforms.shoreRampMap.value = shoreRampMap;
    sideGroundMaterial.shoreRampMap = shoreRampMap;
    texture = textureLoader.load('assets/textures/road_ground.png');
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    sideGroundMaterial.uniforms.grassEdgeMap.value = texture;
    sideGroundMaterial.grassEdgeMap = texture;
    mesh = new THREE.InstancedMesh(geometry, sideGroundMaterial, numSides);
    mesh.receiveShadow = true;
    for (let i = 1; i < numSides; i++) {
        matrix.makeTranslation(
            ((i + 0.5) * blocksPerSize - 0.5) * Farm.blockSize,
            0,
            ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize
        );
        mesh.setMatrixAt(i, matrix);
    }
    Farm.scene.add(mesh);

    // Parking Lot
    geometry = new THREE.PlaneGeometry(Farm.blockSize * blocksPerSize, Farm.blockSize * blocksPerSize);
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateY(-Math.PI / 2);
    texture = textureLoader.load('assets/textures/road_parking_lot.png');
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.5,
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.position.set(((0 + 0.5) * blocksPerSize - 0.5) * Farm.blockSize, 0.01, ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize);
    Farm.scene.add(mesh);

    let sideParkingLotGroundMaterial = groundMaterial.clone();
    Farm.sideParkingLotGroundMaterial = sideParkingLotGroundMaterial;
    Farm.timeUpdateMaterials.push(sideParkingLotGroundMaterial);
    texture = textureLoader.load('assets/textures/road_parking_lot.png');
    texture.encoding = THREE.sRGBEncoding;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    sideParkingLotGroundMaterial.uniforms.map.value = texture;
    sideParkingLotGroundMaterial.map = texture;
    sideParkingLotGroundMaterial.uniforms.perlinMap.value = perlinMap;
    sideParkingLotGroundMaterial.perlinMap = perlinMap;
    sideParkingLotGroundMaterial.uniforms.shoreRampMap.value = shoreRampMap;
    sideParkingLotGroundMaterial.shoreRampMap = shoreRampMap;
    texture = textureLoader.load('assets/textures/road_parking_lot_ground.png');
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    Farm.grassEdgeMap = texture;
    sideParkingLotGroundMaterial.uniforms.grassEdgeMap.value = texture;
    sideParkingLotGroundMaterial.grassEdgeMap = texture;
    mesh = new THREE.Mesh(geometry, sideParkingLotGroundMaterial);
    mesh.receiveShadow = true;
    mesh.position.set(((0 + 0.5) * blocksPerSize - 0.5) * Farm.blockSize, 0, ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize);
    Farm.scene.add(mesh);

    // Bridge
    geometry = new THREE.PlaneGeometry(Farm.blockSize * blocksPerSize, Farm.blockSize * blocksPerSize);
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateY(-Math.PI / 2);
    texture = textureLoader.load('assets/textures/road_bridge.png');
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.5,
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.position.set(((-1 + 0.5) * blocksPerSize - 0.5) * Farm.blockSize, 0.01, ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize);
    Farm.scene.add(mesh);

    // Restaurant
    await initRestaurant(Farm);

    // Waiting Lists
    Farm.plantsAwaitingHarvest.init(Farm);

    // Connectible Groups
    for (let i = 0; i < Farm.BUILDINGS.length; i++) {
        let BUILDING = Farm.BUILDINGS[i];
        if (!Farm.connectibleGroupMap[BUILDING.connectibleGroup]) {
            Farm.connectibleGroupMap[BUILDING.connectibleGroup] = [];
        }
        Farm.connectibleGroupMap[BUILDING.connectibleGroup].push(i);
    }

    // Water Material
    /*Farm.waterMaterial = new THREE.MeshLambertMaterial({
        color: 0x094fb8
    });*/
    Farm.waterMaterial = waterMaterial;
    Farm.waterGeometry = new THREE.BufferGeometry();
    Farm.waterMesh = new THREE.Mesh(Farm.waterGeometry, Farm.waterMaterial);
    Farm.waterMesh.receiveShadow = true;
    Farm.waterMesh.frustumCulled = false;
    Farm.groupNonInfoable.add(Farm.waterMesh);
    Farm.waterVerticesBufferAttribute = new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3);
    Farm.waterIndicesBufferAttribute = new THREE.BufferAttribute(new Uint32Array([0, 0, 0]), 1);
    Farm.waterGeometry.setAttribute('position', Farm.waterVerticesBufferAttribute);
    Farm.waterGeometry.setIndex(Farm.waterIndicesBufferAttribute);
}

async function initRestaurant(Farm) {

    const defaultBuildingTransform = new THREE.Matrix4()
        .multiply(new THREE.Matrix4().makeScale(3.5, 3.5, 3.5));

    async function loadRestaurantMesh(url) {
        let gltf = await asyncModelLoader(url);
        let mesh = gltf.scene.children[0];

        mesh.receiveShadow = true;
        mesh.castShadow = true;

        mesh.geometry.computeVertexNormals();
        mesh.geometry.applyMatrix4(defaultBuildingTransform);

        return mesh.clone();
    }

    switch (Farm.restaurantType) {
        case 0:
            let restaurantStandMesh = await loadRestaurantMesh("assets/models/vegetable_stand0.glb");
            let restaurantStandInvMesh = await loadRestaurantMesh("assets/models/vegetable_stand_inv0.glb");
            Farm.restaurantObj = new Restaurant.Stand(Farm, restaurantStandMesh, restaurantStandInvMesh);
            break;
    }

    for (let i = 0; i < 5; i++) {
        Farm.parkingLot.push({
            x: 10.1,
            z: (-104 - i * 50) / 512 * 16 - 0.5,
            vehicle: null,
        });
        Farm.parkingLot.push({
            x: 4.9,
            z: (-104 - i * 50) / 512 * 16 - 0.5,
            vehicle: null,
        });
    }
}

function initOverlays(Farm) {

    let texture, material, geometry;

    const textureLoader = new THREE.TextureLoader();

    // Ground Raycaster

    texture = textureLoader.load('assets/textures/white_overlay.png');
    texture.encoding = THREE.sRGBEncoding;
    Farm.blockLine = createOverlayMesh(texture);
    Farm.hudScene.add(Farm.blockLine);

    // Build Area

    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3));

    material = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, linewidth: 3 });

    Farm.buildAreaRect = new THREE.Line(geometry, material);
    Farm.buildAreaRect.visible = false;
    Farm.hudScene.add(Farm.buildAreaRect);

    Farm.buildAreaCorner = new THREE.Vector3();
}

function initInfoBoxes(Farm) {

    let texture, material, geometry;

    const textureLoader = new THREE.TextureLoader();

    texture = textureLoader.load("assets/textures/info_box.png");
    texture.encoding = THREE.sRGBEncoding;

    Farm.materialInfoBoxBackground = new THREE.MeshBasicMaterial({ map: texture, color: 0xc0c0c0, transparent: true });

    /*let mesh = new NineSlicePlane(material, { width: 600, height: 300, border: 50 });

    mesh.position.set(0, 0, -50);

    //Farm.hudScene.add(mesh);*/

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

    window.addEventListener('keyup', function(event) {
        onKeyUp(Farm, event);
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