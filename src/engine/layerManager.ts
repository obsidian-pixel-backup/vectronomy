import { VectorEditor } from './editor';

export class LayerManager {
  private editor: VectorEditor;
  private container: HTMLElement;
  private treeContainer: HTMLElement;
  
  private groupColors = [
    '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', 
    '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55',
    '#00FFC2', '#FF00FF', '#FFFF00', '#00FFFF'
  ];

  constructor(editor: VectorEditor) {
    this.editor = editor;
    this.container = document.getElementById('props-layers') as HTMLElement;
    this.treeContainer = document.getElementById('layer-tree-container') as HTMLElement;

    if (!this.container || !this.treeContainer) return;

    // We override notifyChange from outside, or we listen to an event. 
    // We'll hook into editor.onSelectionChange / update if possible.
    // For now, we will add an explicit updateTree() method to be called from main.ts.

    this.initButtons();
  }

  private initButtons() {
    const btnGroup = document.getElementById('btn-group');
    const btnUngroup = document.getElementById('btn-ungroup');

    if (btnGroup) {
      btnGroup.addEventListener('click', () => {
        this.groupSelected();
      });
    }

    if (btnUngroup) {
      btnUngroup.addEventListener('click', () => {
        this.ungroupSelected();
      });
    }
  }

  public updateTree() {
    if (!this.treeContainer) return;
    this.treeContainer.innerHTML = '';
    
    const svgEl = this.editor.getContainer().querySelector('svg');
    if (!svgEl) return;
    const viewport = svgEl.querySelector('#viewport') || svgEl;

    const buildNode = (el: Element, parentEl: HTMLElement) => {
      // Skip internal ui elements
      if (el.classList && (el.classList.contains('selection-overlay') || el.classList.contains('canvas-ui'))) return;
      if (el.tagName.toLowerCase() === 'defs' || el.tagName.toLowerCase() === 'style') return;
      
      const isGroup = el.tagName.toLowerCase() === 'g';
      let id = el.getAttribute('data-xcs-id');
      if (!id) {
        id = `el-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        el.setAttribute('data-xcs-id', id);
      }

      const itemDiv = document.createElement('div');
      itemDiv.className = 'layer-node';
      
      const rowDiv = document.createElement('div');
      rowDiv.className = 'layer-item';
      rowDiv.setAttribute('data-id', id);
      if (this.editor.selectedIds.has(id) || this.editor.selectedId === id) {
        rowDiv.classList.add('selected');
      }

      // Feature 82: Lock Toggle
      const isLocked = el.getAttribute('data-locked') === 'true';
      if (isLocked) {
        rowDiv.setAttribute('data-locked', 'true');
        (el as SVGElement).style.pointerEvents = 'none';
      } else {
        (el as SVGElement).style.pointerEvents = '';
      }

      // Expander for groups
      const expander = document.createElement('div');
      expander.className = 'layer-expander';
      if (isGroup && el.children.length > 0) {
        expander.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"/></svg>`;
        expander.addEventListener('click', (e) => {
          e.stopPropagation();
          expander.classList.toggle('collapsed');
          const childrenDiv = itemDiv.querySelector('.layer-children') as HTMLElement;
          if (childrenDiv) childrenDiv.classList.toggle('collapsed');
        });
      } else {
        expander.style.visibility = 'hidden';
      }
      rowDiv.appendChild(expander);

      // Icon
      const icon = document.createElement('div');
      icon.className = 'layer-icon';
      icon.innerHTML = this.getIconForTag(el.tagName);
      rowDiv.appendChild(icon);

      // Group Color Tag (Feature 83)
      if (isGroup) {
        let gColor = el.getAttribute('data-group-color');
        if (!gColor) {
          gColor = this.groupColors[Math.floor(Math.random() * this.groupColors.length)];
          el.setAttribute('data-group-color', gColor);
        }
        const colorTag = document.createElement('div');
        colorTag.className = 'layer-color-tag';
        colorTag.style.backgroundColor = gColor;
        rowDiv.appendChild(colorTag);
      }

      const label = document.createElement('div');
      label.className = 'layer-item-content';
      const customName = el.getAttribute('data-layer-name');
      if (customName) {
        label.textContent = customName;
      } else {
        let name = el.tagName.toLowerCase();
        if (name === 'g') name = 'Group';
        else if (name === 'path') name = 'Path';
        else if (name === 'rect') name = 'Rectangle';
        else if (name === 'circle') name = 'Circle';
        else if (name === 'ellipse') name = 'Ellipse';
        else if (name === 'polygon') name = 'Polygon';
        else if (name === 'line') name = 'Line';
        else if (name === 'polyline') name = 'Polyline';
        else if (name === 'text') name = 'Text';
        else if (name === 'image') name = 'Image';
        label.textContent = name;
        if (el.id && el.id !== 'viewport') label.textContent += ` #${el.id}`;
      }
      
      label.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const currentName = customName || label.textContent || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'layer-rename-input';
        input.value = currentName;
        input.style.width = '100%';
        input.style.background = 'rgba(0,0,0,0.2)';
        input.style.border = '1px solid #4a90e2';
        input.style.color = 'inherit';
        input.style.outline = 'none';
        input.style.padding = '2px';
        input.style.borderRadius = '2px';
        
        label.textContent = '';
        label.appendChild(input);
        input.focus();
        input.select();

        let finished = false;
        const finishRename = () => {
          if (finished) return;
          finished = true;
          const newName = input.value.trim();
          if (newName) {
            el.setAttribute('data-layer-name', newName);
          } else {
            el.removeAttribute('data-layer-name');
          }
          this.editor.commit();
          this.updateTree();
        };

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            ke.preventDefault();
            finishRename();
          }
          if (ke.key === 'Escape') {
            ke.preventDefault();
            finished = true;
            this.updateTree();
          }
        });
      });

      rowDiv.appendChild(label);

      // Lock icon
      const lock = document.createElement('div');
      lock.className = 'layer-lock';
      lock.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
      lock.addEventListener('click', (e) => {
        e.stopPropagation();
        const locked = el.getAttribute('data-locked') === 'true';
        if (locked) {
          el.removeAttribute('data-locked');
          (el as SVGElement).style.pointerEvents = '';
        } else {
          el.setAttribute('data-locked', 'true');
          (el as SVGElement).style.pointerEvents = 'none';
        }
        this.editor.commit();
        this.updateTree();
      });
      rowDiv.appendChild(lock);

      rowDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isLocked) return; // Prevent selecting locked layers? Or just allow selecting in tree but not canvas?
        // Let's allow selecting in tree, so we can unlock it.
        
        if (e.shiftKey) {
          this.editor.selectedIds.add(id!);
          this.editor.selectedId = id!;
        } else {
          this.editor.selectedIds.clear();
          this.editor.selectedIds.add(id!);
          this.editor.selectedId = id!;
        }
        this.editor.renderSelectionUI();
        this.updateTree();
      });

      itemDiv.appendChild(rowDiv);
      // Feature 87: Group Isolation Mode
      if (isGroup) {
        itemDiv.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.editor.enterIsolation(id!);
        });
      }


      if (isGroup && el.children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'layer-children';
        // Build children in reverse order so top element in tree is top in Z-index
        for (let i = el.children.length - 1; i >= 0; i--) {
          buildNode(el.children[i], childrenContainer);
        }
        itemDiv.appendChild(childrenContainer);
      }

      parentEl.appendChild(itemDiv);
    };

    // Build the top level (viewport children)
    for (let i = viewport.children.length - 1; i >= 0; i--) {
      buildNode(viewport.children[i], this.treeContainer);
    }
  }

  private getIconForTag(tag: string): string {
    const t = tag.toLowerCase();
    if (t === 'g') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
    } else if (t === 'path') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 22h20L12 2z"/></svg>`;
    } else if (t === 'rect') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`;
    } else if (t === 'circle' || t === 'ellipse') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
    } else if (t === 'text') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
    } else if (t === 'image') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 22h20L12 2z"/></svg>`;
  }

  // Feature 84: Group selected elements
  public groupSelected() {
    const els = this.editor.getSelectedEls();
    if (els.length < 1) return;

    // Find common parent or use viewport
    const parent = els[0].parentElement;
    if (!parent) return;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const groupId = `el-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    group.setAttribute('data-xcs-id', groupId);
    group.setAttribute('data-layer-name', 'Group');
    
    // Assign random group color immediately
    const gColor = this.groupColors[Math.floor(Math.random() * this.groupColors.length)];
    group.setAttribute('data-group-color', gColor);

    // Insert group where the first element was
    parent.insertBefore(group, els[0]);

    // Move all selected elements into the group
    els.forEach(el => {
      group.appendChild(el);
    });

    this.editor.selectedIds.clear();
    this.editor.selectedIds.add(groupId);
    this.editor.selectedId = groupId;

    this.editor.commit();
    this.editor.renderSelectionUI();
    this.updateTree();
  }

  // Feature 84: Ungroup selected groups
  public ungroupSelected() {
    const els = this.editor.getSelectedEls();
    let changed = false;

    els.forEach(el => {
      if (el.tagName.toLowerCase() === 'g') {
        const parent = el.parentElement;
        if (parent) {
          // Move children to parent before the group
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          parent.removeChild(el);
          this.editor.selectedIds.delete(el.getAttribute('data-xcs-id')!);
          changed = true;
        }
      }
    });

    if (changed) {
      // Note: we might want to select the newly extracted children, but clearing is easier
      if (this.editor.selectedIds.size === 0) {
        this.editor.selectedId = null;
      }
      this.editor.commit();
      this.editor.renderSelectionUI();
      this.updateTree();
    }
  }
}
