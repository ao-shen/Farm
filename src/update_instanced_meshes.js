import * as THREE from 'three';

import { BLOCK } from './block.js';
import { updateConnectibleConnections } from './water_update.js';

export function updateSoilMesh(Farm) {
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

export function updatePlantMesh(Farm, plantType) {
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

export function updateInstancedBuildingMesh(Farm, buildingType, point1 = null, point2 = null) {

    let buildingBuffer = [];
    let buildingBuilding = Farm.BUILDINGS[buildingType];

    for (const curBuildingIdx in Farm.buildings) {
        let curBuilding = Farm.buildings[curBuildingIdx];
        if (curBuilding.type == buildingType) {
            curBuilding.meshIdx = buildingBuffer.length;
            buildingBuffer.push({ building: curBuilding });
        }
    }

    if (buildingBuilding.instanced) {
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
    }

    let points = new Set();

    if (point1 && point2) {
        for (let x = Math.max(0, point1.x - 1); x <= Math.min(Farm.numBlocks.x, point2.x + 1); x++) {
            for (let z = Math.max(0, point1.z - 1); z <= Math.min(Farm.numBlocks.z, point2.z + 1); z++) {
                points.add(x + ',' + z);
            }
        }
    } else {
        for (let i = 0; i < buildingBuffer.length; i++) {
            points.add(buildingBuffer[i].building.pos.x + ',' + buildingBuffer[i].building.pos.z);
            points.add((buildingBuffer[i].building.pos.x + 1) + ',' + buildingBuffer[i].building.pos.z);
            points.add(buildingBuffer[i].building.pos.x + ',' + (buildingBuffer[i].building.pos.z + 1));
            points.add((buildingBuffer[i].building.pos.x - 1) + ',' + buildingBuffer[i].building.pos.z);
            points.add(buildingBuffer[i].building.pos.x + ',' + (buildingBuffer[i].building.pos.z - 1));
        }
    }

    updateConnectibleConnections(Farm, buildingType, points);

    if (buildingBuilding.instanced) {
        for (let i = 0; i < buildingBuffer.length; i++) {
            buildingBuffer[i].building.updateInstancedMesh();
        }
    }

    if (Farm.BUILDINGS[buildingType].connectibleGroup) {
        for (let otherType of Farm.connectibleGroupMap[Farm.BUILDINGS[buildingType].connectibleGroup]) {
            updateConnectibleConnections(Farm, otherType, points);
        }
    }
}