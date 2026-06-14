import paper from 'paper';
import * as THREE from 'three';
export class AssemblyPreviewEngine {
    constructor(containerId) {
        this.animationId = 0;
        const el = document.getElementById(containerId);
        if (!el)
            throw new Error(`Container ${containerId} not found`);
        this.container = el;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 1, 10000);
        this.camera.position.set(0, -500, 500);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, -100, 200);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
        this.assemblyGroup = new THREE.Group();
        this.scene.add(this.assemblyGroup);
        window.addEventListener('resize', this.onWindowResize.bind(this));
        this.animate();
    }
    onWindowResize() {
        if (!this.container)
            return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    animate() {
        this.animationId = requestAnimationFrame(this.animate.bind(this));
        // Optional gentle rotation
        this.assemblyGroup.rotation.z += 0.005;
        this.renderer.render(this.scene, this.camera);
    }
    destroy() {
        cancelAnimationFrame(this.animationId);
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        this.clear();
        this.renderer.dispose();
        if (this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
    clear() {
        while (this.assemblyGroup.children.length > 0) {
            const child = this.assemblyGroup.children[0];
            if (child.geometry)
                child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material))
                    child.material.forEach(m => m.dispose());
                else
                    child.material.dispose();
            }
            this.assemblyGroup.remove(child);
        }
    }
    addSvgExtrusions(svgs, thickness, materialType = 'wood') {
        if (!paper.project) {
            const canvas = document.createElement('canvas');
            paper.setup(canvas);
        }
        paper.project.clear();
        const items = svgs.map(svg => paper.project.importSVG(svg, { expandShapes: true }));
        const paths = items.map(item => this.findPath(item)).filter(p => p !== null);
        let material;
        if (materialType === 'wood') {
            material = new THREE.MeshStandardMaterial({ color: 0xd2a679, roughness: 0.8, metalness: 0.1 });
        }
        else {
            material = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transmission: 0.9, opacity: 1, transparent: true, roughness: 0.1, metalness: 0.1, ior: 1.5 });
        }
        for (const path of paths) {
            if (path instanceof paper.CompoundPath) {
                const shapes = this.createThreeShapesFromCompoundPath(path);
                for (const shape of shapes) {
                    this.extrudeShape(shape, thickness, material);
                }
            }
            else if (path instanceof paper.Path) {
                const shape = this.createThreeShapeFromPath(path);
                this.extrudeShape(shape, thickness, material);
            }
        }
        // Center the assembly
        const box = new THREE.Box3().setFromObject(this.assemblyGroup);
        const center = box.getCenter(new THREE.Vector3());
        this.assemblyGroup.position.sub(center);
        this.camera.lookAt(0, 0, 0);
    }
    extrudeShape(shape, depth, material) {
        const extrudeSettings = {
            depth: depth,
            bevelEnabled: false,
        };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.y = -1; // Flip Y to match SVG coordinate system
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.assemblyGroup.add(mesh);
    }
    createThreeShapesFromCompoundPath(compoundPath) {
        const paths = compoundPath.children.filter(c => c instanceof paper.Path);
        if (paths.length === 0)
            return [];
        paths.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
        const outerPath = paths[0];
        const shape = this.createThreeShapeFromPath(outerPath);
        for (let i = 1; i < paths.length; i++) {
            const holePath = this.createThreePathFromPaperPath(paths[i]);
            shape.holes.push(holePath);
        }
        return [shape];
    }
    createThreeShapeFromPath(paperPath) {
        const shape = new THREE.Shape();
        this.buildThreePath(shape, paperPath);
        return shape;
    }
    createThreePathFromPaperPath(paperPath) {
        const path = new THREE.Path();
        this.buildThreePath(path, paperPath);
        return path;
    }
    buildThreePath(threePath, paperPath) {
        if (paperPath.segments.length === 0)
            return;
        const first = paperPath.segments[0].point;
        threePath.moveTo(first.x, first.y);
        for (let i = 1; i < paperPath.segments.length; i++) {
            const prev = paperPath.segments[i - 1];
            const curr = paperPath.segments[i];
            if (prev.handleOut.isZero() && curr.handleIn.isZero()) {
                threePath.lineTo(curr.point.x, curr.point.y);
            }
            else {
                threePath.bezierCurveTo(prev.point.x + prev.handleOut.x, prev.point.y + prev.handleOut.y, curr.point.x + curr.handleIn.x, curr.point.y + curr.handleIn.y, curr.point.x, curr.point.y);
            }
        }
        if (paperPath.closed) {
            const prev = paperPath.segments[paperPath.segments.length - 1];
            const curr = paperPath.segments[0];
            if (prev.handleOut.isZero() && curr.handleIn.isZero()) {
                threePath.lineTo(curr.point.x, curr.point.y);
            }
            else {
                threePath.bezierCurveTo(prev.point.x + prev.handleOut.x, prev.point.y + prev.handleOut.y, curr.point.x + curr.handleIn.x, curr.point.y + curr.handleIn.y, curr.point.x, curr.point.y);
            }
        }
    }
    findPath(item) {
        if (item instanceof paper.PathItem) {
            const cloned = item.clone({ insert: false });
            cloned.applyMatrix = false;
            cloned.matrix.reset();
            cloned.applyMatrix = true;
            cloned.transform(item.globalMatrix);
            return cloned;
        }
        if (item.children) {
            let combined = null;
            for (const child of item.children) {
                const found = this.findPath(child);
                if (found) {
                    if (!combined)
                        combined = found;
                    else
                        combined = combined.unite(found);
                }
            }
            return combined;
        }
        return null;
    }
}
//# sourceMappingURL=assemblyPreview.js.map