import * as THREE from 'three';

import { Plant } from './plant.js';
import { BLOCK, Block } from './block.js';
import * as BuildingObjects from './building.js';
import { updateConnectibleConnections } from './water_update.js';


export function onWindowResize(Farm) {

    Farm.camera.aspect = window.innerWidth / window.innerHeight;
    Farm.camera.updateProjectionMatrix();

    Farm.renderer.setSize(window.innerWidth, window.innerHeight);

}

export function onMouseMove(Farm, event) {

    Farm.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
    Farm.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;

}

export function onMouseUp(Farm, event) {

    Farm.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
    Farm.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (Farm.ignoreNextMouseUp) {
        Farm.ignoreNextMouseUp = false;
        return;
    }

    switch (event.button) {
        case 0:
            if (Farm.draggingInfoBox) {
                Farm.draggingInfoBox = null;
            } else if (Farm.buildAreaPoint1 == null || Farm.buildAreaPoint2 == null) {

            } else if (Farm.overlay == Farm.OVERLAY.BUILD_AREA) {
                switch (Farm.BUILDINGS[Farm.buildPaletteSelect].name) {
                    case "Soil":
                        createNewSoil(Farm);
                        break;
                    default:
                        switch (Farm.BUILDINGS[Farm.buildPaletteSelect].category) {
                            case "plants":
                                createNewPlant(Farm);
                                break;
                            case "buildings":
                                createAreaOfNewBuildings(Farm);
                                break;
                        }
                        break;
                }
                Farm.overlay = Farm.OVERLAY.DEFAULT;
                Farm.buildAreaRect.visible = false;
            } else if (Farm.overlay == Farm.OVERLAY.BUILD_LINE) {
                if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Trench") {
                    createNewTrench(Farm);
                } else {
                    createAreaOfNewBuildings(Farm);
                }
                Farm.overlay = Farm.OVERLAY.DEFAULT;
                Farm.buildAreaRect.visible = false;
                if (Farm.buildBuildingMesh != null) {
                    Farm.buildBuildingMesh.visible = false;
                }
            } else if (Farm.overlay == Farm.OVERLAY.BUILD_SINGLE) {
                createSingleNewBuilding(Farm);
            } else if (Farm.lens == Farm.LENS.REMOVE) {
                remove(Farm);
                Farm.overlay = Farm.OVERLAY.DEFAULT;
                Farm.buildAreaRect.visible = false;
            } else {
                Farm.overlay = Farm.OVERLAY.DEFAULT;
                Farm.buildAreaRect.visible = false;
            }
            Farm.buildAreaPoint1 = null;
            Farm.buildAreaPoint2 = null;
            break;
        case 1:
            break;
        case 2:
            break;
    }
}

