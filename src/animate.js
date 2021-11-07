import { livestockPositionComputeShader, livestockVelocityComputeShader } from './shaders/livestock_compute';
import * as THREE from './three/src/Three';
import { Vector3 } from './three/src/Three';
import { GPUComputationRenderer } from './three_utils/GPUComputationRenderer';
import { updateEntityMesh } from './update_instanced_meshes';

let fps = 60;
let fpsInterval = 1000 / fps;
let then = window.performance.now();
let now, elapsed;

let position = new Float32Array(0);
let velocity = new Float32Array(0);

export function onAnimationFrame(Farm, newtime) {
    requestAnimationFrame(function(newtime) {
        onAnimationFrame(Farm, newtime);
    });

    now = newtime;
    elapsed = now - then;

    // if enough time has elapsed, draw the next frame

    if (elapsed > fpsInterval) {

        // Get ready for next frame by setting then=now, but...
        // Also, adjust for fpsInterval not being multiple of 16.67
        then = now - (elapsed % fpsInterval);

        animate(Farm, elapsed);
    }

}

export function animate(Farm, elapsed) {

    Farm.elapsed = elapsed;

    Farm.stats.begin();

    Farm.controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    Farm.grassBladeMaterial.uniforms.target_pos_x.value = Farm.controls.target.x + 160;
    Farm.grassBladeMaterial.uniforms.target_pos_z.value = Farm.controls.target.z + 160;
    Farm.groundMaterial.uniforms.target_pos_x.value = Farm.controls.target.x;
    Farm.groundMaterial.uniforms.target_pos_z.value = Farm.controls.target.z;
    Farm.sideGroundMaterial.uniforms.target_pos_x.value = Farm.controls.target.x;
    Farm.sideGroundMaterial.uniforms.target_pos_z.value = Farm.controls.target.z;
    Farm.sideParkingLotGroundMaterial.uniforms.target_pos_x.value = Farm.controls.target.x;
    Farm.sideParkingLotGroundMaterial.uniforms.target_pos_z.value = Farm.controls.target.z;

    Farm.scheduler.onFrame();

    // Update plants buildings and entities
    for (let plantType of Farm.plantTypeAwaitingMeshUpdate) {
        let plantBuilding = Farm.BUILDINGS[plantType];
        for (let m = 0; m < plantBuilding.meshes.length; m++) {
            plantBuilding.meshes[m].instanceMatrix.needsUpdate = true;
        }
    }
    Farm.plantTypeAwaitingMeshUpdate = new Set();

    for (let entityType of Farm.entityTypeAwaitingMeshUpdate) {
        updateEntityMesh(Farm, entityType);
    }
    Farm.entityTypeAwaitingMeshUpdate = new Set();

    if (Farm.grassBladeMeshNeedsUpdate) {
        Farm.grassBladeMesh.instanceMatrix.needsUpdate = true;
        Farm.grassBladeMeshNeedsUpdate = false;
    }

    for (let curBlockIdx in Farm.livestockedBlocks) {
        let curBlock = Farm.blocks[curBlockIdx];
        curBlock.livestockDensity *= 0.95;
        if (curBlock.livestockDensity < 0.1) curBlock.livestockDensity = 0;
        if (curBlock.livestockDensity == 0) {
            delete Farm.livestockedBlocks[curBlockIdx];
        }
    }

    for (const building in Farm.updatableBuildings) {
        Farm.updatableBuildings[building].update();
    }

    for (const entity in Farm.entities) {
        Farm.entities[entity].update();
    }

    //updateComputeRenderer(Farm);

    // Update mixers
    for (const mixer in Farm.mixers) {
        Farm.mixers[mixer].update(elapsed / 1000);
    }

    // Update dragging info boxes
    if (Farm.draggingInfoBox) {
        Farm.draggingInfoBox.pos.set(
            Farm.draggingInfoBoxStartPos.x + (Farm.mousePos.x - Farm.draggingInfoBoxStartMousePos.x) / 2 * window.innerWidth,
            Farm.draggingInfoBoxStartPos.y + (Farm.mousePos.y - Farm.draggingInfoBoxStartMousePos.y) / 2 * window.innerHeight,
            Farm.draggingInfoBoxStartPos.z
        );
    }

    // Update Shadows
    let d = 256 * Farm.controls.object.position.distanceTo(Farm.controls.target) / 100;

    Farm.shadowLight.shadow.camera.left = -d;
    Farm.shadowLight.shadow.camera.right = d;
    Farm.shadowLight.shadow.camera.top = d;
    Farm.shadowLight.shadow.camera.bottom = -d;
    Farm.shadowLight.shadow.camera.updateProjectionMatrix();

    d *= 10;

    Farm.shadowLight.position.set(Farm.controls.target.x + Farm.sun.x * d, Farm.sun.y * d, Farm.controls.target.z + Farm.sun.z * d);
    Farm.shadowLight.target.position.set(Farm.controls.target.x, 0, Farm.controls.target.z);

    //Farm.shadowLight.shadow.camera.position.set(Farm.controls.target.x, 10, Farm.controls.target.y);

    // Update time material
    for (let mat of Farm.timeUpdateMaterials) {
        mat.uniforms.time.value = now * 0.0001;
    }

    // Restaurant
    if (Farm.restaurantObj) {
        Farm.restaurantObj.update();
    }

    // Update Water Mesh
    if (Farm.waterVerticesBufferAttributeNeedsUpdate) {
        Farm.waterVerticesBufferAttributeNeedsUpdate = false;
        Farm.waterGeometry.computeVertexNormals();
        Farm.waterVerticesBufferAttribute.needsUpdate = true;
    }

    // Update HUD

    //Farm.money += 12345;
    Farm.textMoney.text = `${Farm.money}`;

    render(Farm);

    Farm.stats.end();

}

