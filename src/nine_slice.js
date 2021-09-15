import * as THREE from 'three';

const basePlaneVertices = [0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 0];

export class NineSlicePlane extends THREE.Mesh {
    constructor(material, dimensions = { width: 100, height: 100, border: 25 }, uvBorder = 0.25) {

        let geometry = new THREE.BufferGeometry();

        let vertices = [];
        let uvs = [];

        const vertexOffsetsX = [0, dimensions.border, dimensions.width - dimensions.border, dimensions.width];
        const vertexOffsetsY = [0, dimensions.border, dimensions.height - dimensions.border, dimensions.height];
        const uvOffsets = [0, uvBorder, 1 - uvBorder, 1];

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 6; k++) {
                    vertices.push(
                        basePlaneVertices[k * 2] * (vertexOffsetsX[i + 1] - vertexOffsetsX[i]) + vertexOffsetsX[i] - dimensions.width * 0.5,
                        basePlaneVertices[k * 2 + 1] * (vertexOffsetsY[j + 1] - vertexOffsetsY[j]) + vertexOffsetsY[j] - dimensions.height * 0.5,
                        0
                    );
                    uvs.push(uvOffsets[i + basePlaneVertices[k * 2]], uvOffsets[j + basePlaneVertices[k * 2 + 1]]);
                }
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));

        super(geometry, material);

        this.nineSliceGeometry = geometry;
        this.nineSliceVertices = vertices;

    }
}