export function onMouseDown(Farm, event) {

    Farm.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
    Farm.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;

    switch (event.button) {
        case 0:
            Farm.mouseRaycaster.setFromCamera(Farm.mousePos, Farm.hudCamera);

            let intersects = Farm.mouseRaycaster.intersectObjects(Farm.hudScene.children, true);

            for (let intersect of intersects) {

                if (!intersect.object.visible || !intersect.object.parent.visible) {
                    continue;
                }

                if (intersect.object.name == "BuildButton") {

                    if (Farm.lens == Farm.LENS.DEFAULT) {
                        Farm.lens = Farm.LENS.BUILD;
                        Farm.textBuildButton.text = 'CANCEL';
                        Farm.textBuildButton.fontSize = 35;
                        Farm.textBuildButton.outlineColor = 0x0099FF;
                        Farm.spriteBuildButton.material.map = Farm.texStopBuildButton;
                        Farm.groupBuildPalette.visible = true;
                        Farm.spriteBuildPaletteSelect.position.set(-window.innerWidth * 0.5 + 20 + (Farm.buildPaletteSelect + 0.5) * (Farm.thumbnailSize + 20), Farm.thumbnailY, 2);

                        Farm.buildingPaletteCategories[Farm.curBuildingPaletteCategories].group.visible = false;

                        Farm.curBuildingPaletteCategories = 0;

                        Farm.buildingPaletteCategories[Farm.curBuildingPaletteCategories].group.visible = true;

                        let buildingPaletteInfo = Farm.buildPaletteMap[Farm.BUILDINGS[Farm.buildingPaletteCategories[Farm.curBuildingPaletteCategories].buildingTypes[0]].name];
                        Farm.buildPaletteSelect = buildingPaletteInfo.buildingType;
                        let categoryIdx = buildingPaletteInfo.buildingCategoryIdx;
                        Farm.spriteBuildPaletteSelect.position.set(-window.innerWidth * 0.5 + 20 + (categoryIdx + 0.5) * (Farm.thumbnailSize + 20), Farm.thumbnailY, 2);

                        updateBuildPaletteSelect(Farm);

                        Farm.ignoreNextMouseUp = true;
                        return;
                    } else if (Farm.lens == Farm.LENS.BUILD || Farm.lens == Farm.LENS.REMOVE) {
                        Farm.lens = Farm.LENS.DEFAULT;
                        Farm.overlay = Farm.OVERLAY.DEFAULT;
                        Farm.textBuildButton.text = 'BUILD';
                        Farm.textBuildButton.fontSize = 45;
                        Farm.textBuildButton.outlineColor = 0xFF9900;
                        Farm.spriteBuildButton.material.map = Farm.texBuildButton;
                        Farm.groupBuildPalette.visible = false;
                        Farm.buildPaletteSelect = 0;

                        updateBuildingMeshPreview(Farm);
                        Farm.buildAreaRect.visible = false;

                        Farm.ignoreNextMouseUp = true;
                        return;
                    }
                } else if (intersect.object.name.startsWith("InfoBox_")) {
                    let infoBoxOwnerName = intersect.object.name.substring("InfoBox_".length)
                    let curInfoBox, infoBoxOwnerIdx;
                    if (infoBoxOwnerName.startsWith("Building_")) {
                        infoBoxOwnerIdx = infoBoxOwnerName.substring("Building_".length);
                        curInfoBox = Farm.buildings[infoBoxOwnerIdx].infoBox;
                    } else if (infoBoxOwnerName.startsWith("Entity_")) {
                        infoBoxOwnerIdx = infoBoxOwnerName.substring("Entity_".length);
                        curInfoBox = Farm.entities[infoBoxOwnerIdx].infoBox;
                    } else {
                        continue;
                    }
                    Farm.draggingInfoBox = curInfoBox;
                    Farm.draggingInfoBoxStartPos = curInfoBox.pos.clone();
                    Farm.draggingInfoBoxStartMousePos = Farm.mousePos.clone();

                    return;
                } else if (Farm.lens == Farm.LENS.BUILD || Farm.lens == Farm.LENS.REMOVE) {
                    if (intersect.object.name.startsWith("BuildPalette_")) {

                        let buildingPaletteInfo = Farm.buildPaletteMap[intersect.object.name.substring("BuildPalette_".length)];
                        Farm.buildPaletteSelect = buildingPaletteInfo.buildingType;
                        let categoryIdx = buildingPaletteInfo.buildingCategoryIdx;
                        Farm.spriteBuildPaletteSelect.position.set(-window.innerWidth * 0.5 + 20 + (categoryIdx + 0.5) * (Farm.thumbnailSize + 20), Farm.thumbnailY, 2);

                        updateBuildPaletteSelect(Farm);
                        updateBuildingMeshPreview(Farm);

                        Farm.ignoreNextMouseUp = true;
                        return;
                    } else if (intersect.object.name == "BuildPaletteTabCur") {
                        continue;
                    } else if (intersect.object.name.startsWith("BuildPaletteTab_")) {

                        Farm.buildingPaletteCategories[Farm.curBuildingPaletteCategories].group.visible = false;

                        Farm.curBuildingPaletteCategories = intersect.object.name.substring("BuildPaletteTab_".length);

                        Farm.buildingPaletteCategories[Farm.curBuildingPaletteCategories].group.visible = true;

                        let buildingPaletteInfo = Farm.buildPaletteMap[Farm.BUILDINGS[Farm.buildingPaletteCategories[Farm.curBuildingPaletteCategories].buildingTypes[0]].name];
                        Farm.buildPaletteSelect = buildingPaletteInfo.buildingType;
                        let categoryIdx = buildingPaletteInfo.buildingCategoryIdx;
                        Farm.spriteBuildPaletteSelect.position.set(-window.innerWidth * 0.5 + 20 + (categoryIdx + 0.5) * (Farm.thumbnailSize + 20), Farm.thumbnailY, 2);

                        updateBuildPaletteSelect(Farm);

                        Farm.ignoreNextMouseUp = true;
                        return;
                    }
                }
            }

            if (Farm.lens == Farm.LENS.DEFAULT) {
                Farm.infoBoxRaycaster.setFromCamera(Farm.mousePos, Farm.camera);

                const intersects = Farm.infoBoxRaycaster.intersectObject(Farm.groupInfoable, true);

                if (intersects.length > 0) {
                    const selectedObject = intersects[0].object.owner;

                    selectedObject.showInfoBox();
                } else {
                    for (let i = Farm.visibleInfoBoxes.length - 1; i >= 0; i--) {
                        let infoBox = Farm.visibleInfoBoxes[i];
                        infoBox.hide();
                    }
                }
            } else if (Farm.lens == Farm.LENS.BUILD || Farm.lens == Farm.LENS.REMOVE) {
                Farm.mouseRaycaster.setFromCamera(Farm.mousePos, Farm.camera);

                intersects = Farm.mouseRaycaster.intersectObject(Farm.groundMesh);

                if (intersects.length > 0) {

                    const intersect = intersects[0];
                    const face = intersect.face;

                    const meshPosition = Farm.groundMesh.geometry.attributes.position;

                    let point = new THREE.Vector3();

                    point.add(new THREE.Vector3(meshPosition.getX(face.a), 0, meshPosition.getZ(face.a)));
                    point.add(new THREE.Vector3(meshPosition.getX(face.b), 0, meshPosition.getZ(face.b)));
                    point.add(new THREE.Vector3(meshPosition.getX(face.c), 0, meshPosition.getZ(face.c)));
                    point.divideScalar(3);

                    point = Farm.magnetToBlocks(point);

                    Farm.buildAreaCorner = point;

                    updateBuildPaletteSelect(Farm);

                    Farm.buildAreaRect.visible = true;

                    if (Farm.buildBuildingMesh != null) {
                        Farm.buildBuildingMesh.visible = true;
                    }
                }
            }
            break;
        case 1:
            break;
        case 2:
            break;
    }
}

