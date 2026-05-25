import paper from 'paper';
export class Pathfinder {
    static init() {
        if (!paper.project) {
            const canvas = document.createElement('canvas');
            paper.setup(canvas);
        }
    }
    /**
     * Performs a boolean operation between two or more SVG paths.
     * Takes SVG strings of the elements, and returns the SVG string of the result.
     */
    static performOperation(svg1, svg2, operation) {
        this.init();
        paper.project.clear();
        const item1 = paper.project.importSVG(svg1);
        const item2 = paper.project.importSVG(svg2);
        const path1 = this.findPath(item1);
        const path2 = this.findPath(item2);
        if (!path1 || !path2)
            return null;
        let result = null;
        switch (operation) {
            case 'unite':
                result = path1.unite(path2);
                break;
            case 'subtract':
                result = path1.subtract(path2);
                break;
            case 'intersect':
                result = path1.intersect(path2);
                break;
            case 'exclude':
                result = path1.exclude(path2);
                break;
        }
        if (!result)
            return null;
        // Export back to SVG string
        const resultSvg = result.exportSVG({ asString: true });
        return resultSvg;
    }
    static findPath(item) {
        if (item instanceof paper.PathItem)
            return item;
        if (item instanceof paper.Shape)
            return item.toPath();
        if (item.children) {
            for (const child of item.children) {
                const found = this.findPath(child);
                if (found)
                    return found;
            }
        }
        return null;
    }
}
//# sourceMappingURL=pathfinder.js.map