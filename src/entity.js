import * as THREE from 'three';

export class Entity {
    constructor(Farm, x, z, type, name = null) {
        this.Farm = Farm;
        this.pos = new THREE.Vector3(x, 0, z);
        this.type = type;
        this.name = name;

        this.mesh = this.Farm.ENTITIES[this.type].meshes[0].clone();
    }

    update() {

    }

    render() {

        if (this.mesh) {

        }

    }
}