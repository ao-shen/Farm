import { LZMA } from './lzma/lzma-min';

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
        blocks: [],
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

        for (let curBlock of curBuilding.foundationBlocks) {
            buildingData.f.push([curBlock.x, curBlock.z]);
        }

        data.buildings.push(buildingData);
    }

    for (const curEntityIdx in Farm.entities) {

        let curEntity = Farm.entities[curEntityIdx];
        let entityData = {};

        if (curEntity.isCustomer) continue;

        entityData.i = curEntity.idx;
        entityData.t = curEntity.type;
        entityData.p = { x: curEntity.pos.x, z: curEntity.pos.z };
        entityData.s = curEntity.side;
        entityData.v = curEntity.variation;

        if (curEntity.parentBuilding) entityData.b = curEntity.parentBuilding.idx;
        if (curEntity.parentEntitiy) entityData.e = curEntity.parentEntitiy.idx;

        data.entities.push(entityData);
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

            if (curBlock.plants.length != 0) {
                isDefault = false;
                blockData.p = [];
            }

            for (let curPlant of curBlock.plants) {
                let plantData = {};

                plantData.t = curPlant.type;
                plantData.s = curPlant.stage;

                blockData.p.push(plantData);
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

            LZMA.decompress(result, function(result) {
                console.log(result.length);
            }, function(percent) {});
        } else {
            console.error(error);
        }
    }, function(percent) {});
}

export function load(Farm) {

}