function render(Farm) {

    renderOverlays(Farm);
    renderInfoBoxes(Farm);

    for (const building in Farm.buildings) {
        Farm.buildings[building].render();
    }

    for (const entity in Farm.entities) {
        Farm.entities[entity].render();
    }

    // Restaurant
    if (Farm.restaurantObj) {
        Farm.restaurantObj.render();
    }

    Farm.renderer.clear();
    Farm.composer.render();
    //Farm.renderer.render(Farm.scene, Farm.camera);

    Farm.renderer.clearDepth();
    Farm.renderer.render(Farm.hudScene, Farm.hudCamera);
}

function renderInfoBoxes(Farm) {

    if (Farm.lens == Farm.LENS.DEFAULT) {
        Farm.infoBoxRaycaster.setFromCamera(Farm.mousePos, Farm.camera);

        const intersects = Farm.infoBoxRaycaster.intersectObject(Farm.groupInfoable, true);

        if (intersects.length > 0) {
            const selectedObject = intersects[0].object;
            Farm.outlinePass.selectedObjects = [selectedObject];
        } else {
            Farm.outlinePass.selectedObjects = [];
        }
        //Farm.outlinePass.selectedObjects = [Farm.restaurantObj.restaurantStandMesh];
    }
}

function renderOverlays(Farm) {

    Farm.mouseRaycaster.setFromCamera(Farm.mousePos, Farm.camera);
    const intersects = Farm.mouseRaycaster.intersectObject(Farm.groundIntersectionMesh);
    if (intersects.length > 0) {
        Farm.grassBladeMaterial.uniforms.mouse_pos_x.value = intersects[0].point.x;
        Farm.grassBladeMaterial.uniforms.mouse_pos_z.value = intersects[0].point.z;
    }

    if (Farm.lens == Farm.LENS.BUILD || Farm.lens == Farm.LENS.REMOVE) {

        Farm.hoveringBlock = null;
        if (intersects.length > 0) {

            const intersect = intersects[0];

            let point = intersect.point;

            /*point.add(new THREE.Vector3(meshPosition.getX(face.a), 0, meshPosition.getZ(face.a)));
            point.add(new THREE.Vector3(meshPosition.getX(face.b), 0, meshPosition.getZ(face.b)));
            point.add(new THREE.Vector3(meshPosition.getX(face.c), 0, meshPosition.getZ(face.c)));
            point.divideScalar(3);*/

            point = Farm.magnetToBlocks(point);
            let blockPos = Farm.posToBlocks(point.x, point.z);
            Farm.hoveringBlock = Farm.blocks[blockPos.x + ',' + blockPos.z];

            let rectScreenPoint1 = Farm.posToScreenPos(new Vector3(point.x, 0, point.z), Farm.camera);
            let rectScreenPoint2 = Farm.posToScreenPos(new Vector3(point.x + Farm.blockSize, 0, point.z), Farm.camera);
            let rectScreenPoint3 = Farm.posToScreenPos(new Vector3(point.x + Farm.blockSize, 0, point.z + Farm.blockSize), Farm.camera);
            let rectScreenPoint4 = Farm.posToScreenPos(new Vector3(point.x, 0, point.z + Farm.blockSize), Farm.camera);

            Farm.blockLine.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                rectScreenPoint1.x, rectScreenPoint1.y, -101,
                rectScreenPoint2.x, rectScreenPoint2.y, -101,
                rectScreenPoint3.x, rectScreenPoint3.y, -101,
                rectScreenPoint4.x, rectScreenPoint4.y, -101,
            ]), 3));

            //Farm.groundMesh.updateMatrix();

            //Farm.blockLine.geometry.applyMatrix4(Farm.groundMesh.matrix);

            Farm.blockLine.visible = true;

            // Find building side

            let offsetFromCenterOfBlock = intersect.point.clone();
            offsetFromCenterOfBlock.sub(point);
            offsetFromCenterOfBlock.subScalar(Farm.blockSize * 0.5);

            if (offsetFromCenterOfBlock.x <= offsetFromCenterOfBlock.z && offsetFromCenterOfBlock.x <= -offsetFromCenterOfBlock.z) {
                Farm.buildBuildingSide = Farm.SOUTH;
            } else if (offsetFromCenterOfBlock.x >= offsetFromCenterOfBlock.z && offsetFromCenterOfBlock.x <= -offsetFromCenterOfBlock.z) {
                Farm.buildBuildingSide = Farm.WEST;
            } else if (offsetFromCenterOfBlock.x >= offsetFromCenterOfBlock.z && offsetFromCenterOfBlock.x >= -offsetFromCenterOfBlock.z) {
                Farm.buildBuildingSide = Farm.NORTH;
            } else if (offsetFromCenterOfBlock.x <= offsetFromCenterOfBlock.z && offsetFromCenterOfBlock.x >= -offsetFromCenterOfBlock.z) {
                Farm.buildBuildingSide = Farm.EAST;
            }

            if (Farm.BUILDINGS[Farm.buildPaletteSelect].limitSide) {
                while (!Farm.BUILDINGS[Farm.buildPaletteSelect].limitSide[Farm.buildBuildingSide]) {
                    Farm.buildBuildingSide = (Farm.buildBuildingSide + 1) % 4;
                }
            }

            if (Farm.overlay == Farm.OVERLAY.BUILD_AREA ||
                Farm.overlay == Farm.OVERLAY.REMOVE_AREA ||
                Farm.overlay == Farm.OVERLAY.REMOVE_PLANTS ||
                Farm.overlay == Farm.OVERLAY.REMOVE_BUILDINGS) {

                let rectX1 = Math.min(point.x, Farm.buildAreaCorner.x);
                let rectZ1 = Math.min(point.z, Farm.buildAreaCorner.z);
                let rectX2 = Math.max(point.x, Farm.buildAreaCorner.x) + Farm.blockSize;
                let rectZ2 = Math.max(point.z, Farm.buildAreaCorner.z) + Farm.blockSize;

                Farm.buildAreaPoint1 = Farm.posToBlocks(rectX1, rectZ1);
                Farm.buildAreaPoint2 = Farm.posToBlocks(rectX2 - Farm.blockSize, rectZ2 - Farm.blockSize);

                rectScreenPoint1 = Farm.posToScreenPos(new Vector3(rectX1, 0, rectZ1), Farm.camera);
                rectScreenPoint2 = Farm.posToScreenPos(new Vector3(rectX1, 0, rectZ2), Farm.camera);
                rectScreenPoint3 = Farm.posToScreenPos(new Vector3(rectX2, 0, rectZ2), Farm.camera);
                rectScreenPoint4 = Farm.posToScreenPos(new Vector3(rectX2, 0, rectZ1), Farm.camera);

                Farm.buildAreaRect.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                    rectScreenPoint1.x, rectScreenPoint1.y, -100,
                    rectScreenPoint2.x, rectScreenPoint2.y, -100,
                    rectScreenPoint3.x, rectScreenPoint3.y, -100,
                    rectScreenPoint4.x, rectScreenPoint4.y, -100,
                    rectScreenPoint1.x, rectScreenPoint1.y, -100,
                ]), 3));

                // update build building preview
                if (Farm.buildBuildingMesh != null) {
                    Farm.buildBuildingMesh.rotation.y = -(Farm.buildBuildingSide - 1) * Math.PI / 2;
                    Farm.buildBuildingMesh.position.set(
                        (point.x) + 0.5 * Farm.blockSize,
                        0.01,
                        (point.z) + 0.5 * Farm.blockSize
                    );
                }
            } else if (Farm.overlay == Farm.OVERLAY.BUILD_LINE) {

                let rectX1 = Math.min(point.x, Farm.buildAreaCorner.x);
                let rectZ1 = Math.min(point.z, Farm.buildAreaCorner.z);
                let rectX2 = Math.max(point.x, Farm.buildAreaCorner.x) + Farm.blockSize;
                let rectZ2 = Math.max(point.z, Farm.buildAreaCorner.z) + Farm.blockSize;

                if ((point.x - Farm.buildAreaCorner.x - point.z + Farm.buildAreaCorner.z) * (point.x - Farm.buildAreaCorner.x + point.z - Farm.buildAreaCorner.z) < 0) {
                    rectX1 = Farm.buildAreaCorner.x;
                    rectX2 = Farm.buildAreaCorner.x + Farm.blockSize;
                } else {
                    rectZ1 = Farm.buildAreaCorner.z;
                    rectZ2 = Farm.buildAreaCorner.z + Farm.blockSize;
                }

                Farm.buildAreaPoint1 = Farm.posToBlocks(rectX1, rectZ1);
                Farm.buildAreaPoint2 = Farm.posToBlocks(rectX2 - Farm.blockSize, rectZ2 - Farm.blockSize);

                rectScreenPoint1 = Farm.posToScreenPos(new Vector3(rectX1, 0, rectZ1), Farm.camera);
                rectScreenPoint2 = Farm.posToScreenPos(new Vector3(rectX1, 0, rectZ2), Farm.camera);
                rectScreenPoint3 = Farm.posToScreenPos(new Vector3(rectX2, 0, rectZ2), Farm.camera);
                rectScreenPoint4 = Farm.posToScreenPos(new Vector3(rectX2, 0, rectZ1), Farm.camera);

                Farm.buildAreaRect.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                    rectScreenPoint1.x, rectScreenPoint1.y, -100,
                    rectScreenPoint2.x, rectScreenPoint2.y, -100,
                    rectScreenPoint3.x, rectScreenPoint3.y, -100,
                    rectScreenPoint4.x, rectScreenPoint4.y, -100,
                    rectScreenPoint1.x, rectScreenPoint1.y, -100,
                ]), 3));

                // update build building preview
                if (Farm.buildBuildingMesh != null) {
                    Farm.buildBuildingMesh.rotation.y = -(Farm.buildBuildingSide - 1) * Math.PI / 2;
                    Farm.buildBuildingMesh.position.set(
                        (point.x) + 0.5 * Farm.blockSize,
                        0.01,
                        (point.z) + 0.5 * Farm.blockSize
                    );
                }
            } else if (Farm.overlay == Farm.OVERLAY.BUILD_SINGLE) {

                let curSizeX = Farm.BUILDINGS[Farm.buildPaletteSelect].size.x - 1;
                let curSizeZ = Farm.BUILDINGS[Farm.buildPaletteSelect].size.z - 1;

                let rectX1 = 0;
                let rectZ1 = 0;
                let rectX2 = 0;
                let rectZ2 = 0;

                if (Farm.buildBuildingSide == 3) {
                    rectX1 = (blockPos.x) * Farm.blockSize;
                    rectZ1 = (blockPos.z) * Farm.blockSize;
                    rectX2 = (blockPos.x + curSizeX) * Farm.blockSize;
                    rectZ2 = (blockPos.z + curSizeZ) * Farm.blockSize;
                } else if (Farm.buildBuildingSide == 2) {
                    rectX1 = (blockPos.x) * Farm.blockSize;
                    rectZ1 = (blockPos.z) * Farm.blockSize;
                    rectX2 = (blockPos.x + curSizeZ) * Farm.blockSize;
                    rectZ2 = (blockPos.z - curSizeX) * Farm.blockSize;
                } else if (Farm.buildBuildingSide == 1) {
                    rectX1 = (blockPos.x) * Farm.blockSize;
                    rectZ1 = (blockPos.z) * Farm.blockSize;
                    rectX2 = (blockPos.x - curSizeX) * Farm.blockSize;
                    rectZ2 = (blockPos.z - curSizeZ) * Farm.blockSize;
                } else {
                    rectX1 = (blockPos.x) * Farm.blockSize;
                    rectZ1 = (blockPos.z) * Farm.blockSize;
                    rectX2 = (blockPos.x - curSizeZ) * Farm.blockSize;
                    rectZ2 = (blockPos.z + curSizeX) * Farm.blockSize;
                }

                rectX1 -= 0.5 * Farm.blockSize;
                rectZ1 -= 0.5 * Farm.blockSize;
                rectX2 -= 0.5 * Farm.blockSize;
                rectZ2 -= 0.5 * Farm.blockSize;

                Farm.buildAreaPoint1 = Farm.posToBlocks(rectX1, rectZ1);
                Farm.buildAreaPoint2 = Farm.posToBlocks(rectX2, rectZ2);

                let screenRectX1 = Math.min(rectX1, rectX2);
                let screenRectZ1 = Math.min(rectZ1, rectZ2);
                let screenRectX2 = Math.max(rectX1, rectX2) + Farm.blockSize;
                let screenRectZ2 = Math.max(rectZ1, rectZ2) + Farm.blockSize;

                rectScreenPoint1 = Farm.posToScreenPos(new Vector3(screenRectX1, 0, screenRectZ1), Farm.camera);
                rectScreenPoint2 = Farm.posToScreenPos(new Vector3(screenRectX1, 0, screenRectZ2), Farm.camera);
                rectScreenPoint3 = Farm.posToScreenPos(new Vector3(screenRectX2, 0, screenRectZ2), Farm.camera);
                rectScreenPoint4 = Farm.posToScreenPos(new Vector3(screenRectX2, 0, screenRectZ1), Farm.camera);

                Farm.buildAreaRect.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                    rectScreenPoint1.x, rectScreenPoint1.y, -100,
                    rectScreenPoint2.x, rectScreenPoint2.y, -100,
                    rectScreenPoint3.x, rectScreenPoint3.y, -100,
                    rectScreenPoint4.x, rectScreenPoint4.y, -100,
                    rectScreenPoint1.x, rectScreenPoint1.y, -100,
                ]), 3));

                // update build building preview
                if (Farm.buildBuildingMesh != null) {

                    let centerOffsetX = 0;
                    let centerOffsetZ = 0;

                    if (Farm.BUILDINGS[Farm.buildPaletteSelect].center) {
                        if (Farm.buildBuildingSide == 3) {
                            centerOffsetX = Farm.BUILDINGS[Farm.buildPaletteSelect].center.x;
                            centerOffsetZ = Farm.BUILDINGS[Farm.buildPaletteSelect].center.z;
                        } else if (Farm.buildBuildingSide == 2) {
                            centerOffsetX = Farm.BUILDINGS[Farm.buildPaletteSelect].center.z;
                            centerOffsetZ = -Farm.BUILDINGS[Farm.buildPaletteSelect].center.x;
                        } else if (Farm.buildBuildingSide == 1) {
                            centerOffsetX = -Farm.BUILDINGS[Farm.buildPaletteSelect].center.x;
                            centerOffsetZ = -Farm.BUILDINGS[Farm.buildPaletteSelect].center.z;
                        } else {
                            centerOffsetX = -Farm.BUILDINGS[Farm.buildPaletteSelect].center.z;
                            centerOffsetZ = Farm.BUILDINGS[Farm.buildPaletteSelect].center.x;
                        }
                    }

                    let buildingSize = Farm.BUILDINGS[Farm.buildPaletteSelect].size;
                    Farm.buildBuildingMesh.rotation.y = -(Farm.buildBuildingSide - 1) * Math.PI / 2;
                    Farm.buildBuildingMesh.position.set(
                        ((Farm.buildAreaPoint1.x + Farm.buildAreaPoint2.x) * 0.5 + centerOffsetX) * Farm.blockSize,
                        0,
                        ((Farm.buildAreaPoint1.z + Farm.buildAreaPoint2.z) * 0.5 + centerOffsetZ) * Farm.blockSize
                    );
                }
            }
        } else {
            Farm.blockLine.visible = false;
        }
    } else {
        Farm.blockLine.visible = false;
    }
}

