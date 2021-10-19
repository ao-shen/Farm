import * as THREE from 'three';
import { Vector2 } from 'three';
import { Text } from 'troika-three-text';
import { NineSlicePlane } from './nine_slice';

const TEXT = 0;
const INVENTORY = 1;
const BUTTON = 2;

const ITEM_SIZE = 48;

export class InfoBox {
    constructor(Farm, owner, ownerMeshProperty = "mesh") {

        this.Farm = Farm;
        this.owner = owner;
        this.ownerMeshProperty = ownerMeshProperty;

        this.name = "InfoBox_" + owner.name;

        this.width = 200;
        this.height = 300;

        this.pos = new Vector2();

        this.showing = false;

        this.infos = [];

        this.onClick = {};
        this.buttonIdx = 0;

        this.meshBackground = new NineSlicePlane(Farm.materialInfoBoxBackground, {
            width: this.width,
            height: this.height,
            border: 10
        });

        this.meshBackground.name = this.name;

        let geometry = new THREE.BufferGeometry();

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0]), 3));

        let material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, linewidth: 3 });

        this.lineMesh = new THREE.Line(geometry, material);
    }

    addText(text) {
        let textMesh = new Text();
        textMesh.text = text;
        textMesh.fontSize = 24;
        textMesh.font = 'assets/fonts/carrot.otf';
        textMesh.color = 0xd0a060;
        textMesh.outlineWidth = 0.5;
        textMesh.outlineColor = 0x302010;
        textMesh.name = this.name;
        this.meshBackground.add(textMesh);

        this.infos.push({ type: TEXT, mesh: textMesh });
    }

    addInventory(inventory) {
        this.infos.push({ type: INVENTORY, inventory: inventory, mesh: {} });
    }

    addButton(text, onClick) {

        let textMesh = new Text();
        textMesh.text = text;
        textMesh.fontSize = 24;
        textMesh.font = 'assets/fonts/carrot.otf';
        textMesh.color = 0x12101f;
        textMesh.outlineWidth = 0.5;
        textMesh.outlineColor = 0x06050f;
        textMesh.name = this.name + "_Button_" + this.buttonIdx;
        textMesh.anchorX = 'center';
        textMesh.anchorY = 'middle';
        textMesh.textAlign = 'center';
        this.meshBackground.add(textMesh);

        let buttonMesh = new NineSlicePlane(new THREE.MeshBasicMaterial({ map: this.Farm.texBuildButton, color: 0xc0c0c0, transparent: true }), {
            width: this.width - 20,
            height: 38,
            border: 12
        });
        buttonMesh.name = this.name + "_Button_" + this.buttonIdx;
        this.meshBackground.add(buttonMesh);

        this.onClick[this.buttonIdx] = onClick;
        this.buttonIdx++;

        this.infos.push({ type: BUTTON, mesh: buttonMesh, textMesh: textMesh });
    }

    updatePosition(x, y) {

        if (x > 0) {
            x += 200;
        } else {
            x -= 200;
        }
        y += 50;

        if (x - this.width / 2 < -window.innerWidth / 2) {
            x = -window.innerWidth / 2 + this.width / 2;
        }
        if (x + this.width / 2 > +window.innerWidth / 2) {
            x = +window.innerWidth / 2 - this.width / 2;
        }
        if (y - this.height / 2 < -window.innerHeight / 2) {
            y = -window.innerHeight / 2 + this.height / 2;
        }
        if (y + this.height / 2 > +window.innerHeight / 2) {
            y = +window.innerHeight / 2 - this.height / 2;
        }

        this.pos.set(x, y);
    }

    render() {
        if (this.showing) {

            let curXOffset = -this.width / 2 + 10;
            let curYOffset = +this.height / 2 - 10;
            for (let info of this.infos) {
                let mesh = info.mesh;
                switch (info.type) {
                    case TEXT:
                        mesh.position.set(curXOffset, curYOffset, 1);
                        curYOffset -= 30;
                        break;
                    case INVENTORY:
                        for (let type in info.mesh) {
                            if (typeof info.inventory.inventory[type] == "undefined") {
                                this.meshBackground.remove(info.mesh[type].sprite);
                                this.meshBackground.remove(info.mesh[type].text);
                                //info.mesh[type].sprite.dispose();
                                info.mesh[type].text.dispose();
                                delete info.mesh[type];
                            }
                        }
                        let curItem = 0;
                        for (let type in info.inventory.inventory) {
                            if (typeof mesh[type] == "undefined") {
                                let sprite = new THREE.Sprite(this.Farm.BUILDINGS[type].materialThumbnail);
                                sprite.center.set(0, 1);
                                sprite.scale.set(ITEM_SIZE - 3, ITEM_SIZE - 3, 1);
                                sprite.name = this.name;
                                this.meshBackground.add(sprite);

                                let textMesh = new Text();
                                textMesh.fontSize = 20;
                                textMesh.font = 'assets/fonts/carrot.otf';
                                textMesh.color = 0xd0a060;
                                textMesh.outlineWidth = 0.5;
                                textMesh.outlineColor = 0x302010;
                                textMesh.anchorX = 'center';
                                textMesh.anchorY = 'middle';
                                textMesh.textAlign = 'right';
                                textMesh.name = this.name;
                                this.meshBackground.add(textMesh);

                                mesh[type] = { sprite: sprite, text: textMesh };
                            }
                            mesh[type].sprite.position.set(curXOffset + curItem % 4 * ITEM_SIZE - 3, curYOffset - Math.floor(curItem / 4) * ITEM_SIZE, 1);
                            mesh[type].text.position.set(curXOffset + curItem % 4 * ITEM_SIZE - 3 + ITEM_SIZE - 10, curYOffset - Math.floor(curItem / 4) * ITEM_SIZE - ITEM_SIZE + 10, 2);
                            mesh[type].text.text = `${info.inventory.inventory[type]}`;
                            curItem++;
                        }
                        curYOffset -= Math.floor((curItem - 1) / 4 + 1) * ITEM_SIZE;
                        break;
                    case BUTTON:
                        mesh.position.set(0, curYOffset - 25, 1);
                        info.textMesh.position.set(0, curYOffset - 25, 2);
                        curYOffset -= 50;
                        break;
                }
            }

            this.meshBackground.position.set(this.pos.x, this.pos.y, -50);

            let pos = this.Farm.posToScreenPos(this.Farm.getCenterPoint(this.owner[this.ownerMeshProperty]), this.Farm.camera);

            let lineVertices = [pos.x, pos.y, -51];

            /*if (pos.y < this.pos.y) {
                if (pos.x < this.pos.x) {
                    lineVertices.push(pos.x - (pos.y - this.pos.y), this.pos.y, -51);
                } else {
                    lineVertices.push(pos.x + (pos.y - this.pos.y), this.pos.y, -51);
                }
            } else {
                if (pos.x < this.pos.x) {
                    lineVertices.push(pos.x + (pos.y - this.pos.y), this.pos.y, -51);
                } else {
                    lineVertices.push(pos.x - (pos.y - this.pos.y), this.pos.y, -51);
                }
            }*/
            if (pos.x < this.pos.x) {
                lineVertices.push(this.pos.x - 120, this.pos.y, -51);
            } else {
                lineVertices.push(this.pos.x + 120, this.pos.y, -51);
            }

            lineVertices.push(this.pos.x, this.pos.y, -51);

            this.lineMesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));
        }
    }

    show() {
        this.showing = true;
        this.Farm.visibleInfoBoxes.push(this);

        this.Farm.hudScene.add(this.meshBackground);
        this.Farm.hudScene.add(this.lineMesh);
    }

    hide() {
        this.showing = false;
        var index = this.Farm.visibleInfoBoxes.indexOf(this);
        if (index !== -1) {
            this.Farm.visibleInfoBoxes.splice(index, 1);
        }

        this.Farm.hudScene.remove(this.meshBackground);
        this.Farm.hudScene.remove(this.lineMesh);
    }

    toggle() {
        if (this.showing) {
            this.hide();
        } else {
            this.show();
        }
    }

    remove() {

        if (this.showing) {
            this.hide();
        }

        for (let info of this.infos) {
            switch (info.type) {
                case TEXT:
                    this.meshBackground.remove(info.mesh);
                    info.mesh.dispose();
                    break;
                case INVENTORY:
                    for (let type in info.mesh) {
                        this.meshBackground.remove(info.mesh[type].sprite);
                        this.meshBackground.remove(info.mesh[type].text);
                        //info.mesh[type].sprite.dispose();
                        info.mesh[type].text.dispose();
                    }
                    break;
            }
        }

        this.meshBackground.geometry.dispose();

        this.isRemoved = true;
    }
}