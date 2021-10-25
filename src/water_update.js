import { maxWaterDepth } from "./building";

const DIRECTIONS = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
    { x: 0, z: -1 },
];

let waterUpdateCount = 0;

export function onUpdateWater(Farm) {
    if (waterUpdateCount % 5 == 0) {
        for (let idx in Farm.waterUpdateList) {
            let curBuilding = Farm.waterUpdateList[idx];
            idx = idx.split(",");
            let x = parseInt(idx[0]);
            let z = parseInt(idx[1]);

            curBuilding.outputs = 0;

            for (let i = 0; i < DIRECTIONS.length; i++) {
                let direction = DIRECTIONS[i];
                let otherBuilding = Farm.waterUpdateList[(x + direction.x) + ',' + (z + direction.z)];

                if (typeof otherBuilding === 'undefined') continue;
                if (curBuilding.connectibleGroup != otherBuilding.connectibleGroup) continue;

                if (curBuilding.waterLevels[0] < otherBuilding.waterLevels[0]) {
                    curBuilding.outputs++;
                }
            }
        }
        for (let idx in Farm.waterUpdateList) {
            let curBuilding = Farm.waterUpdateList[idx];
            idx = idx.split(",");
            let x = parseInt(idx[0]);
            let z = parseInt(idx[1]);

            curBuilding.newWaterLevel = curBuilding.waterLevels[0];

            let droppingLevel = true;
            let loop = true;

            let curBlock = Farm.blocks[x + ',' + z];
            for (let otherBuilding of curBlock.buildings) {
                if (Farm.BUILDINGS[otherBuilding.type].waterSourceForConnectibleGroup) {
                    if (Farm.BUILDINGS[otherBuilding.type].waterSourceForConnectibleGroup[curBuilding.connectibleGroup]) {
                        curBuilding.newWaterLevel = 0;
                        droppingLevel = false;
                        loop = false;
                        break;
                    }
                }
            }

            for (let i = 0; i < DIRECTIONS.length && loop; i++) {
                let direction = DIRECTIONS[i];
                let otherBuilding = Farm.waterUpdateList[(x + direction.x) + ',' + (z + direction.z)];

                if (curBuilding.connectibleGroup == "water") {
                    if (x + direction.x < 0) {
                        curBuilding.newWaterLevel = 0;
                        droppingLevel = false;
                        break;
                    }
                }

                if (typeof otherBuilding === 'undefined') continue;
                if (curBuilding.connectibleGroup != otherBuilding.connectibleGroup) continue;

                let otherOutputableLevel = otherBuilding.outputs == 0 ? maxWaterDepth : (maxWaterDepth - (maxWaterDepth - otherBuilding.waterLevels[0]) / otherBuilding.outputs);

                if (curBuilding.leaky) {
                    if (curBuilding.newWaterLevel > otherOutputableLevel + curBuilding.leaky) {
                        curBuilding.newWaterLevel = otherOutputableLevel + curBuilding.leaky;
                        droppingLevel = false;
                    } else if (curBuilding.newWaterLevel >= otherOutputableLevel + curBuilding.leaky) {
                        droppingLevel = false;
                    }
                } else {
                    if (curBuilding.newWaterLevel > otherOutputableLevel + 0.0001) {
                        curBuilding.newWaterLevel = otherOutputableLevel + 0.0001;
                        droppingLevel = false;
                    } else if (curBuilding.newWaterLevel >= otherOutputableLevel + 0.0001) {
                        droppingLevel = false;
                    }
                }
            }

            if (droppingLevel) {
                curBuilding.newWaterLevel = Math.ceil(curBuilding.newWaterLevel + 1);
            }

            curBuilding.newWaterLevel = Math.max(0, Math.min(curBuilding.newWaterLevel, maxWaterDepth));
        }
        for (let idx in Farm.waterUpdateList) {
            let curBuilding = Farm.waterUpdateList[idx];
            idx = idx.split(",");
            let x = parseInt(idx[0]);
            let z = parseInt(idx[1]);

            let changed = false;

            if (curBuilding.waterLevels[0] != curBuilding.newWaterLevel) {
                changed = true;
            }
            curBuilding.waterLevels[0] = curBuilding.newWaterLevel;

            for (let i = 0; i < DIRECTIONS.length; i++) {
                let direction = DIRECTIONS[i];
                let otherBuilding = Farm.waterUpdateList[(x + direction.x) + ',' + (z + direction.z)];

                let old = curBuilding.waterLevels[1 + i];

                if (curBuilding.connectibleGroup == "water" && x + direction.x < 0) {
                    curBuilding.waterLevels[1 + i] = curBuilding.newWaterLevel;
                } else if (typeof otherBuilding === 'undefined' || curBuilding.connectibleGroup != otherBuilding.connectibleGroup) {
                    curBuilding.waterLevels[1 + i] = -1;
                } else {
                    curBuilding.waterLevels[1 + i] = (curBuilding.newWaterLevel + otherBuilding.newWaterLevel) * 0.5;
                }

                if (old != curBuilding.waterLevels[1 + i]) {
                    changed = true;
                }
            }

            if (changed) {
                curBuilding.updateWaterMesh();
            }
        }

    }

    // Update block wetness
    for (let x = waterUpdateCount % 7; x < Farm.numBlocks.x; x += 7) {
        for (let z = waterUpdateCount % 5; z < Farm.numBlocks.z; z += 5) {
            Farm.blocks[x + ',' + z].updateWetness();
        }
    }

    waterUpdateCount++;
}

