import * as THREE from 'three';

import { Text } from 'troika-three-text';

import * as Stats from 'stats.js';

import * as BufferGeometryUtils from './THREE/BufferGeometryUtils.js';
import { OrbitControls } from './THREE/OrbitControls.js';
import { GLTFLoader } from './THREE/GLTFLoader.js';
import { OutlinePass } from './THREE/OutlinePass.js';
import { EffectComposer } from './THREE/EffectComposer.js';
import { RenderPass } from './THREE/RenderPass.js';
import { ShaderPass } from './THREE/ShaderPass.js';
import { FXAAShader } from './THREE/FXAAShader.js';
import { Sky } from './THREE/Sky.js';

import { onWindowResize, onMouseUp, onMouseMove, onMouseDown, onKeyDown } from './events.js';
import { BLOCK, Block } from './block.js';
import { NineSlicePlane } from './nine_slice.js';
import { onUpdateWater } from './water_update.js';
import { initGrassBlades } from './grass_blades.js';
import * as Restaurant from './restaurant';
import { spawnCustomers } from './customer.js';

let GLTFModelLoader = new GLTFLoader();

function asyncModelLoader(url) {
    return new Promise((resolve, reject) => {
        GLTFModelLoader.load(url, data => resolve(data), null, reject);
    });
}

export function init(Farm) {

    // STATS

    Farm.stats = new Stats();
    Farm.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(Farm.stats.dom);

    // Init 3D Scene
    initScene(Farm);

    // Init 2D Scene
    initHudScene(Farm);

    // Load Buildings
    loadBuildingAssets(Farm);

    // Load Entities
    loadEntitiesAssets(Farm);

    // Init World
    initWorld(Farm);

    // Init Grass Blades
    initGrassBlades(Farm);

    // Init Overlays
    initOverlays(Farm);

    // Init Info Boxes
    initInfoBoxes(Farm);

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

    Farm.renderer = new THREE.WebGL1Renderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
    Farm.renderer.setPixelRatio(window.devicePixelRatio);
    Farm.renderer.setSize(window.innerWidth, window.innerHeight);
    Farm.renderer.setClearColor(0x000000, 0);
    Farm.renderer.autoClear = false;
    Farm.renderer.outputEncoding = THREE.sRGBEncoding;
    Farm.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    Farm.renderer.shadowMap.enabled = true;
    document.body.appendChild(Farm.renderer.domElement);

    //Farm.camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 0.1, 10000);
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
    Farm.shadowLight.shadow.normalBias = 0.0;

    // Render Passes
    Farm.composer = new EffectComposer(Farm.renderer);

    // Regular Pass
    Farm.renderPass = new RenderPass(Farm.scene, Farm.camera);
    Farm.composer.addPass(Farm.renderPass);

    // Outline Pass
    Farm.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), Farm.scene, Farm.camera);
    Farm.composer.addPass(Farm.outlinePass);

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

                    curBuilding.materials[j] = mesh.material;

                    curBuilding.meshes[j] = new THREE.InstancedMesh(curBuilding.geometries[j], curBuilding.materials[j], 0);

                    if (curBuilding.transparentTexture) {
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
                    }

                    curBuilding.meshes[j].receiveShadow = true;
                    curBuilding.meshes[j].castShadow = true;

                    Farm.groupSoilAndPlants.add(curBuilding.meshes[j]);
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

                    mesh.receiveShadow = true;
                    mesh.castShadow = true;

                    mesh.geometry.computeVertexNormals();
                    mesh.geometry.applyMatrix4(defaultBuildingTransform);

                    curBuilding.geometries[j] = mesh.geometry.clone();

                    curBuilding.materials[j] = mesh.material;

                    curBuilding.meshes[j] = mesh.clone();
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
        curEntity.numVariants = curEntity.models.length;

        for (let j = 0; j < curEntity.models.length; j++) {
            modelLoader.load(curEntity.models[j], function(gltf) {
                let mesh = gltf.scene.children[0];

                mesh.receiveShadow = true;
                mesh.castShadow = true;

                mesh.geometry.applyMatrix4(defaultEntityTransform);

                curEntity.geometries[j] = mesh.geometry.clone();

                curEntity.materials[j] = mesh.material;

                curEntity.meshes[j] = mesh.clone();
            });
        }
    }
}

async function initWorld(Farm) {

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
    Farm.texGroundBlock.anisotropy = 1;
    Farm.texGroundBlock.magFilter = THREE.NearestFilter;
    Farm.texGroundBlock.minFilter = THREE.NearestFilter;

    Farm.texSoilBlock = textureLoader.load('assets/textures/soil.png');
    Farm.texSoilBlock.encoding = THREE.sRGBEncoding;
    Farm.texSoilBlock.anisotropy = 1;
    Farm.texSoilBlock.magFilter = THREE.NearestFilter;
    Farm.texSoilBlock.minFilter = THREE.NearestFilter;

    let groundMaterial = new THREE.MeshStandardMaterial({
        map: Farm.texGroundBlock,
        side: THREE.DoubleSide,
        transparent: true,
    });

    let depthMaterial = new THREE.MeshDepthMaterial({
        side: THREE.DoubleSide,
        transparent: true,
    });

    let phongMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
    });

    //Farm.scene.overrideMaterial = phongMaterial;

    Farm.groundMesh = new THREE.Mesh(Farm.groundGeometry, groundMaterial);

    Farm.groundMesh.receiveShadow = true;

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
    texture.encoding = THREE.sRGBEncoding;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    material = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
    });
    mesh = new THREE.InstancedMesh(geometry, material, numSides);
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

    // River
    geometry = new THREE.PlaneGeometry(Farm.blockSize * blocksPerSize, Farm.blockSize * blocksPerSize);
    geometry.rotateX(Math.PI / 2);
    texture = textureLoader.load('assets/textures/river.png');
    texture.encoding = THREE.sRGBEncoding;
    material = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
    });
    mesh = new THREE.InstancedMesh(geometry, material, numSides);
    mesh.receiveShadow = true;
    for (let i = 0; i < numSides; i++) {
        matrix.makeTranslation(
            ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize,
            0,
            ((i + 0.5) * blocksPerSize - 0.5) * Farm.blockSize
        );
        mesh.setMatrixAt(i, matrix);
    }
    Farm.scene.add(mesh);

    // Parking Lot
    geometry = new THREE.PlaneGeometry(Farm.blockSize * blocksPerSize, Farm.blockSize * blocksPerSize);
    geometry.rotateX(Math.PI / 2);
    geometry.rotateY(-Math.PI / 2);
    texture = textureLoader.load('assets/textures/road_parking_lot.png');
    texture.encoding = THREE.sRGBEncoding;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    material = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.position.set(((0 + 0.5) * blocksPerSize - 0.5) * Farm.blockSize, 0, ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize);
    Farm.scene.add(mesh);

    // Bridge
    geometry = new THREE.PlaneGeometry(Farm.blockSize * blocksPerSize, Farm.blockSize * blocksPerSize);
    geometry.rotateX(Math.PI / 2);
    geometry.rotateY(-Math.PI / 2);
    texture = textureLoader.load('assets/textures/road_bridge.png');
    texture.encoding = THREE.sRGBEncoding;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    material = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.position.set(((-1 + 0.5) * blocksPerSize - 0.5) * Farm.blockSize, 0, ((-0.5) * blocksPerSize - 0.5) * Farm.blockSize);
    Farm.scene.add(mesh);

    // Restaurant
    await initRestaurant(Farm);

    // Waiting Lists

    Farm.plantsAwaitingHarvest.init(Farm);
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