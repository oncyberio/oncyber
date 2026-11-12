// @ts-check

import { Box3, Line3, Plane, Ray, Sphere, Triangle, Vector3 } from "three";


const _v1 = new Vector3();
const _v2 = new Vector3();
const _plane = new Plane();
const _line1 = new Line3();
const _line2 = new Line3();

const MIN_COLLIDE_AREA = 1e-6;


const testBox = new Box3()


export class OctreeTriangle extends Triangle {

    constructor(a, b, c, meshName) {

        super(a, b, c)

        this.meshName = meshName
    }

    getAreaCached() {

        if (this._area == null) {

            this._area = this.getArea()
        }

        return this._area
    }

    applyMatrix4(mat) {
        
        this.a.applyMatrix4(mat)
        
        this.b.applyMatrix4(mat)
        
        this.c.applyMatrix4(mat)

        if (this._area != null) {

            this._area = this.getArea()
        }
    }

    /**
     * @param { Box3 } box
     */
    expandBox(box) {

        box.min.x = Math.min(box.min.x, this.a.x, this.b.x, this.c.x);

        box.min.y = Math.min(box.min.y, this.a.y, this.b.y, this.c.y);

        box.min.z = Math.min(box.min.z, this.a.z, this.b.z,this.c.z);

        box.max.x = Math.max(box.max.x, this.a.x, this.b.x, this.c.x);

        box.max.y = Math.max(box.max.y, this.a.y, this.b.y, this.c.y);

        box.max.z = Math.max(box.max.z, this.a.z, this.b.z, this.c.z);
    }

    /**
     * @param { Box3 } box
     * @returns { boolean }
     */
    intersectsBox(box) {

        // Fast path: check if a triangle vertex is inside the box
        if(box.containsPoint(this.a) || box.containsPoint(this.b) || box.containsPoint(this.c)) {
            return true
        }

        // 2nd Fast path: test if triangle is entirely outside the box
        testBox.makeEmpty()
        
        this.expandBox(testBox)

        if(!box.intersectsBox(testBox)) {
            return false
        }

        // Failed, use the slower SAT test
        return box.intersectsTriangle(this)
    }

    /**
     *
     * @param {import("./capsule").Capsule} capsule
     * @returns
     */
    capsuleIntersect(capsule) {

        if(this.getAreaCached() < MIN_COLLIDE_AREA) return null

        this.getPlane(_plane);

        const d1 = _plane.distanceToPoint(capsule.start) - capsule.radius;
        const d2 = _plane.distanceToPoint(capsule.end) - capsule.radius;

        if (
            (d1 > 0 && d2 > 0) ||
            (d1 < -capsule.radius && d2 < -capsule.radius)
        ) {
            return null;
        }

        const delta = Math.abs(d1 / (Math.abs(d1) + Math.abs(d2)));
        const intersectPoint = _v1.copy(capsule.start).lerp(capsule.end, delta);

        if (this.containsPoint(intersectPoint)) {
            return {
                normal: _plane.normal.clone(),
                point: intersectPoint.clone(),
                depth: Math.abs(Math.min(d1, d2)),
            };
        }

        const r2 = capsule.radius * capsule.radius;

        const line1 = _line1.set(capsule.start, capsule.end);

        const lines = [
            [this.a, this.b],
            [this.b, this.c],
            [this.c, this.a],
        ];

        for (let i = 0; i < lines.length; i++) {
            const line2 = _line2.set(lines[i][0], lines[i][1]);

            const [point1, point2] = capsule.lineLineMinimumPoints(
                line1,
                line2
            );

            if (point1.distanceToSquared(point2) < r2) {
                return {
                    normal: point1.clone().sub(point2).normalize(),
                    point: point2.clone(),
                    depth: capsule.radius - point1.distanceTo(point2),
                };
            }
        }

        return null;
    }

    /**
     * 
     * @param { Ray } ray 
     * @param { Vector3 } target
     * @returns 
     */
    rayIntersect(ray, target) {

        return ray.intersectTriangle(this.a, this.b, this.c, true, target)
    }


    getShapeTriangles(shape, results) {

        results.push(this)

        return results
    }

    traverseTriangles(callback) {

        callback(this)
    }

}