export function updateConnectibleConnections(Farm, buildingType, points = null) {
    if (!Farm.BUILDINGS[buildingType].connectible) {
        return;
    }
    if (!points) {
        points = new Set();
        for (const curBuildingIdx in Farm.buildings) {
            let curBuilding = Farm.buildings[curBuildingIdx];
            if (curBuilding.type == buildingType) {
                points.add(curBuilding.centerBlock.x + ',' + curBuilding.centerBlock.z);
            }
        }
    }
    let connectToRiver = Farm.BUILDINGS[buildingType].name == "Trench";
    let connectibleGroup = Farm.BUILDINGS[buildingType].connectibleGroup;
    points.forEach(function(point) {
        let pointSplit = point.split(",");
        let x = parseInt(pointSplit[0]);
        let z = parseInt(pointSplit[1]);
        let curBlock = Farm.blocks[x + ',' + z];
        if (typeof curBlock === 'undefined') return;

        for (let building of curBlock.buildings) {
            if (building.type != buildingType && (!Farm.BUILDINGS[building.type].connectible || Farm.BUILDINGS[building.type].connectibleGroup != connectibleGroup)) continue;

            let connections = [];

            for (let i = 0; i < DIRECTIONS.length; i++) {
                let direction = DIRECTIONS[i];
                let otherBlock = Farm.blocks[(x + direction.x) + ',' + (z + direction.z)];

                if ((x + direction.x) < 0 && connectToRiver) {
                    connections.push(i);
                    continue;
                }

                if (typeof otherBlock === 'undefined') continue;

                for (let building of otherBlock.buildings) {
                    if (building.type != buildingType && Farm.BUILDINGS[building.type].connectibleGroup != connectibleGroup) continue;

                    connections.push(i);
                    break;
                }
            }

            if (connections.length == 0) {
                building.updateMeshVariation(0, 0);
            } else if (connections.length == 1) {
                building.updateMeshVariation(1, (connections[0] + 4) % 4);
            } else if (connections.length == 2) {
                if ((connections[0] + 2) % 4 == connections[1]) {
                    building.updateMeshVariation(2, (connections[0] + 4) % 4);
                } else if ((connections[0] + 1) % 4 == connections[1]) {
                    building.updateMeshVariation(3, (connections[0] + 3) % 4);
                } else {
                    building.updateMeshVariation(3, (connections[1] + 3) % 4);
                }
            } else if (connections.length == 3) {
                for (let i = 0; i < 4; i++) {
                    if (!connections.includes(i)) {
                        building.updateMeshVariation(4, (i + 4) % 4);
                        break;
                    }
                }
            } else if (connections.length == 4) {
                building.updateMeshVariation(5, 0);
            }
        }
    });
}