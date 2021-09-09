import * as THREE from 'three';

export class Block {
    constructor(x, z, type = 0) {
        this.x = x;
        this.z = z;

        this.type = type;
        this.plants = [];
        this.buildings = [];

        this.mesh = null;

        this.hash = xmur3(x + "+" + z)();
    }
};

export const BLOCK = {
    GRASS: 0,
    SOIL: 1,
};

function xmur3(str) {
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353),
        h = h << 13 | h >>> 19;
    return function() {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }
}