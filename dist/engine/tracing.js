import paper from 'paper';
export class TracingEngine {
    static init() {
        if (!paper.project) {
            paper.setup(document.createElement('canvas'));
        }
    }
    // Generate Image Data from base64/URL
    static async getImageData(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx)
                    return reject('No Canvas 2D context');
                ctx.drawImage(img, 0, 0);
                resolve(ctx.getImageData(0, 0, img.width, img.height));
            };
            img.onerror = reject;
            img.src = url;
        });
    }
    // Shared boundary tracing (Moore neighborhood)
    static async traceBinary(binary, width, height, cornerThreshold = 1.5) {
        const visited = new Uint8Array(width * height);
        const paths = [];
        let lastYield = performance.now();
        for (let y = 0; y < height; y++) {
            if (performance.now() - lastYield > 16) {
                await new Promise(resolve => setTimeout(resolve, 0));
                lastYield = performance.now();
            }
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (binary[idx] === 1 && visited[idx] === 0) {
                    if (x === 0 || binary[idx - 1] === 0) {
                        const poly = this.traceContour(binary, width, height, x, y, visited);
                        if (poly.length > 2) {
                            const path = new paper.Path({ segments: poly, closed: true });
                            if (cornerThreshold > 0) {
                                path.simplify(cornerThreshold);
                            }
                            paths.push(path);
                        }
                    }
                }
            }
        }
        return paths;
    }
    static traceContour(binary, width, height, startX, startY, visited) {
        const poly = [];
        const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
        let cx = startX;
        let cy = startY;
        let dir = 6;
        const maxIters = width * height * 2;
        let iters = 0;
        while (iters++ < maxIters) {
            poly.push(new paper.Point(cx, cy));
            visited[cy * width + cx] = 1;
            let found = false;
            for (let i = 0; i < 8; i++) {
                const ndir = (dir + i) % 8;
                const nx = cx + dirs[ndir][0];
                const ny = cy + dirs[ndir][1];
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    if (binary[ny * width + nx] === 1) {
                        cx = nx;
                        cy = ny;
                        dir = (ndir + 6) % 8;
                        found = true;
                        break;
                    }
                }
            }
            if (!found)
                break;
            if (cx === startX && cy === startY)
                break;
        }
        return poly;
    }
    // Feature 52: Threshold Silhouette Tracer
    static async traceSilhouette(imageData, threshold = 128, cornerThreshold = 1.5) {
        this.init();
        paper.project.clear();
        const { width, height, data } = imageData;
        const binary = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < threshold && a > 128) {
                binary[(i / 4)] = 1;
            }
        }
        const paths = await this.traceBinary(binary, width, height, cornerThreshold);
        const group = new paper.Group();
        paths.forEach(p => {
            p.fillColor = new paper.Color('#000000');
            group.addChild(p);
        });
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${group.exportSVG({ asString: true })}</svg>`;
    }
    // Feature 54: High-Pass Edge Detection (Sobel)
    static async traceEdges(imageData, threshold = 100, cornerThreshold = 1.5) {
        const { width, height, data } = imageData;
        const binary = new Uint8Array(width * height);
        const gray = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const p11 = gray[(y - 1) * width + (x - 1)], p12 = gray[(y - 1) * width + x], p13 = gray[(y - 1) * width + (x + 1)];
                const p21 = gray[y * width + (x - 1)], p23 = gray[y * width + (x + 1)];
                const p31 = gray[(y + 1) * width + (x - 1)], p32 = gray[(y + 1) * width + x], p33 = gray[(y + 1) * width + (x + 1)];
                const gx = -p11 + p13 - 2 * p21 + 2 * p23 - p31 + p33;
                const gy = -p11 - 2 * p12 - p13 + p31 + 2 * p32 + p33;
                const mag = Math.sqrt(gx * gx + gy * gy);
                if (mag > threshold) {
                    binary[y * width + x] = 1;
                }
            }
        }
        this.init();
        paper.project.clear();
        const paths = await this.traceBinary(binary, width, height, cornerThreshold);
        const group = new paper.Group();
        paths.forEach(p => {
            p.strokeColor = new paper.Color('#000000');
            p.fillColor = null;
            group.addChild(p);
        });
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${group.exportSVG({ asString: true })}</svg>`;
    }
    // Feature 55: Despeckle & Noise Reduction
    static despeckle(svg, minArea) {
        this.init();
        paper.project.clear();
        const item = paper.project.importSVG(svg, { expandShapes: true });
        const traverse = (node) => {
            if (node instanceof paper.Path) {
                if (Math.abs(node.area) < minArea && node.length < Math.sqrt(minArea) * 4) {
                    node.remove();
                }
            }
            else if (node.children) {
                for (let i = node.children.length - 1; i >= 0; i--) {
                    traverse(node.children[i]);
                }
            }
        };
        traverse(item);
        return `<svg xmlns="http://www.w3.org/2000/svg">${item.exportSVG({ asString: true })}</svg>`;
    }
    // Feature 51: Bitmap-to-Vector Centerline Tracer
    static async traceCenterline(imageData, cornerThreshold = 1.5) {
        const { width, height, data } = imageData;
        let binary = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if ((0.299 * r + 0.587 * g + 0.114 * b) < 128 && a > 128)
                binary[i / 4] = 1;
        }
        const getP = (b, x, y) => (x >= 0 && x < width && y >= 0 && y < height) ? b[y * width + x] : 0;
        let hasChanged = true;
        while (hasChanged) {
            hasChanged = false;
            const marker = new Uint8Array(width * height);
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = y * width + x;
                    if (binary[idx] === 1) {
                        const p2 = getP(binary, x, y - 1), p3 = getP(binary, x + 1, y - 1), p4 = getP(binary, x + 1, y), p5 = getP(binary, x + 1, y + 1);
                        const p6 = getP(binary, x, y + 1), p7 = getP(binary, x - 1, y + 1), p8 = getP(binary, x - 1, y), p9 = getP(binary, x - 1, y - 1);
                        const A = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) + (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) +
                            (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) + (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);
                        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                        if (B >= 2 && B <= 6 && A === 1 && (p2 * p4 * p6 === 0) && (p4 * p6 * p8 === 0)) {
                            marker[idx] = 1;
                            hasChanged = true;
                        }
                    }
                }
            }
            for (let i = 0; i < binary.length; i++)
                if (marker[i])
                    binary[i] = 0;
            marker.fill(0);
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = y * width + x;
                    if (binary[idx] === 1) {
                        const p2 = getP(binary, x, y - 1), p3 = getP(binary, x + 1, y - 1), p4 = getP(binary, x + 1, y), p5 = getP(binary, x + 1, y + 1);
                        const p6 = getP(binary, x, y + 1), p7 = getP(binary, x - 1, y + 1), p8 = getP(binary, x - 1, y), p9 = getP(binary, x - 1, y - 1);
                        const A = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) + (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) +
                            (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) + (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);
                        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                        if (B >= 2 && B <= 6 && A === 1 && (p2 * p4 * p8 === 0) && (p2 * p6 * p8 === 0)) {
                            marker[idx] = 1;
                            hasChanged = true;
                        }
                    }
                }
            }
            for (let i = 0; i < binary.length; i++)
                if (marker[i])
                    binary[i] = 0;
        }
        this.init();
        paper.project.clear();
        const paths = await this.traceBinary(binary, width, height, cornerThreshold);
        const group = new paper.Group();
        paths.forEach(p => {
            p.strokeColor = new paper.Color('#000000');
            p.fillColor = null;
            p.closed = false; // Centerlines should ideally be open paths
            group.addChild(p);
        });
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${group.exportSVG({ asString: true })}</svg>`;
    }
    // Feature 53: Multi-Color Posterized Tracing
    static async tracePosterized(imageData, colors = 4, cornerThreshold = 1.5) {
        const { width, height, data } = imageData;
        const centers = [];
        for (let i = 0; i < colors; i++) {
            const idx = Math.floor(Math.random() * (width * height)) * 4;
            centers.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
        const assignments = new Uint8Array(width * height);
        for (let iter = 0; iter < 5; iter++) {
            const sums = Array(colors).fill(0).map(() => [0, 0, 0, 0]);
            for (let i = 0; i < width * height; i++) {
                const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
                let bestDist = Infinity, bestC = 0;
                for (let c = 0; c < colors; c++) {
                    const dr = r - centers[c][0], dg = g - centers[c][1], db = b - centers[c][2];
                    const d = dr * dr + dg * dg + db * db;
                    if (d < bestDist) {
                        bestDist = d;
                        bestC = c;
                    }
                }
                assignments[i] = bestC;
                sums[bestC][0] += r;
                sums[bestC][1] += g;
                sums[bestC][2] += b;
                sums[bestC][3]++;
            }
            for (let c = 0; c < colors; c++) {
                if (sums[c][3] > 0) {
                    centers[c][0] = sums[c][0] / sums[c][3];
                    centers[c][1] = sums[c][1] / sums[c][3];
                    centers[c][2] = sums[c][2] / sums[c][3];
                }
            }
        }
        this.init();
        paper.project.clear();
        const group = new paper.Group();
        for (let c = 0; c < colors; c++) {
            const binary = new Uint8Array(width * height);
            for (let i = 0; i < assignments.length; i++) {
                if (assignments[i] === c)
                    binary[i] = 1;
            }
            const paths = await this.traceBinary(binary, width, height, cornerThreshold);
            const hex = `#${Math.round(centers[c][0]).toString(16).padStart(2, '0')}${Math.round(centers[c][1]).toString(16).padStart(2, '0')}${Math.round(centers[c][2]).toString(16).padStart(2, '0')}`;
            paths.forEach(p => {
                p.fillColor = new paper.Color(hex);
                p.strokeColor = null;
                group.addChild(p);
            });
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${group.exportSVG({ asString: true })}</svg>`;
    }
    // Feature 64: Color Isolation Tracing
    static async traceColorIsolation(imageData, targetColorHex, tolerance = 30, cornerThreshold = 1.5) {
        this.init();
        paper.project.clear();
        const { width, height, data } = imageData;
        const binary = new Uint8Array(width * height);
        let tR = 0, tG = 0, tB = 0;
        const hex = targetColorHex.replace('#', '');
        if (hex.length === 6) {
            tR = parseInt(hex.substring(0, 2), 16);
            tG = parseInt(hex.substring(2, 4), 16);
            tB = parseInt(hex.substring(4, 6), 16);
        }
        else if (hex.length === 3) {
            tR = parseInt(hex[0] + hex[0], 16);
            tG = parseInt(hex[1] + hex[1], 16);
            tB = parseInt(hex[2] + hex[2], 16);
        }
        const tolSq = tolerance * tolerance;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a > 128) {
                const dSq = (r - tR) ** 2 + (g - tG) ** 2 + (b - tB) ** 2;
                if (dSq <= tolSq) {
                    binary[i / 4] = 1;
                }
            }
        }
        const paths = await this.traceBinary(binary, width, height, cornerThreshold);
        const group = new paper.Group();
        paths.forEach(p => {
            p.fillColor = new paper.Color(targetColorHex);
            p.strokeColor = null;
            group.addChild(p);
        });
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${group.exportSVG({ asString: true })}</svg>`;
    }
    // Feature 69: Raster Halftoning Engraver
    static async traceHalftone(imageData, dotSpacing = 10, angle = 45) {
        const { width, height, data } = imageData;
        const radAngle = (angle * Math.PI) / 180;
        const cosA = Math.cos(radAngle);
        const sinA = Math.sin(radAngle);
        const cx = width / 2;
        const cy = height / 2;
        const diag = Math.sqrt(width * width + height * height);
        const startX = -diag / 2;
        const endX = diag / 2;
        const startY = -diag / 2;
        const endY = diag / 2;
        let svgContent = '';
        const maxRadius = (dotSpacing / 2) * 1.414;
        for (let y = startY; y < endY; y += dotSpacing) {
            for (let x = startX; x < endX; x += dotSpacing) {
                const imgX = cx + x * cosA - y * sinA;
                const imgY = cy + x * sinA + y * cosA;
                if (imgX >= 0 && imgX < width && imgY >= 0 && imgY < height) {
                    const pxX = Math.floor(imgX);
                    const pxY = Math.floor(imgY);
                    const idx = (pxY * width + pxX) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    const a = data[idx + 3];
                    if (a < 128)
                        continue;
                    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    const darkIntensity = 1 - (lum / 255);
                    const radius = maxRadius * darkIntensity;
                    if (radius > 0.5) {
                        svgContent += `<circle cx="${imgX.toFixed(2)}" cy="${imgY.toFixed(2)}" r="${radius.toFixed(2)}" fill="#000" />`;
                    }
                }
            }
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><g>${svgContent}</g></svg>`;
    }
}
//# sourceMappingURL=tracing.js.map