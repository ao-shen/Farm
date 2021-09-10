import * as THREE from 'three';

export class Entity {
    constructor(Farm, x, z, type, name = null) {
        this.Farm = Farm;
        this.pos = new THREE.Vector3(x * Farm.blockSize, 0, z * Farm.blockSize);
        this.type = type;
        this.name = name;

        this.parentBuilding = null;

        this.mesh = this.Farm.ENTITIES[this.type].meshes[0].clone();
        this.Farm.scene.add(this.mesh);

        let thisEntity = this;
        this.Farm.scheduler.addToSchedule(1000, function() {
            return thisEntity.onSchedule();
        });
    }

    onSchedule() {

        console.log("here");

        return true;
    }

    update() {

    }

    render() {
        if (this.mesh) {
            this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
        }
    }
}