export function onKeyDown(Farm, event) {

    switch (event.key) {
        case ']':
        case '[':
            let curBlock = Farm.hoveringBlock;
            if (curBlock) {
                if (event.key == ']') {
                    curBlock.groundState += 1;
                } else {
                    curBlock.groundState -= 1;
                }
                curBlock.groundState = (curBlock.groundState + Farm.GROUND_STATES.length) % Farm.GROUND_STATES.length;

                let curIdx = (curBlock.x * Farm.numBlocks.z + curBlock.z) * 8;
                for (let i = 0; i < 8; i++) {
                    Farm.groundUVs[curIdx + i] = Farm.GROUND_STATES[curBlock.groundState].uv[i];
                }
                Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));
            }
            break;
        case 'k':
            Farm.shadowLight.shadow.bias -= 0.00001;
            break;
        case 'l':
            Farm.shadowLight.shadow.bias += 0.00001;
            break;
        case 'i':
            Farm.shadowLight.shadow.normalBias -= 0.0001;
            break;
        case 'o':
            Farm.shadowLight.shadow.normalBias += 0.0001;
            break;
        case 't':
            console.info(Farm.hoveringBlock.wetness);
            break;
    }

}

function createNewSoil(Farm) {

    let newSoil = false;

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z; z++) {
            let curBlock = Farm.blocks[x + ',' + z];
            if (typeof curBlock === 'undefined') continue;

            let blockingPlants = false;
            let blockingBuildings = false;
            for (let plant of curBlock.plants) {
                blockingPlants = true;
                break;
            }
            for (let building of curBlock.buildings) {
                if (building.isWall) {} else {
                    blockingBuildings = true;
                    break;
                }
            }

            if (curBlock.type == BLOCK.GRASS &&
                !blockingPlants &&
                !blockingBuildings &&
                curBlock.groundState <= Farm.GROUND_STATES_NAMES.CLEAR) {
                curBlock.type = BLOCK.SOIL;
                curBlock.updateGrassBlades();

                newSoil = true;
            }
        }
    }

    if (newSoil) {

        let buildingBuffer = [];
        let buildingBuilding = Farm.BUILDINGS[0];

        for (const curBlockIdx in Farm.blocks) {
            if (Farm.blocks[curBlockIdx].type == BLOCK.SOIL) {
                Farm.blocks[curBlockIdx].soilMeshIdx = buildingBuffer.length;
                buildingBuffer.push(Farm.blocks[curBlockIdx]);
            }
        }

        for (let m = 0; m < buildingBuilding.meshes.length; m++) {
            let curMesh = buildingBuilding.meshes[m];

            Farm.groupSoilAndPlants.remove(curMesh);
            curMesh.dispose();
            curMesh = new THREE.InstancedMesh(buildingBuilding.geometries[m], buildingBuilding.materials[m], buildingBuffer.length);
            curMesh.receiveShadow = true;
            curMesh.castShadow = true;
            Farm.groupSoilAndPlants.add(curMesh);

            buildingBuilding.meshes[m] = curMesh;
        }

        for (let i = 0; i < buildingBuffer.length; i++) {
            buildingBuffer[i].updateSoilMesh();
        }
    }
}

