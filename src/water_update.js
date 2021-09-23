import { maxWaterDepth } from "./building";

const DIRECTIONS = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
    { x: 0, z: -1 },
];

export function onUpdateWater(Farm) {
    for (let idx in Farm.waterUpdateList) {
        let curBuilding = Farm.waterUpdateList[idx];
        idx = idx.split(",");
        let x = parseInt(idx[0]);
        let z = parseInt(idx[1]);

        curBuilding.newWaterLevel = curBuilding.waterLevels[0];

        let dropping = true;

        for (let i = 0; i < DIRECTIONS.length; i++) {
            let direction = DIRECTIONS[i];
            let otherBuilding = Farm.waterUpdateList[(x + direction.x) + ',' + (z + direction.z)];

            if (x + direction.x < 0) {
                curBuilding.newWaterLevel = 0;
                dropping = false;
                break;
            }

            if (typeof otherBuilding === 'undefined') continue;

            if (otherBuilding.waterLevels[0] + 1 < curBuilding.waterLevels[0]) {
                curBuilding.newWaterLevel -= 1;
                dropping = false;
            } else if (otherBuilding.waterLevels[0] < curBuilding.waterLevels[0]) {
                dropping = false;
            }
        }
        if (dropping) {
            curBuilding.newWaterLevel += 1;
        }
        curBuilding.newWaterLevel = Math.max(0, Math.min(curBuilding.newWaterLevel, maxWaterDepth));
    }
    for (let idx in Farm.waterUpdateList) {
        let curBuilding = Farm.waterUpdateList[idx];
        idx = idx.split(",");
        let x = parseInt(idx[0]);
        let z = parseInt(idx[1]);

        curBuilding.waterLevels[0] = curBuilding.newWaterLevel;

        for (let i = 0; i < DIRECTIONS.length; i++) {
            let direction = DIRECTIONS[i];
            let otherBuilding = Farm.waterUpdateList[(x + direction.x) + ',' + (z + direction.z)];

            if (x + direction.x < 0) {
                curBuilding.waterLevels[1 + i] = curBuilding.newWaterLevel;
            } else if (typeof otherBuilding === 'undefined') {
                curBuilding.waterLevels[1 + i] = curBuilding.newWaterLevel + 1;
            } else {
                curBuilding.waterLevels[1 + i] = (curBuilding.newWaterLevel + otherBuilding.newWaterLevel) * 0.5;
            }
        }

        curBuilding.updateWaterMesh();
    }
    return true;
}

export function updateConnectibleConnections(Farm, buildingType, point1, point2) {
    for (let x = Math.max(0, point1.x - 1); x <= Math.min(Farm.numBlocks.x, point2.x + 1); x++) {
        for (let z = Math.max(0, point1.z - 1); z <= Math.min(Farm.numBlocks.z, point2.z + 1); z++) {
            let curBlock = Farm.blocks[x + ',' + z];
            if (typeof curBlock === 'undefined') continue;

            for (let building of curBlock.buildings) {
                if (building.type != buildingType) continue;

                let connections = [];

                for (let i = 0; i < DIRECTIONS.length; i++) {
                    let direction = DIRECTIONS[i];
                    let otherBlock = Farm.blocks[(x + direction.x) + ',' + (z + direction.z)];

                    if ((x + direction.x) < 0) {
                        connections.push(i);
                        continue;
                    }

                    if (typeof otherBlock === 'undefined') continue;

                    for (let building of otherBlock.buildings) {
                        if (building.type != buildingType) continue;

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
        }
    }
}