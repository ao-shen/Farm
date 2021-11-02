import * as THREE from './three/src/Three';

import { BLOCK } from './block.js';
import { maxWaterDepth } from './building.js';
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

    for (const curPlantIdx in Farm.plants) {
        let curPlant = Farm.plants[curPlantIdx];
        if (curPlant.type == plantType) {
            curPlant.meshIdx = plantBuffer.length;
            plantBuffer.push(curPlant);
        }
    }

    for (let m = 0; m < plantBuilding.meshes.length; m++) {
        let curMesh = plantBuilding.meshes[m];

        let instanceAmount = 4;

        if (plantBuilding.customInstances) {
            if (plantBuilding.customInstances[m].amount) {
                instanceAmount = plantBuilding.customInstances[m].amount;
            }
        }

        Farm.groupSoilAndPlants.remove(curMesh);
        curMesh.dispose();
        curMesh = new THREE.InstancedMesh(plantBuilding.geometries[m], plantBuilding.materials[m], plantBuffer.length * instanceAmount);
        if (plantBuilding.customDepthMaterial[m]) {
            curMesh.customDepthMaterial = plantBuilding.customDepthMaterial[m];
        }
        curMesh.receiveShadow = true;
        if (!plantBuilding.tree) {
            curMesh.castShadow = true;
        }
        Farm.groupSoilAndPlants.add(curMesh);

        plantBuilding.meshes[m] = curMesh;
    }

    for (let i = 0; i < plantBuffer.length; i++) {
        plantBuffer[i].updateMesh();
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
            curMesh = new THREE.InstancedMesh(buildingBuilding.geometries[m], buildingBuilding.materials[m], buildingBuffer.length);
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


export function updateTreeMesh(Farm) {
    let plantBuffer = [];
    for (let v = 0; v < Farm.TREES.length; v++) {
        plantBuffer.push([]);
    }

    for (const curPlantIdx in Farm.plants) {
        let curPlant = Farm.plants[curPlantIdx];
        if (curPlant.isTree) {
            curPlant.treeMeshIdx = plantBuffer[curPlant.variation].length;
            plantBuffer[curPlant.variation].push(curPlant);
        }
    }

    for (let v = 0; v < Farm.TREES.length; v++) {
        let curMesh = Farm.TREES[v].mesh;
        let curTree = Farm.TREES[v];

        Farm.groupSoilAndPlants.remove(curMesh);
        curMesh.dispose();
        curMesh = new THREE.InstancedMesh(curTree.geometry, curTree.material, plantBuffer[v].length);
        curMesh.receiveShadow = true;
        curMesh.castShadow = true;
        Farm.groupSoilAndPlants.add(curMesh);

        Farm.TREES[v].mesh = curMesh;

        curMesh = Farm.TREES[v].leafMesh;

        Farm.groupSoilAndPlants.remove(curMesh);
        curMesh.dispose();
        curMesh = new THREE.InstancedMesh(curTree.leafGeometry, curTree.leafMaterial, Farm.TREES[v].leaves.length * plantBuffer[v].length);
        curMesh.customDepthMaterial = Farm.leafDepthMaterial;
        curMesh.receiveShadow = true;
        curMesh.castShadow = true;
        Farm.groupSoilAndPlants.add(curMesh);

        Farm.TREES[v].leafMesh = curMesh;

        for (let i = 0; i < plantBuffer[v].length; i++) {
            plantBuffer[v][i].updateMesh();
        }
    }

}

/*
      ____
     | 1  |
 ____|____|____
| 4  | 0  | 2  |
|____|____|____|
     | 3  |
     |____|

*/
const waterCenterOffset = 0.3334;
const waterQuads = [];
// Quad 0
waterQuads.push(waterCenterOffset, 0, waterCenterOffset);
waterQuads.push(waterCenterOffset, 0, -waterCenterOffset);
waterQuads.push(-waterCenterOffset, 0, -waterCenterOffset);
waterQuads.push(-waterCenterOffset, 0, waterCenterOffset);
// Quad 1
waterQuads.push(1, 0, waterCenterOffset);
waterQuads.push(1, 0, -waterCenterOffset);
waterQuads.push(waterCenterOffset, 0, -waterCenterOffset);
waterQuads.push(waterCenterOffset, 0, waterCenterOffset);
// Quad 2
waterQuads.push(waterCenterOffset, 0, 1);
waterQuads.push(waterCenterOffset, 0, waterCenterOffset);
waterQuads.push(-waterCenterOffset, 0, waterCenterOffset);
waterQuads.push(-waterCenterOffset, 0, 1);
// Quad 3
waterQuads.push(-waterCenterOffset, 0, waterCenterOffset);
waterQuads.push(-waterCenterOffset, 0, -waterCenterOffset);
waterQuads.push(-1, 0, -waterCenterOffset);
waterQuads.push(-1, 0, waterCenterOffset);
// Quad 4
waterQuads.push(waterCenterOffset, 0, -waterCenterOffset);
waterQuads.push(waterCenterOffset, 0, -1);
waterQuads.push(-waterCenterOffset, 0, -1);
waterQuads.push(-waterCenterOffset, 0, -waterCenterOffset);

export function updateWaterMesh(Farm) {
    let buildingBuffer = [];

    Farm.waterVertices = [];
    Farm.waterIndices = [];

    for (let idx in Farm.waterUpdateList) {
        let curBuilding = Farm.waterUpdateList[idx];
        curBuilding.waterMeshIdx = buildingBuffer.length;
        buildingBuffer.push(curBuilding);

        for (let i = 0; i < 5 * 4; i++) {
            Farm.waterVertices.push(0, 0, 0);
        }
        for (let i = 0; i < 5; i++) {
            let curIdx = curBuilding.waterMeshIdx * 20 + i * 4;
            Farm.waterIndices.push(curIdx + 0);
            Farm.waterIndices.push(curIdx + 1);
            Farm.waterIndices.push(curIdx + 2);
            Farm.waterIndices.push(curIdx + 0);
            Farm.waterIndices.push(curIdx + 2);
            Farm.waterIndices.push(curIdx + 3);
        }
    }

    Farm.waterGeometry.dispose();
    Farm.groupNonInfoable.remove(Farm.waterMesh);

    Farm.waterGeometry = new THREE.BufferGeometry();
    Farm.waterMesh = new THREE.Mesh(Farm.waterGeometry, Farm.waterMaterial);
    Farm.waterMesh.receiveShadow = true;
    Farm.groupNonInfoable.add(Farm.waterMesh);
    Farm.waterVerticesBufferAttribute = new THREE.BufferAttribute(new Float32Array(Farm.waterVertices), 3);
    Farm.waterIndicesBufferAttribute = new THREE.BufferAttribute(new Uint32Array(Farm.waterIndices), 1);
    Farm.waterGeometry.setAttribute('position', Farm.waterVerticesBufferAttribute);
    Farm.waterGeometry.setIndex(Farm.waterIndicesBufferAttribute);

    for (let i = 0; i < buildingBuffer.length; i++) {
        buildingBuffer[i].updateWaterMesh();
    }
}