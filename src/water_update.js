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