import { zip } from "lodash";

import * as THREE from 'three';
import { Vector3, Vector2 } from "three";

import { Scheduler } from './scheduler.js';
import { WaitingList } from "./waiting_list.js";

export let Farm = {

    // FLAGS
    flagRenderPaths: true,

    // STATS
    stats: null,

    // Scheduler
    scheduler: new Scheduler(),

    // THREE -----------------------------------------------

    // 3D Scene
    camera: null,
    controls: null,
    scene: null,
    renderer: null,
    shadowLight: null,
    sun: null,
    composer: null,
    renderPass: null,
    outlinePass: null,

    // 2D HUD
    hudCamera: null,
    hudScene: null,

    groupBuildPalette: null,

    texBuildButton: null,
    texStopBuildButton: null,
    spriteBuildButton: null,

    texBuildPalette: null,
    spriteBuildPalette: null,

    texBuildPaletteSelect: null,
    spriteBuildPaletteSelect: null,

    ignoreNextMouseUp: false,

    // Building Raycaster
    mouseRaycaster: new THREE.Raycaster(),
    mousePos: new THREE.Vector2(),

    hoveringBlock: null,

    // Info box
    infoBoxRaycaster: new THREE.Raycaster(),
    groupInfoable: new THREE.Group(),

    materialInfoBoxBackground: null,

    visibleInfoBoxes: [],

    draggingInfoBoxStartPos: null,
    draggingInfoBoxStartMousePos: new THREE.Vector2(),
    draggingInfoBox: null,

    // Blocks -----------------------------------------------

    numBlocks: {
        x: 256,
        z: 256
    },

    blockSize: 10,

    groundMesh: null,
    groundGeometry: null,
    groundUVs: null,

    blockLine: null,

    texGroundBlock: null,
    texSoilBlock: null,

    // Building Area

    buildAreaRect: null,
    buildAreaCorner: null,

    buildAreaPoint1: null,
    buildAreaPoint2: null,

    buildBuildingSide: 0,
    buildBuildingMesh: null,
    buildBuildingMaterial: null,

    // BUILDINGS -----------------------------------------------

    // Meshes
    meshSoil: null,
    geometrySoil: null,
    materialSoil: null,

    // Ground
    blocks: {},

    // Buildings
    buildingIdx: 0,
    buildings: {},
    entityIdx: 0,
    entities: {},

    // GUI -----------------------------------------------

    LENS: {
        DEFAULT: 0,
        BUILD: 1,
        REMOVE: 2,
    },
    lens: 0,

    OVERLAY: {
        DEFAULT: 0,
        BUILD_AREA: 1,
        BUILD_PLANTS: 2,
        BUILD_BUILDINGS: 3,
        REMOVE_AREA: 4,
        REMOVE_PLANTS: 5,
        REMOVE_BUILDINGS: 6,
    },
    overlay: 0,

    buildPaletteSelect: 0,
    buildPaletteMap: {},

    // Waiting Lists

    plantTypeAwaitingMeshUpdate: new Set(),

    plantsAwaitingHarvest: new WaitingList(),

    // UTILS -----------------------------------------------

    magnetToBlocks: function(v) {
        return new Vector3(
            (Math.floor(v.x / this.blockSize - 0.5) + 0.5) * this.blockSize,
            v.y,
            (Math.floor(v.z / this.blockSize - 0.5) + 0.5) * this.blockSize
        );
    },

    posToBlocks: function(x, z) {
        return new Vector3(
            (Math.floor(x / this.blockSize + 0.5)),
            0,
            (Math.floor(z / this.blockSize + 0.5))
        );
    },

    posToScreenPos: function(v, camera) {

        let vector = v.clone();

        // map to normalized device coordinate (NDC) space
        vector.project(camera);

        return new Vector2(
            Math.round(vector.x * window.innerWidth / 2),
            Math.round(vector.y * window.innerHeight / 2)
        );
    },

    getCenterPoint: function(mesh) {
        var middle = new THREE.Vector3();
        var geometry = mesh.geometry;

        geometry.computeBoundingBox();

        middle.x = (geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2;
        middle.y = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2;
        middle.z = (geometry.boundingBox.max.z + geometry.boundingBox.min.z) / 2;

        mesh.localToWorld(middle);
        return middle;
    },

    // CONFIGS -----------------------------------------------

    // Ground States
    GROUND_STATES: [{
        uv: [
            0.0, 0.75,
            0.5, 0.75,
            0.5, 1.0,
            0.0, 1.0
        ],
    }, {
        uv: [
            0.0, 0.5,
            0.5, 0.5,
            0.5, 0.75,
            0.0, 0.75
        ],
    }, {
        uv: [
            0.0, 0.25,
            0.5, 0.25,
            0.5, 0.5,
            0.0, 0.5
        ],
    }, {
        uv: [
            0.0, 0.0,
            0.5, 0.0,
            0.5, 0.25,
            0.0, 0.25
        ],
    }, {
        uv: [
            0.5, 0.75,
            1.0, 0.75,
            1.0, 1.0,
            0.5, 1.0
        ],
    }],
    GROUND_STATES_NAMES: {
        WATER: 4
    },

    NORTH: 0,
    EAST: 1,
    SOUTH: 2,
    WEST: 3,

    // Build Palette

    buildingPaletteCategories: [{
        name: "ground",
    }, {
        name: "plants",
    }, {
        name: "buildings",
    }, {
        name: "remove",
    }],
    curBuildingPaletteCategories: 0,

    BUILDINGS: [{
        name: "Soil",
        category: "ground",
        price: 0,
        thumbnail: 'assets/textures/soil_thumbnail.png',
        models: [
            'assets/models/soil0.glb',
            'assets/models/soil1.glb',
            'assets/models/soil2.glb',
            'assets/models/soil3.glb',
        ],
    }, {
        name: "Water",
        category: "ground",
        price: 0,
        thumbnail: 'assets/textures/water_thumbnail.png',
        models: [],
    }, {
        name: "Carrot",
        category: "plants",
        price: 10,
        matureTime: 100,
        thumbnail: 'assets/textures/carrot_thumbnail.png',
        models: [
            'assets/models/carrot0.glb',
            'assets/models/carrot1.glb',
            'assets/models/carrot2.glb',
            'assets/models/carrot3.glb',
        ],
    }, {
        name: "Potato",
        category: "plants",
        price: 5,
        matureTime: 5000,
        thumbnail: 'assets/textures/potato_thumbnail.png',
        models: [
            'assets/models/potato0.glb',
            'assets/models/potato1.glb',
            'assets/models/potato2.glb',
            'assets/models/potato3.glb',
            'assets/models/potato4.glb',
        ],
    }, {
        name: "Corn",
        category: "plants",
        price: 20,
        matureTime: 5000,
        thumbnail: 'assets/textures/corn_thumbnail.png',
        models: [
            'assets/models/corn0.glb',
            'assets/models/corn1.glb',
            'assets/models/corn2.glb',
            'assets/models/corn3.glb',
            'assets/models/corn4.glb',
            'assets/models/corn5.glb',
            'assets/models/corn6.glb',
        ],
        transparentTexture: "assets/textures/corn.png",
    }, {
        name: "Worker's House",
        category: "buildings",
        price: 50,
        size: {
            x: 1,
            z: 1,
        },
        entities: [
            0
        ],
        thumbnail: 'assets/textures/workers_house_thumbnail.png',
        models: [
            'assets/models/workers_house0.glb',
        ],
    }, {
        name: "Big Worker's House",
        category: "buildings",
        price: 200,
        size: {
            x: 2,
            z: 2,
        },
        entities: [
            0,
            0,
            0,
            0,
            0
        ],
        thumbnail: 'assets/textures/big_workers_house_thumbnail.png',
        models: [
            'assets/models/big_workers_house0.glb',
        ],
    }, {
        name: "Fence",
        category: "buildings",
        price: 2,
        size: {
            x: 1,
            z: 1,
        },
        entities: [],
        thumbnail: 'assets/textures/fence_thumbnail.png',
        models: [
            'assets/models/fence0.glb',
        ],
    }, {
        name: "Stone Path",
        category: "buildings",
        price: 2,
        size: {
            x: 1,
            z: 1,
        },
        entities: [],
        thumbnail: 'assets/textures/stone_path_thumbnail.png',
        models: [
            'assets/models/stone_path0.glb',
        ],
    }, {
        name: "Remove All",
        category: "remove",
        price: 0,
        thumbnail: 'assets/textures/potato_thumbnail.png',
        models: [],
    }, {
        name: "Remove Soil",
        category: "remove",
        price: 0,
        thumbnail: 'assets/textures/soil_thumbnail.png',
        models: [],
    }, {
        name: "Remove Water",
        category: "remove",
        price: 0,
        thumbnail: 'assets/textures/water_thumbnail.png',
        models: [],
    }, {
        name: "Remove Plants",
        category: "remove",
        price: 0,
        thumbnail: 'assets/textures/carrot_thumbnail.png',
        models: [],
    }, {
        name: "Remove Buildings",
        category: "remove",
        price: 0,
        thumbnail: 'assets/textures/workers_house_thumbnail.png',
        models: [],
    }, ],

    // Entities
    ENTITIES: [{
        name: "Worker",
        models: ['assets/models/worker.glb'],
    }, ],
};