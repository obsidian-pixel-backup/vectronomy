/**
 * VECTRONOMY — Raster Engine
 * 
 * Handles pixel manipulation, brushes, eraser, and image adjustments
 * (brightness, contrast, blur) directly on raster `<image>` SVG elements.
 */

export class RasterEngine {
  private offscreenCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentImageEl: SVGImageElement | null = null;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.ctx = this.offscreenCanvas.getContext('2d')!;
  }

  /** Load an SVGImageElement into the raster engine for editing */
  public async editImage(imgEl: SVGImageElement) {
    this.currentImageEl = imgEl;
    const href = imgEl.getAttribute('href');
    if (!href) return;

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.offscreenCanvas.width = img.width;
        this.offscreenCanvas.height = img.height;
        this.ctx.clearRect(0, 0, img.width, img.height);
        this.ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.src = href;
    });
  }

  /** Apply Photoshop-style filters */
  public applyFilters(brightness: number, contrast: number, blur: number) {
    if (!this.currentImageEl) return;
    
    // We can use CSS filters on the canvas context to easily apply these
    const filterParts = [];
    if (brightness !== 0) filterParts.push(`brightness(${100 + brightness}%)`);
    if (contrast !== 0) filterParts.push(`contrast(${100 + contrast}%)`);
    if (blur > 0) filterParts.push(`blur(${blur}px)`);
    
    const filterString = filterParts.length > 0 ? filterParts.join(' ') : 'none';
    
    // To apply the filter permanently to the pixels, we must redraw the image
    // on a temporary canvas with the filter applied.
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.offscreenCanvas.width;
    tempCanvas.height = this.offscreenCanvas.height;
    const tCtx = tempCanvas.getContext('2d')!;
    
    tCtx.filter = filterString;
    tCtx.drawImage(this.offscreenCanvas, 0, 0);
    
    // Copy back
    this.ctx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    this.ctx.drawImage(tempCanvas, 0, 0);
    
    this.commitToSvg();
  }

  /** Start a brush or eraser stroke */
  public startStroke(x: number, y: number) {
    if (!this.currentImageEl) return;
    this.isDrawing = true;
    
    const localPt = this.globalToLocal(x, y);
    this.lastX = localPt.x;
    this.lastY = localPt.y;
  }

  /** Continue a brush or eraser stroke */
  public continueStroke(x: number, y: number, mode: 'brush' | 'eraser', color: string, size: number) {
    if (!this.isDrawing || !this.currentImageEl) return;
    
    const localPt = this.globalToLocal(x, y);
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(localPt.x, localPt.y);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = size;
    
    if (mode === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = color;
    }
    
    this.ctx.stroke();
    
    // Reset blend mode
    this.ctx.globalCompositeOperation = 'source-over';
    
    this.lastX = localPt.x;
    this.lastY = localPt.y;
    
    // Commit live for preview (might be slow for large images, but works for MVP)
    this.commitToSvg();
  }

  /** End a brush or eraser stroke */
  public endStroke() {
    this.isDrawing = false;
  }

  /** Converts SVG coordinate to image-local pixel coordinate */
  private globalToLocal(svgX: number, svgY: number): { x: number, y: number } {
    if (!this.currentImageEl) return { x: 0, y: 0 };
    
    const imgX = parseFloat(this.currentImageEl.getAttribute('x') || '0');
    const imgY = parseFloat(this.currentImageEl.getAttribute('y') || '0');
    const imgW = parseFloat(this.currentImageEl.getAttribute('width') || '100');
    const imgH = parseFloat(this.currentImageEl.getAttribute('height') || '100');
    
    const scaleX = this.offscreenCanvas.width / imgW;
    const scaleY = this.offscreenCanvas.height / imgH;
    
    return {
      x: (svgX - imgX) * scaleX,
      y: (svgY - imgY) * scaleY
    };
  }

  /** Updates the SVG <image> tag with the new canvas data */
  private commitToSvg() {
    if (!this.currentImageEl) return;
    const dataUrl = this.offscreenCanvas.toDataURL('image/png');
    this.currentImageEl.setAttribute('href', dataUrl);
  }
}
