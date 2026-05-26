import { VectorEditor } from '../engine/editor';

export class ToolbarManager {
  private editor: VectorEditor | null = null;
  private updateToolOptionsUI: ((tool: string) => void) | null = null;
  private clickHandler: (e: MouseEvent) => void;

  constructor() {
    this.clickHandler = this.handleDocumentClick.bind(this);
  }

  public init(editor: VectorEditor, updateToolOptionsUI: (tool: string) => void) {
    this.editor = editor;
    this.updateToolOptionsUI = updateToolOptionsUI;
    
    // Add event listener to the document for delegation
    document.addEventListener('click', this.clickHandler);
  }

  public destroy() {
    this.editor = null;
    this.updateToolOptionsUI = null;
    document.removeEventListener('click', this.clickHandler);
  }

  private showToast(message: string, isError = false) {
    // If the main.ts showToast is exposed we could use it, but for now we dispatch a custom event
    window.dispatchEvent(new CustomEvent('vectronomy:toast', { detail: { message, isError } }));
  }

  private handleDocumentClick(e: MouseEvent) {
    const target = e.target as Element;
    
    // Handle Tool Buttons
    const btn = target.closest('.tool-btn[id^="tool-"]') as HTMLButtonElement | null;
    if (btn) {
      if (btn.id === 'tool-curves-toggle') {
        e.stopPropagation();
        const curvesPopover = document.getElementById('curves-popover');
        const shapesPopover = document.getElementById('shapes-popover');
        shapesPopover?.classList.remove('show');
        curvesPopover?.classList.toggle('show');
        return;
      }
      if (btn.id === 'tool-shapes-toggle') {
        e.stopPropagation();
        const curvesPopover = document.getElementById('curves-popover');
        const shapesPopover = document.getElementById('shapes-popover');
        curvesPopover?.classList.remove('show');
        shapesPopover?.classList.toggle('show');
        return;
      }
      
      document.querySelectorAll('.tool-btn[id^="tool-"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.id.replace('tool-', '') as any;
      if (this.editor && this.updateToolOptionsUI) {
        try {
          this.editor.setTool(tool);
          this.updateToolOptionsUI(tool);
        } catch (err: any) {
          this.showToast('Failed to set tool: ' + err.message, true);
        }
      }
      return;
    }

    // Handle Shape Menu Items
    const shapeItem = target.closest('.shape-menu-item') as HTMLButtonElement | null;
    if (shapeItem) {
      e.stopPropagation();
      const popover = shapeItem.closest('.shapes-popover-menu');
      let targetToggle: HTMLElement | null = null;
      if (popover) {
        if (popover.id === 'curves-popover') {
          targetToggle = document.getElementById('tool-curves-toggle');
        } else if (popover.id === 'shapes-popover') {
          targetToggle = document.getElementById('tool-shapes-toggle');
        }
      }
      
      document.querySelectorAll('.shape-menu-item').forEach(i => {
        if (i.closest('.shapes-popover-menu') === popover) {
          i.classList.remove('active');
        }
      });
      shapeItem.classList.add('active');

      document.querySelectorAll('.tool-btn[id^="tool-"]').forEach(b => b.classList.remove('active'));
      if (targetToggle) {
        targetToggle.classList.add('active');
        const itemSvg = shapeItem.querySelector('svg')!.cloneNode(true);
        targetToggle.innerHTML = '';
        targetToggle.appendChild(itemSvg);
      }

      const tool = shapeItem.getAttribute('data-tool')!;
      if (this.editor && this.updateToolOptionsUI) {
        try {
          this.editor.setTool(tool as any);
          this.updateToolOptionsUI(tool);
        } catch (err: any) {
          this.showToast('Failed to set tool: ' + err.message, true);
        }
      }
      
      popover?.classList.remove('show');
      return;
    }

    // Hide dropdowns when clicking anywhere else
    document.getElementById('curves-popover')?.classList.remove('show');
    document.getElementById('shapes-popover')?.classList.remove('show');
  }
}
