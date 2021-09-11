import * as THREE from 'three';

import { Plant } from './plant.js';
import { BLOCK, Block } from './block.js';
import * as BuildingObjects from './building.js';


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
            if (Farm.overlay == Farm.OVERLAY.BUILD_AREA) {
                switch (Farm.BUILDINGS[Farm.buildPaletteSelect].name) {
                    case "Soil":
                        createNewSoil(Farm);
                        break;
                }
                Farm.overlay = Farm.OVERLAY.DEFAULT;
                Farm.buildAreaRect.visible = false;
            } else if (Farm.overlay == Farm.OVERLAY.BUILD_PLANTS) {
                createNewPlant(Farm);
                Farm.overlay = Farm.OVERLAY.DEFAULT;
                Farm.buildAreaRect.visible = false;
            } else if (Farm.overlay == Farm.OVERLAY.BUILD_BUILDINGS) {
                createNewBuilding(Farm);
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

                        Farm.ignoreNextMouseUp = true;
                        return;
                    } else if (Farm.lens == Farm.LENS.BUILD) {
                        Farm.lens = Farm.LENS.DEFAULT;
                        Farm.overlay = Farm.OVERLAY.DEFAULT;
                        Farm.textBuildButton.text = 'BUILD';
                        Farm.textBuildButton.fontSize = 45;
                        Farm.textBuildButton.outlineColor = 0xFF9900;
                        Farm.spriteBuildButton.material.map = Farm.texBuildButton;
                        Farm.groupBuildPalette.visible = false;
                        Farm.buildPaletteSelect = 0;

                        Farm.ignoreNextMouseUp = true;
                        return;
                    }
                } else if (intersect.object.name.startsWith("BuildPalette_")) {

                    let buildingPaletteInfo = Farm.buildPaletteMap[intersect.object.name.substring("BuildPalette_".length)];
                    Farm.buildPaletteSelect = buildingPaletteInfo.buildingType;
                    let categoryIdx = buildingPaletteInfo.buildingCategoryIdx;
                    Farm.spriteBuildPaletteSelect.position.set(-window.innerWidth * 0.5 + 20 + (categoryIdx + 0.5) * (Farm.thumbnailSize + 20), Farm.thumbnailY, 2);

                    updateBuildPaletteSelect(Farm);

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

            if (Farm.lens == Farm.LENS.BUILD) {
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

                    Farm.buildAreaRect.visible = true;

                    switch (Farm.BUILDINGS[Farm.buildPaletteSelect].category) {
                        case "ground":
                            Farm.overlay = Farm.OVERLAY.BUILD_AREA;
                            break;
                        case "plants":
                            Farm.overlay = Farm.OVERLAY.BUILD_PLANTS;
                            break;
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
                    Farm.groundUVs[curIdx + i] = instanced[i];
                }
                Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));
            }
            break;
    }

}

function createNewSoil(Farm) {

    let newSoil = false;

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z; z++) {
            let curBlock = Farm.blocks[x + ',' + z];
            if (typeof curBlock === 'undefined') continue;

            if (curBlock.type == BLOCK.GRASS &&
                curBlock.plants.length == 0 &&
                curBlock.buildings.length == 0) {
                curBlock.type = BLOCK.SOIL;

                newSoil = true;
            }
        }
    }

    if (newSoil) {

        let soilBlocks = [];

        for (const curBlockIdx in Farm.blocks) {
            if (Farm.blocks[curBlockIdx].type == BLOCK.SOIL) {
                soilBlocks.push(Farm.blocks[curBlockIdx]);
            }
        }

        Farm.scene.remove(Farm.meshSoil);
        Farm.meshSoil.dispose();
        Farm.meshSoil = new THREE.InstancedMesh(Farm.geometrySoil, Farm.materialSoil, soilBlocks.length);

        const matrix = new THREE.Matrix4();
        for (let i = 0; i < soilBlocks.length; i++) {


            matrix.makeTranslation(
                soilBlocks[i].x * Farm.blockSize,
                0,
                soilBlocks[i].z * Farm.blockSize
            );
            matrix.scale(new THREE.Vector3(1, -1, 1));

            Farm.meshSoil.setMatrixAt(i, matrix);

        }

        Farm.scene.add(Farm.meshSoil);
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
                curBlock.plants.length == 0 &&
                curBlock.buildings.length == 0) {
                curBlock.plants.push(new Plant(Farm, plantType, curBlock));
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

            Farm.scene.remove(curMesh);
            curMesh.dispose();
            curMesh = new THREE.InstancedMesh(plantBuilding.geometries[m], plantBuilding.materials[m], plantBuffer.length * 4);
            Farm.scene.add(curMesh);

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

function createNewBuilding(Farm) {

    let newBuilding = true;
    let buildingType = Farm.buildPaletteSelect;

    let foundationBlocks = [];

    if (Farm.buildAreaPoint1 == null || Farm.buildAreaPoint2 == null) return;

    for (let x = Farm.buildAreaPoint1.x; x <= Farm.buildAreaPoint2.x && newBuilding; x++) {
        for (let z = Farm.buildAreaPoint1.z; z <= Farm.buildAreaPoint2.z && newBuilding; z++) {
            let curBlock = Farm.blocks[x + ',' + z];
            if (typeof curBlock !== 'undefined' &&
                curBlock.type == BLOCK.GRASS &&
                curBlock.plants.length == 0 &&
                curBlock.buildings.length == 0) {
                foundationBlocks.push(curBlock);
            } else {
                newBuilding = false;
            }
        }
    }

    if (newBuilding) {

        let BUILDING = Farm.BUILDINGS[buildingType];

        let building = new BuildingObjects.BuildingWorkersHouse(Farm, Farm.buildAreaPoint1.x, Farm.buildAreaPoint1.z, buildingType);

        for (const block of foundationBlocks) {
            block.buildings.push(building);
        }

        Farm.buildings.push(building);
    }
}

function updateBuildPaletteSelect(Farm) {

    switch (Farm.BUILDINGS[Farm.buildPaletteSelect].category) {
        case "buildings":
            Farm.overlay = Farm.OVERLAY.BUILD_BUILDINGS;
            break;
        default:
            Farm.overlay = Farm.OVERLAY.DEFAULT;
            break;
    }
}