function updateComputeRenderer(Farm) {

    function isSafari() {

        return !!navigator.userAgent.match(/Safari/i) && !navigator.userAgent.match(/Chrome/i);

    }

    function fillPositionTexture(texture) {
        const theArray = texture.image.data;
        for (let k = 0, kl = theArray.length; k < kl; k += 4) {
            const x = Math.random() * 1000;
            const y = 0;
            const z = Math.random() * 1000;
            theArray[k + 0] = x;
            theArray[k + 1] = y;
            theArray[k + 2] = z;
            theArray[k + 3] = 1;
        }
    }

    function fillVelocityTexture(texture) {
        const theArray = texture.image.data;
        for (let k = 0, kl = theArray.length; k < kl; k += 4) {
            const x = Math.random() - 0.5;
            const y = 0;
            const z = Math.random() - 0.5;

            theArray[k + 0] = x * 1;
            theArray[k + 1] = y * 1;
            theArray[k + 2] = z * 1;
            theArray[k + 3] = 1;
        }
    }

    let gpuEntities = [];
    for (const entity in Farm.entities) {
        if (Farm.entities[entity].instanced) {
            Farm.entities[entity].gpuIdx = gpuEntities.length;
            gpuEntities.push(Farm.entities[entity]);
        }
    }

    if (Math.pow(Farm.gpuComputeWidth, 2) < gpuEntities.length) {

        Farm.gpuComputeWidth = Math.ceil(Math.sqrt(gpuEntities.length));

        position = new Float32Array(Math.pow(Farm.gpuComputeWidth, 2) * 4);
        velocity = new Float32Array(Math.pow(Farm.gpuComputeWidth, 2) * 4);

        Farm.gpuCompute = new GPUComputationRenderer(Farm.gpuComputeWidth, Farm.gpuComputeWidth, Farm.renderer);

        let gpuCompute = Farm.gpuCompute;

        if (isSafari()) {
            gpuCompute.setDataType(THREE.HalfFloatType);
        }

        const dtPosition = gpuCompute.createTexture();
        const dtVelocity = gpuCompute.createTexture();
        fillPositionTexture(dtPosition);
        fillVelocityTexture(dtVelocity);

        Farm.velocityVariable = gpuCompute.addVariable('textureVelocity', livestockVelocityComputeShader, dtVelocity);
        Farm.positionVariable = gpuCompute.addVariable('texturePosition', livestockPositionComputeShader, dtPosition);

        gpuCompute.setVariableDependencies(Farm.velocityVariable, [Farm.positionVariable, Farm.velocityVariable]);
        gpuCompute.setVariableDependencies(Farm.positionVariable, [Farm.positionVariable, Farm.velocityVariable]);

        Farm.positionUniforms = Farm.positionVariable.material.uniforms;
        Farm.velocityUniforms = Farm.velocityVariable.material.uniforms;

        Farm.positionUniforms['time'] = { value: 0.0 };
        Farm.positionUniforms['delta'] = { value: 0.0 };
        Farm.velocityUniforms['time'] = { value: 1.0 };
        Farm.velocityUniforms['delta'] = { value: 0.0 };
        Farm.velocityUniforms['testing'] = { value: 1.0 };
        Farm.velocityUniforms['separationDistance'] = { value: 1.0 };
        Farm.velocityUniforms['alignmentDistance'] = { value: 1.0 };
        Farm.velocityUniforms['cohesionDistance'] = { value: 1.0 };
        Farm.velocityUniforms['freedomFactor'] = { value: 1.0 };
        Farm.velocityUniforms['predator'] = { value: new THREE.Vector3() };
        Farm.velocityVariable.material.defines.BOUNDS = "1000.0";

        Farm.velocityVariable.wrapS = THREE.RepeatWrapping;
        Farm.velocityVariable.wrapT = THREE.RepeatWrapping;
        Farm.positionVariable.wrapS = THREE.RepeatWrapping;
        Farm.positionVariable.wrapT = THREE.RepeatWrapping;

        const error = gpuCompute.init();

        if (error !== null) {

            console.error(error);

        }
    }

    if (gpuEntities.length == 0) return;

    Farm.positionUniforms['time'].value = now / 10000;
    Farm.positionUniforms['delta'].value = elapsed / 10000;
    Farm.velocityUniforms['time'].value = now / 10000;
    Farm.velocityUniforms['delta'].value = elapsed / 10000;

    Farm.velocityUniforms['predator'].value.set(100000, 0, 100000);

    Farm.gpuCompute.compute();

    Farm.renderer.readRenderTargetPixels(Farm.gpuCompute.getCurrentRenderTarget(Farm.positionVariable), 0, 0, Farm.gpuComputeWidth, Farm.gpuComputeWidth, position);
    Farm.renderer.readRenderTargetPixels(Farm.gpuCompute.getCurrentRenderTarget(Farm.velocityVariable), 0, 0, Farm.gpuComputeWidth, Farm.gpuComputeWidth, velocity);

    for (let i = 0; i < gpuEntities.length; i++) {
        gpuEntities[i].pos.set(position[i * 4 + 0], position[i * 4 + 1], position[i * 4 + 2]);
    }
}

// milk, cook, popcorn

//