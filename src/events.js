import { signOut, getAuth } from "firebase/auth";

import * as THREE from 'three';

import { Plant } from './plant.js';
import { BLOCK, Block } from './block.js';
import * as BuildingObjects from './building.js';
import { updateConnectibleConnections } from './water_update.js';
import { load, save } from './load_save.js';
import { updateInstancedBuildingMesh, updatePlantMesh, updateSoilMesh, updateTreeMesh, updateWaterMesh } from "./update_instanced_meshes.js";


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
                                createNewAreaOfPlants(Farm);
                                break;
                            case "buildings":
                                createAreaOfNewBuildings(Farm);
                                break;
                        }
                        break;
                }
                Farm.overlay = Farm.OVERLAY.DEFAULT;
                Farm.buildAreaRect.visible = false;
                if (Farm.buildBuildingMesh != null) {
                    Farm.buildBuildingMesh.visible = false;
                }
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
                switch (Farm.BUILDINGS[Farm.buildPaletteSelect].category) {
                    case "plants":
                        createSingleNewPlant(Farm);
                        break;
                    default:
                        createSingleNewBuilding(Farm);
                        break;
                }
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

                if (!intersect.object.visible) {
                    continue;
                }
                if (intersect.object.parent && !intersect.object.parent.visible) {
                    continue;
                }
                if (intersect.object.parent && intersect.object.parent.parent && !intersect.object.parent.parent.visible) {
                    continue;
                }

                if (intersect.object.name == "BuildButton") {

                    if (Farm.lens == Farm.LENS.DEFAULT) {
                        Farm.lens = Farm.LENS.BUILD;
                        Farm.textBuildButton.text = 'CANCEL';
                        Farm.textBuildButton.fontSize = 35;
                        //Farm.textBuildButton.outlineColor = 0x0099FF;
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
                        //Farm.textBuildButton.outlineColor = 0xFF9900;
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
                    let curInfoBox, infoBoxOwnerIdx, infoBoxChildName;
                    if (infoBoxOwnerName.startsWith("Building_")) {
                        infoBoxOwnerIdx = infoBoxOwnerName.substring("Building_".length);
                        let tmp = infoBoxOwnerIdx.indexOf("_");
                        infoBoxChildName = tmp == -1 ? "" : infoBoxOwnerIdx.substring(tmp + 1);
                        infoBoxOwnerIdx = tmp == -1 ? infoBoxOwnerIdx : infoBoxOwnerIdx.substring(0, infoBoxOwnerIdx.indexOf("_"));
                        curInfoBox = Farm.buildings[infoBoxOwnerIdx].infoBox;
                    } else if (infoBoxOwnerName.startsWith("Entity_")) {
                        infoBoxOwnerIdx = infoBoxOwnerName.substring("Entity_".length);
                        let tmp = infoBoxOwnerIdx.indexOf("_");
                        infoBoxChildName = tmp == -1 ? "" : infoBoxOwnerIdx.substring(tmp + 1);
                        infoBoxOwnerIdx = tmp == -1 ? infoBoxOwnerIdx : infoBoxOwnerIdx.substring(0, infoBoxOwnerIdx.indexOf("_"));
                        curInfoBox = Farm.entities[infoBoxOwnerIdx].infoBox;
                    } else if (infoBoxOwnerName.startsWith("Restaurant")) {
                        curInfoBox = Farm.restaurantObj.infoBox;
                        infoBoxChildName = infoBoxOwnerName.substring("Restaurant_".length)
                    } else {
                        continue;
                    }

                    if (infoBoxChildName.startsWith("Button_")) {
                        let buttonIdx = infoBoxChildName.substring("Button_".length)
                        curInfoBox.onClick[buttonIdx]();
                    } else {
                        Farm.draggingInfoBox = curInfoBox;
                        Farm.draggingInfoBoxStartPos = curInfoBox.pos.clone();
                        Farm.draggingInfoBoxStartMousePos = Farm.mousePos.clone();
                    }

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
                    } else if (intersect.object.name.startsWith("BuildPalette")) {
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
        case 't':
            console.info(Farm.hoveringBlock.wetness);
            break;
        case 'y':
            console.info(Farm.hoveringBlock.buildings[0].waterDirection, Farm.hoveringBlock.buildings[0].waterLevels[0]);
            break;
        case 's':
            save(Farm);
            break;
        case 'l':
            load(Farm);
            break;
        case 'x':
            signOut(getAuth());
            console.log("gehe");
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
        updateSoilMesh(Farm);
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
    let potentialBlocks = [];

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z; z++) {
            let curBlock = Farm.blocks[x + ',' + z];
            if (typeof curBlock === 'undefined') continue;

            if (curBlock.type == BLOCK.GRASS &&
                curBlock.plants.length == 0 &&
                curBlock.buildings.length == 0 &&
                curBlock.groundState < Farm.GROUND_STATES_NAMES.CLEAR) {

                potentialBlocks.push({ x: x, z: z });
            }
        }
    }

    if (potentialBlocks.length * Farm.BUILDINGS[buildingType].price > Farm.money) {
        return;
    }
    Farm.money -= potentialBlocks.length * Farm.BUILDINGS[buildingType].price;

    for (let potentialBlock of potentialBlocks) {
        let x = potentialBlock.x;
        let z = potentialBlock.z;
        let curBlock = Farm.blocks[x + ',' + z];

        curBlock.groundState = Farm.GROUND_STATES_NAMES.CLEAR;

        let curIdx = (curBlock.x * Farm.numBlocks.z + curBlock.z) * 8;
        for (let i = 0; i < 8; i++) {
            Farm.groundUVs[curIdx + i] = Farm.GROUND_STATES[curBlock.groundState].uv[i];
        }

        let building = new BuildingObjects.BuildingWaterCarrier(Farm, Farm.buildingIdx, x, z, buildingType, Farm.buildBuildingSide);
        curBlock.buildings.push(building);
        curBlock.updateGrassBlades();

        if (Farm.BUILDINGS[buildingType].requireUpdates || Farm.BUILDINGS[buildingType].infoable) {
            Farm.updatableBuildings[Farm.buildingIdx] = building;
        }
        Farm.buildings[Farm.buildingIdx] = building;
        Farm.buildingIdx++;

    }
    Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));

    updateInstancedBuildingMesh(Farm, buildingType);
    updateWaterMesh(Farm);
}