// DEPRECATED
function createWater(Farm) {

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z; z++) {
            let curBlock = Farm.blocks[x + ',' + z];
            if (typeof curBlock === 'undefined') continue;

            if (curBlock.type == BLOCK.GRASS &&
                curBlock.plants.length == 0 &&
                curBlock.buildings.length == 0) {

                curBlock.groundState = Farm.GROUND_STATES_NAMES.WATER;

                let curIdx = (curBlock.x * Farm.numBlocks.z + curBlock.z) * 8;
                for (let i = 0; i < 8; i++) {
                    Farm.groundUVs[curIdx + i] = Farm.GROUND_STATES[curBlock.groundState].uv[i];
                }
            }
        }
    }
    Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));
}

function createNewTrench(Farm) {

    let buildingType = Farm.buildPaletteSelect;

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z; z++) {
            let curBlock = Farm.blocks[x + ',' + z];
            if (typeof curBlock === 'undefined') continue;

            if (curBlock.type == BLOCK.GRASS &&
                curBlock.plants.length == 0 &&
                curBlock.buildings.length == 0 &&
                curBlock.groundState < Farm.GROUND_STATES_NAMES.CLEAR) {

                curBlock.groundState = Farm.GROUND_STATES_NAMES.CLEAR;

                let curIdx = (curBlock.x * Farm.numBlocks.z + curBlock.z) * 8;
                for (let i = 0; i < 8; i++) {
                    Farm.groundUVs[curIdx + i] = Farm.GROUND_STATES[curBlock.groundState].uv[i];
                }

                let building = new BuildingObjects.BuildingWaterCarrier(Farm, Farm.buildingIdx, x, z, buildingType, Farm.buildBuildingSide);
                curBlock.buildings.push(building);
                curBlock.updateGrassBlades();

                if (Farm.BUILDINGS[buildingType].requireUpdates || Farm.BUILDINGS[buildingType].infoable) {
                    Farm.buildings[Farm.buildingIdx] = building;
                }
                Farm.buildingIdx++;
            }
        }
    }
    Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));

    let buildingBuffer = [];
    let buildingBuilding = Farm.BUILDINGS[buildingType];

    for (const curBlockIdx in Farm.blocks) {
        for (let curBuilding of Farm.blocks[curBlockIdx].buildings) {
            if (curBuilding.type == buildingType) {
                curBuilding.meshIdx = buildingBuffer.length;
                buildingBuffer.push({ block: Farm.blocks[curBlockIdx], building: curBuilding });
                break;
            }
        }
    }

    for (let m = 0; m < buildingBuilding.meshes.length; m++) {
        let curMesh = buildingBuilding.meshes[m];

        Farm.scene.remove(curMesh);
        curMesh.dispose();
        curMesh = new THREE.InstancedMesh(buildingBuilding.geometries[m], buildingBuilding.materials[m], buildingBuffer.length);
        curMesh.receiveShadow = true;
        curMesh.castShadow = true;
        Farm.scene.add(curMesh);

        buildingBuilding.meshes[m] = curMesh;
    }

    updateConnectibleConnections(Farm, buildingType, Farm.buildAreaPoint1, Farm.buildAreaPoint2);

    for (let i = 0; i < buildingBuffer.length; i++) {
        buildingBuffer[i].building.updateInstancedMesh();
    }
}

