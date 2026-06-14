export class ToolbarManager {
    constructor() {
        this.editor = null;
        this.updateToolOptionsUI = null;
        this.clickHandler = this.handleDocumentClick.bind(this);
    }
    init(editor, updateToolOptionsUI) {
        this.editor = editor;
        this.updateToolOptionsUI = updateToolOptionsUI;
        // Add event listener to the document for delegation
        document.addEventListener('click', this.clickHandler);
    }
    destroy() {
        this.editor = null;
        this.updateToolOptionsUI = null;
        document.removeEventListener('click', this.clickHandler);
    }
    showToast(message, isError = false) {
        // If the main.ts showToast is exposed we could use it, but for now we dispatch a custom event
        window.dispatchEvent(new CustomEvent('vectronomy:toast', { detail: { message, isError } }));
    }
    handleDocumentClick(e) {
        const target = e.target;
        // Handle Tool Buttons
        const btn = target.closest('.tool-btn[id^="tool-"]');
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
            const tool = btn.id.replace('tool-', '');
            if (this.editor && this.updateToolOptionsUI) {
                try {
                    this.editor.setTool(tool);
                    this.updateToolOptionsUI(tool);
                }
                catch (err) {
                    this.showToast('Failed to set tool: ' + err.message, true);
                }
            }
            return;
        }
        // Handle Shape Menu Items
        const shapeItem = target.closest('.shape-menu-item');
        if (shapeItem) {
            e.stopPropagation();
            const popover = shapeItem.closest('.shapes-popover-menu');
            let targetToggle = null;
            if (popover) {
                if (popover.id === 'curves-popover') {
                    targetToggle = document.getElementById('tool-curves-toggle');
                }
                else if (popover.id === 'shapes-popover') {
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
                const itemSvg = shapeItem.querySelector('svg').cloneNode(true);
                targetToggle.innerHTML = '';
                targetToggle.appendChild(itemSvg);
            }
            const tool = shapeItem.getAttribute('data-tool');
            if (this.editor && this.updateToolOptionsUI) {
                try {
                    this.editor.setTool(tool);
                    this.updateToolOptionsUI(tool);
                }
                catch (err) {
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
//# sourceMappingURL=ToolbarManager.js.map