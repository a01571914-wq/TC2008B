'use strict';

import * as twgl from 'twgl-base.js';
import GUI from 'lil-gui';
import { diamond, smiley } from '../libs/shapes.js';
import { V2, M3, type Vec2, type Mat3 } from '../libs/2d-lib.js';
import { Scene } from '../libs/scene.js';

import vsGLSL from './vs_matrices_vcolor.glsl?raw';
import fsGLSL from './fs_vertex_color.glsl?raw';

class RotationScene extends Scene {
    settings = {
        order: 'scale -> rotation -> translation',
    };

    constructor(gl: WebGL2RenderingContext) {
        super(gl, vsGLSL, fsGLSL);

        const model = this.addObject('model', smiley(100), [1, 1, 1, 1]);
        model.transforms.t.x = gl.canvas.width / 2 + 150;
        model.transforms.t.y = gl.canvas.height / 2;

        const pivot = this.addObject('pivot', diamond(15), [0.6, 0.6, 0.6, 1]);
        pivot.transforms.t.x = gl.canvas.width / 2;
        pivot.transforms.t.y = gl.canvas.height / 2;
    }

    protected render(): void {
        const { gl, programInfo } = this;
        const model = this.getObject('model');
        const pivot = this.getObject('pivot');

        const v2_trans: Vec2 = V2.create(model.transforms.t.x, model.transforms.t.y);
        const v2_scale: Vec2 = V2.create(model.transforms.s.x, model.transforms.s.y);
        const v2_pivot_to_center: Vec2 = V2.create(-pivot.transforms.t.x, -pivot.transforms.t.y);
        const v2_center_to_pivot: Vec2 = V2.create(pivot.transforms.t.x, pivot.transforms.t.y);

        const scaleMatrix: Mat3 = M3.scale(v2_scale);
        const translateMatrix: Mat3 = M3.translation(v2_trans);
        const pivotToCenter: Mat3 = M3.translation(v2_pivot_to_center);
        const centerToPivot: Mat3 = M3.translation(v2_center_to_pivot);
        const rotateMatrix: Mat3 = M3.rotation(model.transforms.rr.z);

        // Rotation around the pivot: move pivot to origin, rotate, move back
        let rotateAroundPivot: Mat3 = M3.identity();
        rotateAroundPivot = M3.multiply(pivotToCenter, rotateAroundPivot);
        rotateAroundPivot = M3.multiply(rotateMatrix, rotateAroundPivot);
        rotateAroundPivot = M3.multiply(centerToPivot, rotateAroundPivot);

        // Pick the order in which the three matrices are applied
        let first: Mat3;
        let second: Mat3;
        let third: Mat3;

        if (this.settings.order === 'scale -> rotation -> translation') {
            first = scaleMatrix; second = rotateAroundPivot; third = translateMatrix;
        } else if (this.settings.order === 'scale -> translation -> rotation') {
            first = scaleMatrix; second = translateMatrix; third = rotateAroundPivot;
        } else if (this.settings.order === 'translation -> scale -> rotation') {
            first = translateMatrix; second = scaleMatrix; third = rotateAroundPivot;
        } else if (this.settings.order === 'rotation -> translation -> scale') {
            first = rotateAroundPivot; second = translateMatrix; third = scaleMatrix;
        } else {
            // rotation -> scale -> translation
            first = rotateAroundPivot; second = scaleMatrix; third = translateMatrix;
        }

        // The first matrix is applied first, so it is multiplied first
        let modelTransforms: Mat3 = M3.identity();
        modelTransforms = M3.multiply(first, modelTransforms);
        modelTransforms = M3.multiply(second, modelTransforms);
        modelTransforms = M3.multiply(third, modelTransforms);

        gl.useProgram(programInfo.program);

        let uniforms = {
            u_resolution: [gl.canvas.width, gl.canvas.height],
            u_transforms: modelTransforms,
            u_color: model.color,
        };
        twgl.setUniforms(programInfo, uniforms);
        gl.bindVertexArray(model.vao);
        twgl.drawBufferInfo(gl, model.bufferInfo);

        // The pivot only gets a translation
        const pivotTransforms: Mat3 = M3.multiply(centerToPivot, M3.identity());
        uniforms = {
            u_resolution: [gl.canvas.width, gl.canvas.height],
            u_transforms: pivotTransforms,
            u_color: pivot.color,
        };
        twgl.setUniforms(programInfo, uniforms);
        gl.bindVertexArray(pivot.vao);
        twgl.drawBufferInfo(gl, pivot.bufferInfo);
    }

    setupUI(): void {
        const { gl } = this;
        const model = this.getObject('model');
        const pivot = this.getObject('pivot');

        const gui = new GUI();

        const modelFolder = gui.addFolder('Model');

        // Dropdown to choose the order of the transformations
        modelFolder.add(this.settings, 'order', [
            'scale -> rotation -> translation',
            'scale -> translation -> rotation',
            'translation -> scale -> rotation',
            'rotation -> translation -> scale',
            'rotation -> scale -> translation',
        ]);

        const traFolder = modelFolder.addFolder('Translation');
        traFolder.add(model.transforms.t, 'x', 0, gl.canvas.width);
        traFolder.add(model.transforms.t, 'y', 0, gl.canvas.height);

        // Rotation is shown in degrees and converted to radians
        const rotFolder = modelFolder.addFolder('Rotation');
        rotFolder.add(model.transforms.rd, 'z', -360, 360)
            .decimals(2)
            .onChange((value: number) => {
                model.transforms.rr.z = value * Math.PI / 180.0;
            });

        const scaFolder = modelFolder.addFolder('Scale');
        scaFolder.add(model.transforms, 's_all', -5, 5)
            .onChange((value: number) => {
                model.transforms.s.x = value;
                model.transforms.s.y = value;
            });
        scaFolder.add(model.transforms.s, 'x', -5, 5).listen();
        scaFolder.add(model.transforms.s, 'y', -5, 5).listen();

        const pivotFolder = gui.addFolder('Pivot');
        pivotFolder.add(pivot.transforms.t, 'x', 0, gl.canvas.width);
        pivotFolder.add(pivot.transforms.t, 'y', 0, gl.canvas.height);
    }
}

/*
 * Main function to initialize the WebGL context, create the scene, and set up the UI.
 */
function main(): void {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('No canvas element found in the document');
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 is not supported by this browser');

    const scene = new RotationScene(gl);
    scene.setupUI();
    scene.draw(0);
}

main()