function createNewPlant(Farm) {

    let newPlant = false;
    let plantType = Farm.buildPaletteSelect;

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z; z++) {
            let curBlock = Farm.blocks[x + ',' + z];
            if (typeof curBlock === 'undefined') continue;

            if (curBlock.type == BLOCK.SOIL &&
                curBlock.plants.length == 0) {
                curBlock.plants.push(new Plant(Farm, plantType, curBlock));
                curBlock.updateGrassBlades();
                newPlant = true;
            }
        }
    }

    if (newPlant) {

        let plantBuffer = [];
        let plantBuilding = Farm.BUILDINGS[plantType];

        for (const curBlockIdx in Farm.blocks) {
            for (let curPlant of Farm.blocks[curBlockIdx].plants) {
                if (curPlant.type == plantType) {
                    curPlant.meshIdx = plantBuffer.length;
                    plantBuffer.push({ block: Farm.blocks[curBlockIdx], plant: curPlant });
                    break;
                }
            }
        }

        for (let m = 0; m < plantBuilding.meshes.length; m++) {
            let curMesh = plantBuilding.meshes[m];

            Farm.groupSoilAndPlants.remove(curMesh);
            curMesh.dispose();
            curMesh = new THREE.InstancedMesh(plantBuilding.geometries[m], plantBuilding.materials[m], plantBuffer.length * 4);
            if (plantBuilding.customDepthMaterial[m]) {
                curMesh.customDepthMaterial = plantBuilding.customDepthMaterial[m];
            }
            curMesh.receiveShadow = true;
            curMesh.castShadow = true;
            Farm.groupSoilAndPlants.add(curMesh);

            plantBuilding.meshes[m] = curMesh;
        }

        for (let i = 0; i < plantBuffer.length; i++) {

            plantBuffer[i].plant.updateMesh();

        }

        /*for (let m = 0; m < plantBuilding.meshes.length; m++) {
            plantBuilding.meshes[m].needsUpdate = true;
        }*/
    }
}

function createAreaOfNewBuildings(Farm) {
    let buildingType = Farm.buildPaletteSelect;
    let BUILDING = Farm.BUILDINGS[buildingType];
    let startX = Farm.buildAreaPoint1.x;
    let startZ = Farm.buildAreaPoint1.z;
    let endX = Farm.buildAreaPoint2.x;
    let endZ = Farm.buildAreaPoint2.z;
    for (let x = startX; x <= endX; x++) {
        for (let z = startZ; z <= endZ; z++) {
            Farm.buildAreaPoint1.x = Farm.buildAreaPoint2.x = x;
            Farm.buildAreaPoint1.z = Farm.buildAreaPoint2.z = z;
            createSingleNewBuilding(Farm, true);
        }
    }

    if (BUILDING.instanced) {
        let buildingBuffer = [];

        for (const curBlockIdx in Farm.blocks) {
            for (let curBuilding of Farm.blocks[curBlockIdx].buildings) {
                if (curBuilding.type == buildingType) {
                    curBuilding.meshIdx = buildingBuffer.length;
                    buildingBuffer.push({ block: Farm.blocks[curBlockIdx], building: curBuilding });
                    break;
                }
            }
        }

        for (let m = 0; m < BUILDING.meshes.length; m++) {
            let curMesh = BUILDING.meshes[m];

            Farm.scene.remove(curMesh);
            curMesh.dispose();
            curMesh = new THREE.InstancedMesh(BUILDING.geometries[m], BUILDING.materials[m], buildingBuffer.length);
            curMesh.receiveShadow = true;
            curMesh.castShadow = true;
            Farm.scene.add(curMesh);

            BUILDING.meshes[m] = curMesh;
        }

        for (let i = 0; i < buildingBuffer.length; i++) {
            buildingBuffer[i].building.updateInstancedMesh();
        }
    }
}