function createNewAreaOfPlants(Farm) {

    let plantType = Farm.buildPaletteSelect;

    let startX = Farm.buildAreaPoint1.x;
    let startZ = Farm.buildAreaPoint1.z;
    let endX = Farm.buildAreaPoint2.x;
    let endZ = Farm.buildAreaPoint2.z;
    for (let x = startX; x <= endX; x++) {
        for (let z = startZ; z <= endZ; z++) {
            Farm.buildAreaPoint1.x = Farm.buildAreaPoint2.x = x;
            Farm.buildAreaPoint1.z = Farm.buildAreaPoint2.z = z;
            createSingleNewPlant(Farm, true);
        }
    }

    if (Farm.BUILDINGS[plantType].tree) {
        updateTreeMesh(Farm);
    }
    updatePlantMesh(Farm, plantType);

}

function createSingleNewPlant(Farm, isArea = false) {

    let plantType = Farm.buildPaletteSelect;
    let potentialBlocks = [];

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z; z++) {
            let curBlock = Farm.blocks[x + ',' + z];
            if (typeof curBlock === 'undefined') continue;

            if ((curBlock.type == BLOCK.SOIL ? !Farm.BUILDINGS[plantType].tree : Farm.BUILDINGS[plantType].tree) &&
                curBlock.plants.length == 0) {
                potentialBlocks.push(curBlock);
            } else {
                return;
            }
        }
    }

    if (Farm.BUILDINGS[plantType].size) {
        if (potentialBlocks.length < Farm.BUILDINGS[plantType].size.x * Farm.BUILDINGS[plantType].size.z) {
            return;
        }
    } else {
        if (potentialBlocks.length == 0) {
            return;
        }
    }

    if (Farm.BUILDINGS[plantType].price > Farm.money) {
        return;
    }
    Farm.money -= Farm.BUILDINGS[plantType].price;

    let newPlant = new Plant(Farm, Farm.plantIdx, (Farm.buildAreaPoint1.x + Farm.buildAreaPoint2.x) / 2, (Farm.buildAreaPoint1.z + Farm.buildAreaPoint2.z) / 2, potentialBlocks, plantType);
    Farm.plants[Farm.plantIdx] = newPlant;
    Farm.plantIdx++;

    for (let potentialBlock of potentialBlocks) {
        potentialBlock.plants.push(newPlant);
        potentialBlock.updateGrassBlades();
    }

    if (!isArea) {
        if (Farm.BUILDINGS[plantType].tree) {
            updateTreeMesh(Farm);
        }
        updatePlantMesh(Farm, plantType);

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

    if (BUILDING.instanced || BUILDING.connectible || BUILDING.connectibleGroup) {
        updateInstancedBuildingMesh(Farm, buildingType, { x: startX, z: startZ }, { x: endX, z: endZ });
    }
    if (BUILDING.visibleWaterCarrier) {
        updateWaterMesh(Farm);
    }
    if (BUILDING.groundStateMutator || BUILDING.connectibleGroup) {
        Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));
    }
}

