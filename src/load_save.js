import { getDatabase, ref, set, child, get } from "firebase/database";

import * as THREE from './three/src/Three';

import { LZMA } from './lzma/lzma-min';
import { Plant } from "./plant";
import * as BuildingObjects from './building.js';
import { updateEntityMesh, updateInstancedBuildingMesh, updatePlantMesh, updateSoilMesh, updateTreeMesh, updateWaterMesh } from "./update_instanced_meshes";
import { Entity } from "./entity";
import { updateConnectibleConnections } from "./water_update";
import { Livestock } from "./livestock";
import { MechanicalRotator } from "./mechanical";

var Base64Binary = {
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    /* will return a  Uint8Array type */
    decodeArrayBuffer: function(input) {
        var bytes = (input.length / 4) * 3;
        var ab = new ArrayBuffer(bytes);
        this.decode(input, ab);

        return ab;
    },

    removePaddingChars: function(input) {
        var lkey = this._keyStr.indexOf(input.charAt(input.length - 1));
        if (lkey == 64) {
            return input.substring(0, input.length - 1);
        }
        return input;
    },

    decode: function(input, arrayBuffer) {
        //get last chars to see if are valid
        input = this.removePaddingChars(input);
        input = this.removePaddingChars(input);

        var bytes = parseInt((input.length / 4) * 3, 10);

        var uarray;
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        var j = 0;

        if (arrayBuffer)
            uarray = new Uint8Array(arrayBuffer);
        else
            uarray = new Uint8Array(bytes);

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        for (i = 0; i < bytes; i += 3) {
            //get the 3 octects in 4 ascii chars
            enc1 = this._keyStr.indexOf(input.charAt(j++));
            enc2 = this._keyStr.indexOf(input.charAt(j++));
            enc3 = this._keyStr.indexOf(input.charAt(j++));
            enc4 = this._keyStr.indexOf(input.charAt(j++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            uarray[i] = chr1;
            if (enc3 != 64) uarray[i + 1] = chr2;
            if (enc4 != 64) uarray[i + 2] = chr3;
        }

        return uarray;
    }
}

export function save(Farm) {

    let data = {
        buildings: [],
        entities: [],
        plants: [],
        blocks: [],
        money: Farm.money,
        restaurantInv: Farm.restaurantObj.inventory.inventory,
    }

    for (const curBuildingIdx in Farm.buildings) {

        let curBuilding = Farm.buildings[curBuildingIdx];
        let buildingData = {};

        buildingData.i = curBuilding.idx;
        buildingData.t = curBuilding.type;
        buildingData.p = [curBuilding.pos.x, curBuilding.pos.z];
        buildingData.s = curBuilding.side;
        buildingData.v = curBuilding.variation;
        buildingData.f = [];

        if (curBuilding.height) buildingData.h = curBuilding.height;
        if (curBuilding.vertical) buildingData.vt = curBuilding.vertical;

        if (curBuilding.inventory && !curBuilding.inventory.isEmpty()) {
            buildingData.n = curBuilding.inventory.inventory;
        }

        for (let curBlock of curBuilding.foundationBlocks) {
            buildingData.f.push({ x: curBlock.x, z: curBlock.z });
        }

        data.buildings.push(buildingData);
    }

    for (const curEntityIdx in Farm.entities) {

        let curEntity = Farm.entities[curEntityIdx];
        let entityData = {};

        if (curEntity.isCustomer) continue;

        entityData.i = curEntity.idx;
        entityData.t = curEntity.type;
        entityData.p = { x: Math.round(curEntity.pos.x), z: Math.round(curEntity.pos.z) };
        entityData.v = curEntity.variation;
        entityData.s = curEntity.state;

        if (curEntity.inventory && !curEntity.inventory.isEmpty()) {
            entityData.n = curEntity.inventory.inventory;
        }

        if (curEntity.parentBuilding) entityData.b = curEntity.parentBuilding.idx;
        if (curEntity.parentEntitiy) entityData.e = curEntity.parentEntitiy.idx;

        data.entities.push(entityData);
    }

    for (const curPlantIdx in Farm.plants) {

        let curPlant = Farm.plants[curPlantIdx];
        let plantData = {};

        plantData.i = curPlant.idx;
        plantData.t = curPlant.type;
        plantData.p = { x: Math.round(curPlant.pos.x * 2), z: Math.round(curPlant.pos.z * 2) };
        plantData.s = curPlant.stage;
        plantData.b = [];

        for (let curBlock of curPlant.blocks) {
            plantData.b.push({ x: curBlock.x, z: curBlock.z });
        }

        data.plants.push(plantData);
    }

    let lastX = 0;
    let lastZ = 0;

    for (let x = 0; x < Farm.numBlocks.x; x++) {
        for (let z = 0; z < Farm.numBlocks.z; z++) {

            let curBlock = Farm.blocks[x + ',' + z];
            let blockData = {};

            let isDefault = true;

            //blockData.x = curBlock.x;
            //blockData.z = curBlock.z;

            if (curBlock.groundState != 0) {
                isDefault = false;
                blockData.g = curBlock.groundState;
            }
            if (curBlock.type != 0) {
                isDefault = false;
                blockData.t = curBlock.type;
            }

            if (!isDefault) {

                if (curBlock.z - lastZ != 1) {
                    blockData.z = curBlock.z - lastZ;
                    lastZ = curBlock.z;
                }
                if (curBlock.x - lastX != 0) {
                    blockData.x = curBlock.x - lastX;
                }
                lastZ = curBlock.z;
                lastX = curBlock.x;

                data.blocks.push(blockData);
            }
        }
    }

    let json = JSON.stringify(data);
    console.log(json.length);

    LZMA.compress(json, 1, function(result, error) {
        if (result) {

            console.log(result.length);

            const base64String = btoa(String.fromCharCode(...new Uint8Array(result)));

            const db = getDatabase();
            set(ref(db, 'users/' + Farm.auth.currentUser.uid), true);
            set(ref(db, 'maps/' + Farm.auth.currentUser.uid), base64String);

        } else {
            console.error(error);
        }
    }, function(percent) {});
}

export async function load(Farm) {
    return new Promise((resolve, reject) => {
        const db = getDatabase();
        const dbRef = ref(db);
        get(child(dbRef, 'maps/' + Farm.auth.currentUser.uid)).then((snapshot) => {
            if (snapshot.exists()) {

                const data = snapshot.val();

                let decoded = new Uint8Array(Base64Binary.decodeArrayBuffer(data));

                LZMA.decompress(decoded, function(result) {

                    let loadedPlantTypes = new Set();
                    let loadedInstancedBuildingTypes = new Set();
                    let loadedConnectibleBuildingTypes = new Set();
                    let loadedEntitiesTypes = new Set();

                    const data = JSON.parse(result);
                    console.log(data);

                    Farm.money = data.money;
                    Farm.restaurantObj.inventory.addMultiple(data.restaurantInv);

                    let lastX = 0;
                    let lastZ = 0;

                    for (let blockData of data.blocks) {

                        let x = typeof blockData.x !== 'undefined' ? (lastX + blockData.x) : (lastX);
                        let z = typeof blockData.z !== 'undefined' ? (lastZ + blockData.z) : (lastZ + 1);

                        lastX = x;
                        lastZ = z;

                        let curBlock = Farm.blocks[x + ',' + z];

                        if (blockData.g) {
                            curBlock.groundState = blockData.g
                            let curIdx = (curBlock.x * Farm.numBlocks.z + curBlock.z) * 8;
                            for (let i = 0; i < 8; i++) {
                                Farm.groundUVs[curIdx + i] = Farm.GROUND_STATES[curBlock.groundState].uv[i];
                            }
                        }
                        if (blockData.t) { curBlock.type = blockData.t };
                        /*if (blockData.p) {
                            for (let plantData of blockData.p) {
                                let curPlant = new Plant(Farm, plantData.t, curBlock);
                                loadedPlantTypes.add(plantData.t);
                                curPlant.stage = plantData.s;
                                curBlock.plants.push(curPlant);
                            }
                        };*/
                        curBlock.updateGrassBlades();
                    }

                    for (let buildingData of data.buildings) {

                        let building;
                        let buildingType = buildingData.t;
                        if (Farm.BUILDINGS[buildingType].instanced) {
                            loadedInstancedBuildingTypes.add(buildingType);
                        } else if (Farm.BUILDINGS[buildingType].connectible) {
                            loadedConnectibleBuildingTypes.add(buildingType);
                        }

                        switch (Farm.BUILDINGS[buildingType].buildingObject) {
                            case "BuildingWaterCarrier":
                                building = new BuildingObjects.BuildingWaterCarrier(Farm, buildingData.i, buildingData.p[0], buildingData.p[1], buildingType, buildingData.s);
                                break;
                            case "BuildingWorkersHouse":
                                building = new BuildingObjects.BuildingWorkersHouse(Farm, buildingData.i, buildingData.p[0], buildingData.p[1], buildingType, buildingData.s, false);
                                break;
                            case "BuildingWall":
                                building = new BuildingObjects.BuildingWall(Farm, buildingData.i, buildingData.p[0], buildingData.p[1], buildingType, buildingData.s);
                                break;
                            case "BuildingPath":
                                building = new BuildingObjects.BuildingPath(Farm, buildingData.i, buildingData.p[0], buildingData.p[1], buildingType, buildingData.s);
                                break;
                            case "Storage":
                                building = new BuildingObjects.Storage(Farm, buildingData.i, buildingData.p[0], buildingData.p[1], buildingType, buildingData.s);
                                break;
                            case "BuildingBarn":
                                building = new BuildingObjects.BuildingBarn(Farm, buildingData.i, buildingData.p[0], buildingData.p[1], buildingType, buildingData.s, false);
                                break;
                            case "MechanicalRotator":
                                let height = 0;
                                let vertical = false;
                                if (buildingData.h) height = buildingData.h;
                                if (buildingData.vt) vertical = buildingData.vt;
                                building = new MechanicalRotator(Farm, buildingData.i, buildingData.p[0], buildingData.p[1], buildingType, buildingData.s, height, vertical);
                                break;
                            default:
                                building = new BuildingObjects.Building(Farm, buildingData.i, buildingData.p[0], buildingData.p[1], buildingType, buildingData.s);
                                break;
                        }

                        if (buildingData.v > 0) { building.updateMeshVariation(buildingData.v) };

                        if (buildingData.n) {
                            building.inventory.addMultiple(buildingData.n);
                        }

                        if (buildingData.f.length == 0) {
                            let curBlock = Farm.blocks[buildingData.p[0] + ',' + buildingData.p[1]];
                            curBlock.buildings.push(building);
                            curBlock.updateGrassBlades();
                        } else {
                            for (let foundationBlock of buildingData.f) {
                                let curBlock = Farm.blocks[foundationBlock.x + ',' + foundationBlock.z];
                                building.foundationBlocks.push(curBlock);
                                curBlock.buildings.push(building);
                                curBlock.updateGrassBlades();
                            }
                        }

                        if (Farm.BUILDINGS[buildingType].requireUpdates || Farm.BUILDINGS[buildingType].infoable) {
                            Farm.updatableBuildings[buildingData.i] = building;
                        }
                        Farm.buildings[buildingData.i] = building;
                        Farm.buildingIdx = Math.max(Farm.buildingIdx, buildingData.i + 1);
                    }

                    for (let entityData of data.entities) {

                        let curEntity;
                        if (entityData.t == 3) {
                            curEntity = new Livestock(Farm, entityData.i, entityData.p.x, entityData.p.z, entityData.t, entityData.v);
                        } else {
                            curEntity = new Entity(Farm, entityData.i, entityData.p.x, entityData.p.z, entityData.t, entityData.v);
                        }
                        curEntity.state = entityData.s ? entityData.s : 0;

                        if (entityData.n) {
                            curEntity.inventory.addMultiple(entityData.n);
                        }

                        Farm.entities[entityData.i] = curEntity;
                        Farm.entityIdx = Math.max(Farm.entityIdx, entityData.i + 1);

                        loadedEntitiesTypes.add(entityData.t);
                    }

                    for (let entityData of data.entities) {
                        let curEntity = Farm.entities[entityData.i];
                        if (typeof entityData.b !== 'undefined') {
                            curEntity.parentBuilding = Farm.buildings[entityData.b];
                            Farm.buildings[entityData.b].childEntities.push(curEntity);
                        }
                        if (typeof entityData.e !== 'undefined') {
                            curEntity.parentEntitiy = Farm.entities[entityData.e];
                            Farm.entities[entityData.e].childEntities.push(curEntity);
                        }
                    }

                    for (let plantData of data.plants) {

                        let blocks = [];

                        for (let foundationBlock of plantData.b) {
                            let curBlock = Farm.blocks[foundationBlock.x + ',' + foundationBlock.z];
                            blocks.push(curBlock);
                        }

                        let curPlant = new Plant(Farm, plantData.i, plantData.p.x / 2, plantData.p.z / 2, blocks, plantData.t);
                        loadedPlantTypes.add(plantData.t);
                        curPlant.stage = plantData.s;

                        Farm.plants[plantData.i] = curPlant;
                        Farm.plantIdx = Math.max(Farm.plantIdx, plantData.i + 1);

                        for (let curBlock of blocks) {
                            curBlock.plants.push(curPlant);
                            curBlock.updateGrassBlades();
                        }
                    }

                    Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));
                    updateSoilMesh(Farm);
                    loadedPlantTypes.forEach(function(plantType) {
                        updatePlantMesh(Farm, plantType);
                    });
                    updateTreeMesh(Farm);
                    loadedInstancedBuildingTypes.forEach(function(buildingType) {
                        updateInstancedBuildingMesh(Farm, buildingType);
                    });
                    loadedConnectibleBuildingTypes.forEach(function(buildingType) {
                        updateInstancedBuildingMesh(Farm, buildingType);
                    });
                    Farm.groundGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Farm.groundUVs), 2));

                    updateWaterMesh(Farm);

                    loadedEntitiesTypes.forEach(function(entityType) {
                        updateEntityMesh(Farm, entityType, 0);
                    });

                    resolve();

                }, function(percent) {});

            } else {
                //console.error("No data available");
            }
        }).catch((error) => {
            console.error(error);
        });
    });
}