function createSingleNewBuilding(Farm, isArea = false) {

    let newBuilding = true;
    let buildingType = Farm.buildPaletteSelect;
    let BUILDING = Farm.BUILDINGS[buildingType];
    let isWall = BUILDING.name == "Fence";
    let isPath = BUILDING.name == "Stone Path";

    let foundationBlocks = [];

    if (Farm.buildAreaPoint1 == null || Farm.buildAreaPoint2 == null) return;

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x && newBuilding; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z && newBuilding; z++) {
            let curBlock = Farm.blocks[x + ',' + z];

            if (typeof curBlock === 'undefined' ||
                (curBlock.groundState == Farm.GROUND_STATES_NAMES.CLEAR && !BUILDING.onWater)) {
                newBuilding = false;
                continue;
            }

            let blockingPlants = false;
            let blockingBuildings = false;
            for (let plant of curBlock.plants) {
                if (isWall) {} else {
                    blockingPlants = true;
                    break;
                }
            }
            for (let building of curBlock.buildings) {
                if ((building.isWall && isWall && Farm.buildBuildingSide == building.side) ||
                    (isPath && building.isPath)) {
                    blockingBuildings = true;
                    break;
                } else if (building.isWall || isWall || isPath || building.isPath) {

                } else {
                    blockingBuildings = true;
                    break;
                }
            }
            if (blockingPlants || blockingBuildings) {
                newBuilding = false;
                continue;
            }

            if (curBlock.type == BLOCK.GRASS ||
                (curBlock.type == BLOCK.SOIL && isWall)) {
                foundationBlocks.push(curBlock);
            } else {
                newBuilding = false;
            }
        }
    }

    if (newBuilding) {

        let building;

        switch (Farm.BUILDINGS[buildingType].name) {
            case "Worker's House":
            case "Big Worker's House":
                building = new BuildingObjects.BuildingWorkersHouse(Farm, Farm.buildingIdx, Farm.buildAreaPoint1.x, Farm.buildAreaPoint1.z, buildingType, Farm.buildBuildingSide);
                break;
            case "Fence":
                building = new BuildingObjects.BuildingWall(Farm, Farm.buildingIdx, Farm.buildAreaPoint1.x, Farm.buildAreaPoint1.z, buildingType, Farm.buildBuildingSide);
                break;
            case "Stone Path":
                building = new BuildingObjects.BuildingPath(Farm, Farm.buildingIdx, Farm.buildAreaPoint1.x, Farm.buildAreaPoint1.z, buildingType, Farm.buildBuildingSide);
                break;
            default:
                building = new BuildingObjects.Building(Farm, Farm.buildingIdx, Farm.buildAreaPoint1.x, Farm.buildAreaPoint1.z, buildingType, Farm.buildBuildingSide);
                break;
        }

        for (const block of foundationBlocks) {
            block.buildings.push(building);
            block.updateGrassBlades();
            building.foundationBlocks.push(block);
        }

        if (BUILDING.requireUpdates || BUILDING.infoable) {
            Farm.buildings[Farm.buildingIdx] = building;
        }
        Farm.buildingIdx++;

        if (BUILDING.instanced && !isArea) {
            let buildingBuffer = [];

            for (const curBlockIdx in Farm.blocks) {
                for (let curBuilding of Farm.blocks[curBlockIdx].buildings) {
                    if (curBuilding.type == buildingType) {
                        curBuilding.meshIdx = buildingBuffer.length;
                        buildingBuffer.push({ block: Farm.blocks[curBlockIdx], building: curBuilding });
                        break;
                    }
                }
            }

            for (let m = 0; m < BUILDING.meshes.length; m++) {
                let curMesh = BUILDING.meshes[m];

                Farm.scene.remove(curMesh);
                curMesh.dispose();
                curMesh = new THREE.InstancedMesh(BUILDING.geometries[m], BUILDING.materials[m], buildingBuffer.length);
                curMesh.receiveShadow = true;
                curMesh.castShadow = true;
                Farm.scene.add(curMesh);

                BUILDING.meshes[m] = curMesh;
            }

            for (let i = 0; i < buildingBuffer.length; i++) {
                buildingBuffer[i].building.updateInstancedMesh();
            }
        }
    }
}

