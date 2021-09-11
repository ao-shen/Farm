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

    // Raycaster
    mouseRaycaster: new THREE.Raycaster(),
    mousePos: new THREE.Vector2(),

    // Blocks -----------------------------------------------

    numBlocks: {
        x: 100,
        z: 100
    },

    blockSize: 10,

    blockMesh: null,
    blockLine: null,

    texGrassBlock: null,
    texSoilBlock: null,

    // Building Area

    buildAreaRect: null,
    buildAreaCorner: null,

    buildAreaPoint1: null,
    buildAreaPoint2: null,

    // BUILDINGS -----------------------------------------------

    // Meshes
    meshSoil: null,
    geometrySoil: null,
    materialSoil: null,

    // Ground
    blocks: {},

    // Buildings
    buildings: [],
    entities: [],

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

    // CONFIGS -----------------------------------------------

    // Build Palette
    BUILDINGS: [{
        name: "Soil",
        category: "ground",
        price: 0,
        thumbnail: 'assets/textures/soil_thumbnail.png',
        models: ['assets/models/soil.glb'],
    }, {
        name: "Carrot",
        category: "plants",
        price: 10,
        matureTime: 1000,
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
    }, ],

    // Entities
    ENTITIES: [{
        name: "Worker",
        models: ['assets/models/worker.glb'],
    }, ],
};