function createSingleNewBuilding(Farm, isArea = false) {

    let newBuilding = true;
    let buildingType = Farm.buildPaletteSelect;
    let BUILDING = Farm.BUILDINGS[buildingType];
    let isWall = BUILDING.name == "Fence";
    let isPath = BUILDING.name == "Concrete Slab" || BUILDING.name == "Dirt Path" || BUILDING.name == "Asphalt Road";
    let touchingRiver = false;

    let foundationBlocks = [];

    if (Farm.buildAreaPoint1 == null || Farm.buildAreaPoint2 == null) return;

    let rectX1 = Math.min(Farm.buildAreaPoint1.x, Farm.buildAreaPoint2.x);
    let rectZ1 = Math.min(Farm.buildAreaPoint1.z, Farm.buildAreaPoint2.z);
    let rectX2 = Math.max(Farm.buildAreaPoint1.x, Farm.buildAreaPoint2.x);
    let rectZ2 = Math.max(Farm.buildAreaPoint1.z, Farm.buildAreaPoint2.z);

    for (let x = rectX1; x <= rectX2 && newBuilding; x++) {
        for (let z = rectZ1; z <= rectZ2 && newBuilding; z++) {
            let curBlock = Farm.blocks[x + ',' + z];

            if (typeof curBlock === 'undefined' ||
                (curBlock.groundState == Farm.GROUND_STATES_NAMES.CLEAR && !BUILDING.onWater)) {
                newBuilding = false;
                continue;
            }

            if (x == 0) {
                touchingRiver = true;
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
                let clippable = false;
                if (Farm.BUILDINGS[building.type].allowClipConnectibleGroup) {
                    for (let group of Farm.BUILDINGS[building.type].allowClipConnectibleGroup) {
                        if (BUILDING.connectibleGroup == group) {
                            clippable = true;
                        }
                    }
                }
                if (BUILDING.allowClipConnectibleGroup) {
                    for (let group of BUILDING.allowClipConnectibleGroup) {
                        if (building.connectibleGroup == group) {
                            clippable = true;
                        }
                    }
                }
                if (clippable) {

                } else if ((building.isWall && isWall && Farm.buildBuildingSide == building.side) ||
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

    if (BUILDING.requireRiver && !touchingRiver) return;

    if (newBuilding) {

        if (Farm.BUILDINGS[buildingType].price > Farm.money) {
            return;
        }
        Farm.money -= Farm.BUILDINGS[buildingType].price;

        let building;

        switch (Farm.BUILDINGS[buildingType].name) {
            case "Worker's House":
            case "Big Worker's House":
                building = new BuildingObjects.BuildingWorkersHouse(Farm, Farm.buildingIdx, Farm.buildAreaPoint1.x, Farm.buildAreaPoint1.z, buildingType, Farm.buildBuildingSide);
                break;
            case "Fence":
                building = new BuildingObjects.BuildingWall(Farm, Farm.buildingIdx, Farm.buildAreaPoint1.x, Farm.buildAreaPoint1.z, buildingType, Farm.buildBuildingSide);
                break;
            case "Concrete Slab":
            case "Dirt Path":
            case "Asphalt Road":
                building = new BuildingObjects.BuildingPath(Farm, Farm.buildingIdx, Farm.buildAreaPoint1.x, Farm.buildAreaPoint1.z, buildingType, Farm.buildBuildingSide);
                break;
            case "Storage":
                building = new BuildingObjects.Storage(Farm, Farm.buildingIdx, Farm.buildAreaPoint1.x, Farm.buildAreaPoint1.z, buildingType, Farm.buildBuildingSide);
                break;
            case "Aquaduct":
            case "Piped Aquaduct":
                building = new BuildingObjects.BuildingWaterCarrier(Farm, Farm.buildingIdx, Farm.buildAreaPoint1.x, Farm.buildAreaPoint1.z, buildingType, Farm.buildBuildingSide);
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
            Farm.updatableBuildings[Farm.buildingIdx] = building;
        }
        Farm.buildings[Farm.buildingIdx] = building;
        Farm.buildingIdx++;

        if (!isArea) {

            if (BUILDING.instanced || BUILDING.connectible || BUILDING.connectibleGroup) {
                updateInstancedBuildingMesh(Farm, buildingType, Farm.buildAreaPoint1, Farm.buildAreaPoint2);
            }

            if (BUILDING.visibleWaterCarrier) {
                updateWaterMesh(Farm);
            }

            if (BUILDING.groundStateMutator || BUILDING.connectibleGroup) {
                Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));
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
    if (!Farm.BUILDINGS[Farm.buildPaletteSelect].noPreviewMesh && Farm.BUILDINGS[Farm.buildPaletteSelect].category != "remove") {
        if (Farm.BUILDINGS[Farm.buildPaletteSelect].tree) {
            Farm.buildBuildingMesh = new THREE.Mesh(Farm.TREES[0].geometry.clone(), Farm.buildBuildingMaterial);
        } else {
            Farm.buildBuildingMesh = new THREE.Mesh(Farm.BUILDINGS[Farm.buildPaletteSelect].geometries[0].clone(), Farm.buildBuildingMaterial);
        }
        Farm.scene.add(Farm.buildBuildingMesh);
        if (Farm.overlay != Farm.OVERLAY.BUILD_SINGLE) {
            Farm.buildBuildingMesh.visible = false;
        }
    }
}

function remove(Farm) {

    let removedPlantTypes = new Set();
    let removedBuildingTypes = new Set();
    let didRemovedGroundStateMutator = false;

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z; z++) {
            let curBlock = Farm.blocks[x + ',' + z];

            if (typeof curBlock === 'undefined') continue;

            if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Buildings" ||
                Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
                for (let i = 0; i < curBlock.buildings.length; i++) {
                    let curBuilding = curBlock.buildings[i];
                    if (Farm.BUILDINGS[curBuilding.type].groundStateMutator) {
                        didRemovedGroundStateMutator = true;
                    }
                    removedBuildingTypes.add(curBuilding.type);
                    for (let foundationBlock of curBuilding.foundationBlocks) {
                        var index = foundationBlock.buildings.indexOf(curBuilding);
                        if (index !== -1 && foundationBlock != curBlock) {
                            foundationBlock.buildings.splice(index, 1);
                            foundationBlock.updateGrassBlades();
                        }
                    }
                    curBuilding.remove();
                }
                curBlock.buildings = [];
            }
            if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Plants" ||
                Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
                for (let i = 0; i < curBlock.plants.length; i++) {
                    for (let foundationBlock of curBlock.plants[i].blocks) {
                        var index = foundationBlock.plants.indexOf(curBlock.plants[i]);
                        if (index !== -1 && foundationBlock != curBlock) {
                            foundationBlock.plants.splice(index, 1);
                            foundationBlock.updateGrassBlades();
                        }
                    }
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
            updateInstancedBuildingMesh(Farm, buildingType, Farm.buildAreaPoint1, Farm.buildAreaPoint2);
        });
        if (didRemovedGroundStateMutator) {
            Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));
        }
        updateWaterMesh(Farm);
    }
    if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Plants" ||
        Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
        let removedTrees = false;
        removedPlantTypes.forEach(function(plantType) {
            if (Farm.BUILDINGS[plantType].tree) {
                removedTrees = true;
            }
            updatePlantMesh(Farm, plantType);

        });
        if (removedTrees) {
            updateTreeMesh(Farm);
        }
    }
    if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Soil" ||
        Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
        updateSoilMesh(Farm);
    }
    if (Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove Water" ||
        Farm.BUILDINGS[Farm.buildPaletteSelect].name == "Remove All") {
        Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));
    }

}