function updateBuildPaletteSelect(Farm) {

    let oldLens = Farm.lens;

    Farm.lens = Farm.LENS.BUILD;

    switch (Farm.BUILDINGS[Farm.buildPaletteSelect].build_mode) {
        case "area":
            Farm.overlay = Farm.OVERLAY.BUILD_AREA;
            break;
        case "line":
            Farm.overlay = Farm.OVERLAY.BUILD_LINE;
            break;
        case "single":
            Farm.overlay = Farm.OVERLAY.BUILD_SINGLE;
            break;
        case "remove":
            Farm.lens = Farm.LENS.REMOVE;
            switch (Farm.BUILDINGS[Farm.buildPaletteSelect].name) {
                case "Remove All":
                case "Remove Soil":
                case "Remove Water":
                    Farm.overlay = Farm.OVERLAY.REMOVE_AREA;
                    break;
                case "Remove Plants":
                    Farm.overlay = Farm.OVERLAY.REMOVE_PLANTS;
                    break;
                case "Remove Buildings":
                    Farm.overlay = Farm.OVERLAY.REMOVE_BUILDINGS;
                    break;
            }
            break;
    }
    if (Farm.lens == Farm.LENS.BUILD) {
        Farm.buildAreaRect.material = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, linewidth: 3 });
    } else {
        Farm.buildAreaRect.material = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, linewidth: 3 });
    }
    if (Farm.overlay == Farm.OVERLAY.BUILD_SINGLE) {
        Farm.buildAreaRect.visible = true;
    } else {
        Farm.buildAreaRect.visible = false;
    }
    updateBuildingMeshPreview(Farm);
}

function updateBuildingMeshPreview(Farm) {
    if (Farm.buildBuildingMesh != null) {
        Farm.scene.remove(Farm.buildBuildingMesh);
        Farm.buildBuildingMesh.geometry.dispose();
        Farm.buildBuildingMesh = null;
    }
    if (Farm.overlay == Farm.OVERLAY.BUILD_SINGLE || Farm.overlay == Farm.OVERLAY.BUILD_LINE) {
        Farm.buildBuildingMesh = new THREE.Mesh(Farm.BUILDINGS[Farm.buildPaletteSelect].geometries[0].clone(), Farm.buildBuildingMaterial);
        Farm.scene.add(Farm.buildBuildingMesh);
        Farm.buildBuildingMesh.visible = true;
    }
    if (Farm.overlay == Farm.OVERLAY.BUILD_LINE) {
        Farm.buildBuildingMesh.visible = false;
    }
}

