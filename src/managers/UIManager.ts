const THEME_ICONS = {
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  light: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  dark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`
};

export class UIManager {
  private themeState: 'system' | 'light' | 'dark' = 'system';

  constructor() {
    this.initTheme();
    this.initSidebar();
    this.initModals();
    this.initHotkeys();
  }

  private initTheme() {
    const saved = localStorage.getItem('vectronomy-theme');
    if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
      this.themeState = saved;
    }

    this.applyTheme();

    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (this.themeState === 'system') this.themeState = 'light';
        else if (this.themeState === 'light') this.themeState = 'dark';
        else this.themeState = 'system';
        
        localStorage.setItem('vectronomy-theme', this.themeState);
        this.applyTheme();
      });
    }
  }

  private applyTheme() {
    const root = document.documentElement;
    let actualTheme = this.themeState;
    
    if (this.themeState === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      actualTheme = isDark ? 'dark' : 'light';
    }

    if (actualTheme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme'); // default is dark
    }

    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      toggleBtn.innerHTML = THEME_ICONS[this.themeState];
      toggleBtn.title = `Theme: ${this.themeState.charAt(0).toUpperCase() + this.themeState.slice(1)}`;
    }
  }

  private initSidebar() {
    const btnHam = document.getElementById('btn-hamburger');
    const btnClose = document.getElementById('btn-sidebar-close');
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    const toggle = (show: boolean) => {
      if (show) {
        sidebar?.classList.add('visible');
        sidebar?.removeAttribute('hidden');
        overlay?.removeAttribute('hidden');
      } else {
        sidebar?.classList.remove('visible');
        overlay?.setAttribute('hidden', '');
        setTimeout(() => sidebar?.setAttribute('hidden', ''), 300);
      }
    };

    btnHam?.addEventListener('click', () => toggle(true));
    btnClose?.addEventListener('click', () => toggle(false));
    overlay?.addEventListener('click', () => toggle(false));
  }

  private initModals() {
    const btnSettings = document.getElementById('btn-sidebar-settings');
    const btnHotkeys = document.getElementById('btn-sidebar-hotkeys');
    const btnProjects = document.getElementById('btn-sidebar-projects');
    const btnHeaderHotkeys = document.getElementById('btn-hotkeys');
    
    btnSettings?.addEventListener('click', () => {
      document.getElementById('btn-sidebar-close')?.click();
      this.showModal('modal-settings');
    });

    const openShortcutsHelp = () => {
      document.getElementById('btn-sidebar-close')?.click();
      const helpBtn = document.getElementById('btn-help');
      if (helpBtn) helpBtn.click();
      
      // Delay slightly to let the help modal render before clicking the tab
      setTimeout(() => {
        const shortcutsTab = document.querySelector('.help-nav-item[data-target="help-shortcuts"]') as HTMLButtonElement;
        if (shortcutsTab) shortcutsTab.click();
      }, 50);
    };

    btnHotkeys?.addEventListener('click', openShortcutsHelp);
    btnHeaderHotkeys?.addEventListener('click', openShortcutsHelp);

    btnProjects?.addEventListener('click', () => {
      document.getElementById('btn-sidebar-close')?.click();
      this.showModal('modal-projects');
    });

    document.getElementById('btn-settings-close')?.addEventListener('click', () => {
      this.hideModal('modal-settings');
    });
    document.getElementById('btn-projects-close')?.addEventListener('click', () => {
      this.hideModal('modal-projects');
    });
  }

  private showModal(id: string) {
    const modal = document.getElementById(id);
    const overlay = document.getElementById('sidebar-overlay');
    if (modal && overlay) {
      modal.removeAttribute('hidden');
      overlay.removeAttribute('hidden');
      overlay.onclick = () => this.hideModal(id);
    }
  }

  private hideModal(id: string) {
    const modal = document.getElementById(id);
    const overlay = document.getElementById('sidebar-overlay');
    if (modal && overlay) {
      modal.setAttribute('hidden', '');
      overlay.setAttribute('hidden', '');
      overlay.onclick = null;
    }
  }

  private initHotkeys() {
    window.addEventListener('keydown', (e) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && e.target === document.body) {
        const helpBtn = document.getElementById('btn-help');
        if (helpBtn) helpBtn.click();
        
        setTimeout(() => {
          const shortcutsTab = document.querySelector('.help-nav-item[data-target="help-shortcuts"]') as HTMLButtonElement;
          if (shortcutsTab) shortcutsTab.click();
        }, 50);
      }
    });
  }
}
