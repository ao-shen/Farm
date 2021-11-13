import * as THREE from './three/src/Three';
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

    groupSoilAndPlants: new THREE.Group(),

    // Compute Renderer
    gpuCompute: null,
    gpuComputeWidth: 0,

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

    texHudTop: null,
    spriteHudTop: null,

    textMoney: null,

    // Building Raycaster
    mouseRaycaster: new THREE.Raycaster(),
    mousePos: new THREE.Vector2(),

    hoveringBlock: null,

    // Info box
    infoBoxRaycaster: new THREE.Raycaster(),
    groupInfoable: new THREE.Group(),
    groupNonInfoable: new THREE.Group(),

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

    grassBladeMesh: null,
    grassBladeMaterial: null,
    grassBladeMeshNeedsUpdate: false,

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

    // Water Flow
    waterUpdateList: {},

    // BUILDINGS -----------------------------------------------

    // Meshes
    meshSoil: null,
    geometrySoil: null,
    materialSoil: null,

    timeUpdateMaterials: [],

    // Restaurant
    restaurantType: 0,
    restaurantObj: null,

    // Parking lot
    parkingLot: [],

    // Ground
    blocks: {},
    livestockedBlocks: {},

    // Buildings
    buildingIdx: 1,
    buildings: {},
    updatableBuildings: {},
    entityIdx: 1,
    entities: {},
    plantIdx: 1,
    plants: {},

    mixers: {},

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
        BUILD_LINE: 2,
        BUILD_SINGLE: 3,
        REMOVE_AREA: 4,
        REMOVE_PLANTS: 5,
        REMOVE_BUILDINGS: 6,
    },
    overlay: 0,

    buildPaletteSelect: 0,
    buildHeightSelect: 0,
    buildPaletteMap: {},

    // Waiting Lists

    plantTypeAwaitingMeshUpdate: new Set(),

    entityTypeAwaitingMeshUpdate: new Set(),

    plantsAwaitingHarvest: new WaitingList(),

    // GAME -----------------------------------------------

    money: 1000,

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
    GROUND_STATES: [{ // GRASS
        uv: [
            0.0, 0.75,
            0.125, 0.75,
            0.125, 1.0,
            0.0, 1.0
        ],
    }, { // CLEAR
        uv: [
            0.0, 0.0,
            0.125, 0.0,
            0.125, 0.25,
            0.0, 0.25
        ],
    }, { // BEGIN DIRT PATH
        uv: [
            0.25, 0.75,
            0.375, 0.75,
            0.375, 1.0,
            0.25, 1.0
        ],
    }, {
        uv: [
            0.375, 0.75,
            0.5, 0.75,
            0.5, 1.0,
            0.375, 1.0
        ],
    }, {
        uv: [
            0.5, 0.75,
            0.625, 0.75,
            0.625, 1.0,
            0.5, 1.0
        ],
    }, {
        uv: [
            0.625, 0.75,
            0.75, 0.75,
            0.75, 1.0,
            0.625, 1.0
        ],
    }, {
        uv: [
            0.75, 0.75,
            0.875, 0.75,
            0.875, 1.0,
            0.75, 1.0
        ],
    }, {
        uv: [
            0.875, 0.75,
            1.0, 0.75,
            1.0, 1.0,
            0.875, 1.0
        ],
    }, { // BEGIN ASPHALT ROAD
        uv: [
            0.25, 0.5,
            0.375, 0.5,
            0.375, 0.75,
            0.25, 0.75
        ],
    }, {
        uv: [
            0.375, 0.5,
            0.5, 0.5,
            0.5, 0.75,
            0.375, 0.75
        ],
    }, {
        uv: [
            0.5, 0.5,
            0.625, 0.5,
            0.625, 0.75,
            0.5, 0.75
        ],
    }, {
        uv: [
            0.625, 0.5,
            0.75, 0.5,
            0.75, 0.75,
            0.625, 0.75
        ],
    }, {
        uv: [
            0.75, 0.5,
            0.875, 0.5,
            0.875, 0.75,
            0.75, 0.75
        ],
    }, {
        uv: [
            0.875, 0.5,
            1.0, 0.5,
            1.0, 0.75,
            0.875, 0.75
        ],
    }, { // BEGIN TRENCH
        uv: [
            0.25, 0.25,
            0.375, 0.25,
            0.375, 0.5,
            0.25, 0.5
        ],
    }, {
        uv: [
            0.375, 0.25,
            0.5, 0.25,
            0.5, 0.5,
            0.375, 0.5
        ],
    }, {
        uv: [
            0.5, 0.25,
            0.625, 0.25,
            0.625, 0.5,
            0.5, 0.5
        ],
    }, {
        uv: [
            0.625, 0.25,
            0.75, 0.25,
            0.75, 0.5,
            0.625, 0.5
        ],
    }, {
        uv: [
            0.75, 0.25,
            0.875, 0.25,
            0.875, 0.5,
            0.75, 0.5
        ],
    }, {
        uv: [
            0.875, 0.25,
            1.0, 0.25,
            1.0, 0.5,
            0.875, 0.5
        ],
    }],
    GROUND_STATES_NAMES: {
        CLEAR: 1,
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
        name: "mechanical",
    }, {
        name: "remove",
    }],
    curBuildingPaletteCategories: 0,

    connectibleGroupMap: {},

    BUILDINGS: [{
        name: "Soil",
        category: "ground",
        build_mode: "area",
        instanced: true,
        price: 0,
        thumbnail: 'assets/textures/soil_thumbnail.png',
        models: [
            'assets/models/soil0.glb',
            'assets/models/soil1.glb',
            'assets/models/soil2.glb',
            'assets/models/soil3.glb',
        ],
    }, {
        name: "Trench",
        category: "ground",
        build_mode: "line",
        buildingObject: "BuildingWaterCarrier",
        connectible: true,
        leaky: 1,
        connectibleGroup: "water",
        groundStateMutator: [14, 15, 16, 17, 18, 19],
        instanced: true,
        visibleWaterCarrier: true,
        price: 10,
        size: {
            x: 1,
            z: 1,
        },
        thumbnail: 'assets/textures/trench_thumbnail.png',
        models: [
            'assets/models/trench0.glb',
            'assets/models/trench1.glb',
            'assets/models/trench2.glb',
            'assets/models/trench3.glb',
            'assets/models/trench4.glb',
            'assets/models/trench5.glb',
        ],
    }, {
        name: "Carrot",
        category: "plants",
        build_mode: "area",
        price: 10,
        sellPrice: 20,
        matureTime: 100,
        thumbnail: 'assets/textures/carrot_thumbnail.png',
        texture: 'assets/textures/carrot.png',
        models: [
            'assets/models/carrot0.glb',
            'assets/models/carrot1.glb',
            'assets/models/carrot2.glb',
            'assets/models/carrot3.glb',
        ],
    }, {
        name: "Potato",
        category: "plants",
        build_mode: "area",
        price: 5,
        sellPrice: 10,
        matureTime: 5000,
        thumbnail: 'assets/textures/potato_thumbnail.png',
        texture: 'assets/textures/potato.png',
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
        build_mode: "area",
        price: 20,
        sellPrice: 40,
        matureTime: 5000,
        thumbnail: 'assets/textures/corn_thumbnail.png',
        texture: 'assets/textures/corn.png',
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
        build_mode: "single",
        buildingObject: "BuildingWorkersHouse",
        price: 50,
        infoable: true,
        inventorySlots: 5,
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
        build_mode: "single",
        buildingObject: "BuildingWorkersHouse",
        price: 200,
        infoable: true,
        inventorySlots: 30,
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
        build_mode: "line",
        buildingObject: "BuildingWall",
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
        name: "Concrete Slab",
        category: "buildings",
        build_mode: "area",
        buildingObject: "BuildingPath",
        instanced: true,
        onWater: true,
        connectibleGroup: "path",
        price: 2,
        size: {
            x: 1,
            z: 1,
        },
        entities: [],
        thumbnail: 'assets/textures/concrete_slab_thumbnail.png',
        models: [
            'assets/models/stone_path0.glb',
        ],
    }, {
        name: "Storage",
        category: "buildings",
        build_mode: "single",
        buildingObject: "Storage",
        price: 100,
        infoable: true,
        inventorySlots: 100,
        size: {
            x: 2,
            z: 2,
        },
        entities: [],
        thumbnail: 'assets/textures/storage_thumbnail.png',
        models: [
            'assets/models/storage0.glb',
            'assets/models/storage1.glb',
            'assets/models/storage2.glb',
            'assets/models/storage3.glb',
            'assets/models/storage4.glb',
        ],
    }, {
        name: "Dirt Path",
        category: "ground",
        build_mode: "line",
        buildingObject: "BuildingPath",
        connectible: true,
        connectibleGroup: "path",
        noMesh: true,
        groundStateMutator: [2, 3, 4, 5, 6, 7],
        noPreviewMesh: true,
        price: 2,
        thumbnail: 'assets/textures/dirt_path_thumbnail.png',
        models: [],
    }, {
        name: "Asphalt Road",
        category: "ground",
        build_mode: "line",
        buildingObject: "BuildingPath",
        connectible: true,
        connectibleGroup: "path",
        noMesh: true,
        groundStateMutator: [8, 9, 10, 11, 12, 13],
        noPreviewMesh: true,
        price: 10,
        thumbnail: 'assets/textures/asphalt_road_thumbnail.png',
        models: [],
    }, {
        name: "Apple Tree",
        category: "plants",
        build_mode: "single",
        tree: true,
        price: 50,
        sellPrice: 10,
        matureTime: 1000,
        size: {
            x: 2,
            z: 2,
        },
        thumbnail: 'assets/textures/apple_thumbnail.png',
        texture: 'assets/textures/apple.png',
        models: [
            'assets/models/apple0.glb',
            'assets/models/apple1.glb',
            'assets/models/apple2.glb',
            'assets/models/apple3.glb',
        ],
        customInstances: [
            { amount: 20, isLeafRotator: true },
            { amount: 20, isLeafRotator: true },
            { amount: 10, isLeafTranslator: true },
            { amount: 10, isLeafTranslator: true },
        ]
    }, {
        name: "Orange Tree",
        category: "plants",
        build_mode: "single",
        tree: true,
        price: 75,
        sellPrice: 15,
        matureTime: 1000,
        size: {
            x: 2,
            z: 2,
        },
        thumbnail: 'assets/textures/orange_thumbnail.png',
        texture: 'assets/textures/orange.png',
        models: [
            'assets/models/apple0.glb',
            'assets/models/orange1.glb',
            'assets/models/orange2.glb',
            'assets/models/orange3.glb',
        ],
        customInstances: [
            { amount: 20, isLeafRotator: true },
            { amount: 20, isLeafRotator: true },
            { amount: 10, isLeafTranslator: true },
            { amount: 10, isLeafTranslator: true },
        ]
    }, {
        name: "Water Wheel Pump",
        category: "buildings",
        build_mode: "single",
        price: 200,
        inventorySlots: 0,
        allowClipConnectibleGroup: ["aquaduct"],
        limitSide: [true, false, false, false],
        requireRiver: true,
        waterSourceForConnectibleGroup: { "aquaduct": true },
        size: {
            x: 2,
            z: 1,
        },
        center: {
            x: -0.5,
            z: 0,
        },
        entities: [],
        thumbnail: 'assets/textures/waterwheel_pump_thumbnail.png',
        models: [
            'assets/models/water_wheel.glb',
        ],
    }, {
        name: "Aquaduct",
        category: "ground",
        build_mode: "line",
        buildingObject: "BuildingWaterCarrier",
        connectible: true,
        connectibleGroup: "aquaduct",
        instanced: true,
        visibleWaterCarrier: true,
        price: 50,
        size: {
            x: 1,
            z: 1,
        },
        thumbnail: 'assets/textures/aquaduct_thumbnail.png',
        models: [
            'assets/models/aquaduct0.glb',
            'assets/models/aquaduct1.glb',
            'assets/models/aquaduct2.glb',
            'assets/models/aquaduct3.glb',
            'assets/models/aquaduct4.glb',
            'assets/models/aquaduct5.glb',
        ],
    }, {
        name: "Piped Aquaduct",
        category: "ground",
        build_mode: "line",
        buildingObject: "BuildingWaterCarrier",
        connectible: true,
        leaky: 0.5,
        connectibleGroup: "aquaduct",
        instanced: true,
        visibleWaterCarrier: true,
        price: 50,
        size: {
            x: 1,
            z: 1,
        },
        thumbnail: 'assets/textures/aquaduct_piped_thumbnail.png',
        models: [
            'assets/models/aquaduct_piped0.glb',
            'assets/models/aquaduct_piped1.glb',
            'assets/models/aquaduct_piped2.glb',
            'assets/models/aquaduct_piped3.glb',
            'assets/models/aquaduct_piped4.glb',
            'assets/models/aquaduct5.glb',
        ],
    }, {
        name: "Barn",
        category: "buildings",
        build_mode: "single",
        buildingObject: "BuildingBarn",
        price: 500,
        infoable: true,
        inventorySlots: 30,
        size: {
            x: 3,
            z: 3,
        },
        entities: [
            3,
            3,
            3,
            3,
        ],
        thumbnail: 'assets/textures/barn_thumbnail.png',
        models: [
            'assets/models/barn0.glb',
        ],
    }, {
        name: "Waterwheel",
        category: "mechanical",
        build_mode: "single",
        buildingObject: "MechanicalRotator",
        mechanicalSource: true,
        rotatorOffset: new THREE.Vector3(-1.27625, 2, 0),
        instanced: true,
        noMesh: true,
        price: 200,
        limitSide: [true, false, false, false],
        requireRiver: true,
        size: {
            x: 1,
            z: 1,
        },
        thumbnail: 'assets/textures/waterwheel_thumbnail.png',
        models: [
            'assets/models/waterwheel_wheel.glb',
            'assets/models/waterwheel_base.glb',
        ],
    }, {
        name: "Horizontal Axle",
        category: "mechanical",
        build_mode: "single",
        buildingObject: "MechanicalRotator",
        mechanicalAxle: true,
        instanced: true,
        noMesh: true,
        price: 50,
        limitSide: [true, true, false, false],
        hasHeight: true,
        size: {
            x: 1,
            z: 1,
        },
        thumbnail: 'assets/textures/axle_hor_thumbnail.png',
        models: [
            'assets/models/axle_hor_rotator.glb',
            'assets/models/axle_hor_base.glb',
        ],
    }, {
        name: "Vertical Axle",
        category: "mechanical",
        build_mode: "single",
        buildingObject: "MechanicalRotator",
        mechanicalAxle: true,
        instanced: true,
        noMesh: true,
        price: 50,
        hasHeight: true,
        size: {
            x: 1,
            z: 1,
        },
        thumbnail: 'assets/textures/axle_ver_thumbnail.png',
        models: [
            'assets/models/axle_ver.glb',
        ],
    }, {
        name: "Gear 2m",
        category: "mechanical",
        build_mode: "single",
        buildingObject: "MechanicalRotator",
        mechanicalGear: true,
        instanced: true,
        noMesh: true,
        price: 50,
        hasHeight: true,
        center: {
            x: 0,
            z: -0.3,
        },
        size: {
            x: 1,
            z: 1,
        },
        thumbnail: 'assets/textures/gear_2m_thumbnail.png',
        models: [
            'assets/models/gear_2m.glb',
        ],
    }, {
        name: "Gear 6m",
        category: "mechanical",
        build_mode: "single",
        buildingObject: "MechanicalRotator",
        mechanicalGear: true,
        instanced: true,
        noMesh: true,
        price: 50,
        hasHeight: true,
        center: {
            x: 0,
            z: -0.3,
        },
        size: {
            x: 1,
            z: 1,
        },
        thumbnail: 'assets/textures/gear_6m_thumbnail.png',
        models: [
            'assets/models/gear_6m.glb',
        ],
    }, {
        name: "Remove All",
        category: "remove",
        build_mode: "remove",
        price: 0,
        thumbnail: 'assets/textures/potato_thumbnail.png',
        models: [],
    }, {
        name: "Remove Soil",
        category: "remove",
        build_mode: "remove",
        price: 0,
        thumbnail: 'assets/textures/soil_thumbnail.png',
        models: [],
    }, {
        name: "Remove Water",
        category: "remove",
        build_mode: "remove",
        price: 0,
        thumbnail: 'assets/textures/water_thumbnail.png',
        models: [],
    }, {
        name: "Remove Plants",
        category: "remove",
        build_mode: "remove",
        price: 0,
        thumbnail: 'assets/textures/carrot_thumbnail.png',
        models: [],
    }, {
        name: "Remove Buildings",
        category: "remove",
        build_mode: "remove",
        price: 0,
        thumbnail: 'assets/textures/workers_house_thumbnail.png',
        models: [],
    }, ],

    // Entities
    ENTITIES: [{
        name: "Worker",
        inventorySlots: 1,
        infoable: true,
        movementSpeed: 2,
        models: ['assets/models/worker.glb'],
    }, {
        name: "Customer",
        inventorySlots: 1,
        movementSpeed: 1,
        models: ['assets/models/worker.glb'],
    }, {
        name: "Car",
        inventorySlots: 1,
        movementSpeed: 4,
        entitySlots: 2,
        meshRotationOffset: Math.PI,
        models: [
            'assets/models/car0.glb',
            'assets/models/car1.glb',
            'assets/models/car2.glb',
            'assets/models/car3.glb',
            'assets/models/car4.glb',
        ],
    }, {
        name: "Cattle",
        inventorySlots: 0,
        movementSpeed: 0.1,
        instanced: true,
        models: ['assets/models/cattle0.glb'],
    }, ],

    // Tree models
    TREES: [{
        model: 'assets/models/tree_trunk0.glb',
        leafModel: 'assets/models/tree_leaf.glb',
        leaves: [
            { x: 0.952564, y: 3.20367, z: -0.316133, rx: 13.4214, ry: 4.68841, rz: 36.9299, s: 1 },
            { x: 0.65893, y: 2.8779, z: 0.951614, rx: -31.0819, ry: -4.54949, rz: 19.3118, s: 1 },
            { x: -0.574136, y: 2.94996, z: 0.745024, rx: -29.446, ry: 4.82411, rz: -20.0928, s: 1 },
            { x: -0.98264, y: 3.156, z: -0.311639, rx: 8.37496, ry: 1.54904, rz: -36.6947, s: 1 },
            { x: -0.016184, y: 3.03883, z: -1.17517, rx: 37.2834, ry: 0.455456, rz: -0.783533, s: 1 },
            { x: 0, y: 4.04132, z: 0, rx: 0, ry: 0, rz: 0, s: 1 },
        ],
    }, ]
};