function remove(Farm) {

    let removedPlantTypes = new Set();
    let removedBuildingTypes = new Set();

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z; z++) {
            let curBlock = Farm.blocks[x + ',' + z];

            if (typeof curBlock === 'undefined') continue;

            if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Buildings" ||
                Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
                for (let i = 0; i < curBlock.buildings.length; i++) {
                    let curBuilding = curBlock.buildings[i];
                    if (curBuilding.instanced) {
                        removedBuildingTypes.add(curBuilding.type);
                    }
                    for (let foundationBlock of curBuilding.foundationBlocks) {
                        var index = foundationBlock.buildings.indexOf(curBuilding);
                        if (index !== -1 && foundationBlock != curBlock) {
                            foundationBlock.buildings.splice(index, 1);
                        }
                    }
                    curBuilding.remove();
                }
                curBlock.buildings = [];
            }
            if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Plants" ||
                Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
                for (let i = 0; i < curBlock.plants.length; i++) {
                    removedPlantTypes.add(curBlock.plants[i].remove());
                }
                curBlock.plants = [];
            }
            if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Soil" ||
                Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
                if (curBlock.type == BLOCK.SOIL && curBlock.buildings.length == 0 && curBlock.plants.length == 0) {
                    curBlock.type = BLOCK.GRASS;
                }
            }
            if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Water" ||
                Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
                if (curBlock.type == BLOCK.GRASS && curBlock.buildings.length == 0 && curBlock.plants.length == 0) {
                    curBlock.groundState = 0;
                    let curIdx = (curBlock.x * Farm.numBlocks.z + curBlock.z) * 8;
                    for (let i = 0; i < 8; i++) {
                        Farm.groundUVs[curIdx + i] = Farm.GROUND_STATES[curBlock.groundState].uv[i];
                    }
                }
            }

            curBlock.updateGrassBlades();
        }
    }

    if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Buildings" ||
        Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
        //Farm.buildings = Farm.buildings.filter(building => building);
        //Farm.entities = Farm.entities.filter(entity => entity);
        removedBuildingTypes.forEach(function(buildingType) {
            let buildingBuffer = [];
            let buildingBuilding = Farm.BUILDINGS[buildingType];

            updateConnectibleConnections(Farm, buildingType, Farm.buildAreaPoint1, Farm.buildAreaPoint2);

            for (const curBlockIdx in Farm.blocks) {
                for (let curBuilding of Farm.blocks[curBlockIdx].buildings) {
                    if (curBuilding.type == buildingType) {
                        curBuilding.meshIdx = buildingBuffer.length;
                        buildingBuffer.push({ block: Farm.blocks[curBlockIdx], building: curBuilding });
                    }
                }
            }

            for (let m = 0; m < buildingBuilding.meshes.length; m++) {
                let curMesh = buildingBuilding.meshes[m];

                Farm.scene.remove(curMesh);
                curMesh.dispose();
                curMesh = new THREE.InstancedMesh(buildingBuilding.geometries[m], buildingBuilding.materials[m], buildingBuffer.length * 4);
                curMesh.receiveShadow = true;
                curMesh.castShadow = true;
                Farm.scene.add(curMesh);

                buildingBuilding.meshes[m] = curMesh;
            }

            for (let i = 0; i < buildingBuffer.length; i++) {
                buildingBuffer[i].building.updateInstancedMesh();
            }
        });
    }
    if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Plants" ||
        Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
        removedPlantTypes.forEach(function(plantType) {
            let plantBuffer = [];
            let plantBuilding = Farm.BUILDINGS[plantType];

            for (const curBlockIdx in Farm.blocks) {
                for (let curPlant of Farm.blocks[curBlockIdx].plants) {
                    if (curPlant.type == plantType) {
                        curPlant.meshIdx = plantBuffer.length;
                        plantBuffer.push({ block: Farm.blocks[curBlockIdx], plant: curPlant });
                        break;
                    }
                }
            }

            for (let m = 0; m < plantBuilding.meshes.length; m++) {
                let curMesh = plantBuilding.meshes[m];

                Farm.groupSoilAndPlants.remove(curMesh);
                curMesh.dispose();
                curMesh = new THREE.InstancedMesh(plantBuilding.geometries[m], plantBuilding.materials[m], plantBuffer.length * 4);
                curMesh.receiveShadow = true;
                curMesh.castShadow = true;
                Farm.groupSoilAndPlants.add(curMesh);

                plantBuilding.meshes[m] = curMesh;
            }

            for (let i = 0; i < plantBuffer.length; i++) {
                plantBuffer[i].plant.updateMesh();
            }
        });

    }
    if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Soil" ||
        Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
        let buildingBuffer = [];
        let buildingBuilding = Farm.BUILDINGS[0];

        for (const curBlockIdx in Farm.blocks) {
            if (Farm.blocks[curBlockIdx].type == BLOCK.SOIL) {
                Farm.blocks[curBlockIdx].soilMeshIdx = buildingBuffer.length;
                buildingBuffer.push(Farm.blocks[curBlockIdx]);
            }
        }

        for (let m = 0; m < buildingBuilding.meshes.length; m++) {
            let curMesh = buildingBuilding.meshes[m];

            Farm.groupSoilAndPlants.remove(curMesh);
            curMesh.dispose();
            curMesh = new THREE.InstancedMesh(buildingBuilding.geometries[m], buildingBuilding.materials[m], buildingBuffer.length * 4);
            curMesh.receiveShadow = true;
            curMesh.castShadow = true;
            Farm.groupSoilAndPlants.add(curMesh);

            buildingBuilding.meshes[m] = curMesh;
        }

        for (let i = 0; i < buildingBuffer.length; i++) {
            buildingBuffer[i].updateSoilMesh();
        }
    }
    if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Water" ||
        Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
        Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));
    }

}

const DIRECTIONS = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
    { x: 0, z: -1 },
];