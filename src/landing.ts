import './landing.css';
import roadmapMd from '../VECTRONOMY_ROADMAP_AND_DOCUMENTATION.md?raw';
import { parseRoadmap, Division, Phase, Feature } from './roadmapParser';
import { FEATURE_DOCS, COMPLETED_FEATURES, IN_PROGRESS_FEATURES } from './featureDocs';

// ── Helpers ──────────────────────────────────────────────────────────
function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href');
      if (href) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth'
          });
        }
      }
    });
  });

  // Simple intersection observer for fade-in animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.feature-card, .price-card, .hero-content, .roadmap-section').forEach(el => {
    observer.observe(el);
  });

  // ── Roadmap Engine ───────────────────────────────────────────────

  const { divisions, phases } = parseRoadmap(roadmapMd);

  const tabDivisions     = document.getElementById('tab-roadmap-divisions') as HTMLButtonElement;
  const tabPhases        = document.getElementById('tab-roadmap-phases') as HTMLButtonElement;
  const viewDivisions    = document.getElementById('view-roadmap-divisions') as HTMLElement;
  const viewPhases       = document.getElementById('view-roadmap-phases') as HTMLElement;
  const sidebarDivisions = document.getElementById('roadmap-divisions-sidebar') as HTMLElement;
  const displayFeatures  = document.getElementById('roadmap-features-display') as HTMLElement;
  const timelinePhases   = document.getElementById('roadmap-phases-timeline') as HTMLElement;
  const searchRoadmap    = document.getElementById('roadmap-search') as HTMLInputElement;
  const roadmapStats     = document.getElementById('roadmap-stats') as HTMLElement;
  const featureModal     = document.getElementById('roadmap-feature-modal') as HTMLElement;
  const modalCloseBtn    = document.getElementById('modal-close-btn') as HTMLElement;
  const modalOverlay     = featureModal.querySelector('.roadmap-modal-overlay') as HTMLElement;
  const modalFeatNum     = document.getElementById('modal-feature-num') as HTMLElement;
  const modalFeatTitle   = document.getElementById('modal-feature-title') as HTMLElement;
  const modalFeatStatus  = document.getElementById('modal-feature-status') as HTMLElement;
  const modalFeatDiv     = document.getElementById('modal-feature-div') as HTMLElement;
  const modalFeatReadme  = document.getElementById('modal-feature-readme') as HTMLElement;
  const modalFeatUsage   = document.getElementById('modal-feature-usage') as HTMLElement;
  const modalFeatTech    = document.getElementById('modal-feature-tech') as HTMLElement;
  const modalFeatValue   = document.getElementById('modal-feature-value') as HTMLElement;

  let activeDivisionId = 1;
  let currentSearchQuery = '';
  let activeFilter: 'all' | 'complete' | 'in-progress' | 'planned' = 'all';

  // Guard against missing elements (e.g. if page isn't the landing)
  if (!tabDivisions || !sidebarDivisions || !displayFeatures) return;

  // ── Modal ────────────────────────────────────────────────────────

  modalCloseBtn?.addEventListener('click', () => {
    featureModal.style.display = 'none';
  });
  modalOverlay?.addEventListener('click', () => {
    featureModal.style.display = 'none';
  });

  // Copy Technical Specification
  const btnCopySpec = document.getElementById('btn-copy-spec') as HTMLButtonElement;
  btnCopySpec?.addEventListener('click', async () => {
    const code = modalFeatTech.textContent || '';
    try {
      await navigator.clipboard.writeText(code);
      btnCopySpec.textContent = 'Copied!';
      btnCopySpec.style.borderColor = '#00ff88';
      btnCopySpec.style.color = '#00ff88';
      setTimeout(() => {
        btnCopySpec.textContent = 'Copy Spec';
        btnCopySpec.style.borderColor = '';
        btnCopySpec.style.color = '';
      }, 1500);
    } catch {
      // Fallback silently
    }
  });

  function openFeatureModal(feat: Feature, div: Division) {
    let statusText = 'PLANNED';
    let statusClass = 'planned';
    if (COMPLETED_FEATURES.has(feat.id)) {
      statusText = 'SHIPPED';
      statusClass = 'complete';
    } else if (IN_PROGRESS_FEATURES.has(feat.id)) {
      statusText = 'IN DEV';
      statusClass = 'in-progress';
    }

    modalFeatNum.textContent = `#${feat.id}`;
    modalFeatTitle.textContent = feat.title;
    modalFeatStatus.textContent = statusText;
    modalFeatStatus.className = `status-badge ${statusClass}`;
    modalFeatDiv.textContent = `Division ${div.id}: ${div.title}`;

    if (FEATURE_DOCS[feat.id]) {
      modalFeatReadme.textContent = FEATURE_DOCS[feat.id].readme;
      modalFeatUsage.textContent = FEATURE_DOCS[feat.id].usage;
      modalFeatTech.textContent = FEATURE_DOCS[feat.id].tech;
    } else {
      if (COMPLETED_FEATURES.has(feat.id)) {
        modalFeatReadme.textContent = `Documentation for ${feat.title} is currently being finalized.`;
        modalFeatUsage.textContent = `The core functionality for ${feat.title} is fully deployed and active in the engine.`;
      } else {
        modalFeatReadme.textContent = "This feature is currently in the active planning phase. We are designing native integrations to satisfy this target soon!";
        modalFeatUsage.textContent = "Usage guidelines will be made available as soon as this feature moves into the active deployment phase.";
      }
      modalFeatTech.textContent = `Technical Specifications:\n${feat.technicalIntegration}`;
    }

    modalFeatValue.textContent = feat.marketValue;
    featureModal.style.display = 'flex';
  }

  // ── Tabs ──────────────────────────────────────────────────────────

  tabDivisions.addEventListener('click', () => switchRoadmapTab('divisions'));
  tabPhases.addEventListener('click', () => switchRoadmapTab('phases'));

  function switchRoadmapTab(tabName: 'divisions' | 'phases') {
    if (tabName === 'divisions') {
      tabDivisions.classList.add('active');
      tabPhases.classList.remove('active');
      viewDivisions.style.display = 'flex';
      viewPhases.style.display = 'none';
    } else {
      tabDivisions.classList.remove('active');
      tabPhases.classList.add('active');
      viewDivisions.style.display = 'none';
      viewPhases.style.display = 'flex';
      renderPhasesTimeline();
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────

  function updateRoadmapStats() {
    if (!roadmapStats) return;
    const total = 140;
    const completed = COMPLETED_FEATURES.size;
    const pct = ((completed / total) * 100).toFixed(1);
    roadmapStats.innerHTML = `
      <div class="roadmap-stat-box">
        <span class="roadmap-stat-label">Total Shipped</span>
        <span class="roadmap-stat-value">${completed} / ${total}</span>
      </div>
      <div class="roadmap-stat-box">
        <span class="roadmap-stat-label">Completion</span>
        <span class="roadmap-stat-value">${pct}%</span>
      </div>
      <div class="roadmap-progress-bar-wrap">
        <div class="roadmap-progress-bar-fill" style="width: ${pct}%;"></div>
      </div>
    `;
  }

  // ── Divisions Sidebar ─────────────────────────────────────────────

  function renderDivisionsSidebar() {
    sidebarDivisions.innerHTML = '';
    divisions.forEach(div => {
      const btn = document.createElement('button');
      btn.className = `division-sidebar-btn${div.id === activeDivisionId ? ' active' : ''}`;
      btn.innerHTML = `
        <span class="sidebar-div-icon">${div.icon}</span>
        <div class="sidebar-div-info">
          <span class="sidebar-div-num">DIVISION ${div.id}</span>
          <span class="sidebar-div-name">${div.title}</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        activeDivisionId = div.id;
        searchRoadmap.value = '';
        currentSearchQuery = '';
        renderDivisionsSidebar();
        renderFeaturesList();
      });
      sidebarDivisions.appendChild(btn);
    });
  }

  // ── Features List ─────────────────────────────────────────────────

  function renderFeaturesList() {
    displayFeatures.innerHTML = '';

    let sourceFeatures: { feature: Feature, division: Division }[] = [];

    if (currentSearchQuery) {
      const q = currentSearchQuery.toLowerCase();
      divisions.forEach(div => {
        div.features.forEach(feat => {
          const isNumSearch = q.startsWith('#');
          const numToMatch = isNumSearch ? parseInt(q.slice(1)) : -1;

          if (isNumSearch) {
            if (feat.id === numToMatch) {
              sourceFeatures.push({ feature: feat, division: div });
            }
          } else if (
            feat.title.toLowerCase().includes(q) ||
            feat.technicalIntegration.toLowerCase().includes(q) ||
            feat.marketValue.toLowerCase().includes(q) ||
            feat.id.toString() === q
          ) {
            sourceFeatures.push({ feature: feat, division: div });
          }
        });
      });

      const titleCard = document.createElement('div');
      titleCard.className = 'division-intro-card';
      titleCard.innerHTML = `
        <h3>SEARCH RESULTS</h3>
        <p>Found <b>${sourceFeatures.length}</b> features matching "${esc(currentSearchQuery)}" across all CAD divisions.</p>
      `;
      displayFeatures.appendChild(titleCard);

    } else {
      const div = divisions.find(d => d.id === activeDivisionId);
      if (!div) return;

      sourceFeatures = div.features.map(f => ({ feature: f, division: div }));

      const introCard = document.createElement('div');
      introCard.className = 'division-intro-card';
      introCard.innerHTML = `
        <h3>${div.icon} DIVISION ${div.id}: ${esc(div.title)}</h3>
        <p>${esc(div.technicalIntro)}</p>
      `;
      displayFeatures.appendChild(introCard);
    }

    // Quick filters
    renderQuickFilters(displayFeatures, sourceFeatures.map(item => item.feature));

    // Apply active filter
    const filteredFeatures = sourceFeatures.filter(item => {
      if (activeFilter === 'complete') return COMPLETED_FEATURES.has(item.feature.id);
      if (activeFilter === 'in-progress') return IN_PROGRESS_FEATURES.has(item.feature.id);
      if (activeFilter === 'planned') return !COMPLETED_FEATURES.has(item.feature.id) && !IN_PROGRESS_FEATURES.has(item.feature.id);
      return true;
    });

    if (filteredFeatures.length === 0) {
      const emptyGrid = document.createElement('div');
      emptyGrid.className = 'rm-features-grid';
      emptyGrid.innerHTML = `
        <div class="rm-feature-card" style="grid-column: 1 / -1; text-align: center; padding: 32px; color: #8888a0;">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; margin-bottom: 8px; display: block; opacity: 0.5;">[ NO FEATURE MATCHES ]</span>
          No matching features match the selected filter criteria. Try resetting the active filter view.
        </div>
      `;
      displayFeatures.appendChild(emptyGrid);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'rm-features-grid';
    filteredFeatures.forEach(({ feature, division }) => {
      grid.appendChild(createFeatureCardElement(feature, division));
    });
    displayFeatures.appendChild(grid);
  }

  // ── Quick Filters ─────────────────────────────────────────────────

  function renderQuickFilters(parent: HTMLElement, featuresList: Feature[]) {
    const row = document.createElement('div');
    row.className = 'roadmap-quick-filters';

    const allCount = featuresList.length;
    const completeCount = featuresList.filter(f => COMPLETED_FEATURES.has(f.id)).length;
    const inProgressCount = featuresList.filter(f => IN_PROGRESS_FEATURES.has(f.id)).length;
    const plannedCount = allCount - completeCount - inProgressCount;

    row.innerHTML = `
      <button class="filter-btn${activeFilter === 'all' ? ' active' : ''}" data-filter="all">All (${allCount})</button>
      <button class="filter-btn${activeFilter === 'complete' ? ' active' : ''}" data-filter="complete">Shipped (${completeCount})</button>
      <button class="filter-btn${activeFilter === 'in-progress' ? ' active' : ''}" data-filter="in-progress">In Dev (${inProgressCount})</button>
      <button class="filter-btn${activeFilter === 'planned' ? ' active' : ''}" data-filter="planned">Planned (${plannedCount})</button>
    `;

    row.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.getAttribute('data-filter') as any;
        renderFeaturesList();
      });
    });

    parent.appendChild(row);
  }

  // ── Feature Card ──────────────────────────────────────────────────

  function createFeatureCardElement(feat: Feature, div: Division): HTMLElement {
    const card = document.createElement('div');
    card.className = 'rm-feature-card';

    let statusText = 'PLANNED';
    let statusClass = 'planned';
    if (COMPLETED_FEATURES.has(feat.id)) {
      statusText = 'SHIPPED';
      statusClass = 'complete';
    } else if (IN_PROGRESS_FEATURES.has(feat.id)) {
      statusText = 'IN DEV';
      statusClass = 'in-progress';
    }

    card.innerHTML = `
      <div class="rm-feature-card-header">
        <span class="rm-feature-card-title">${feat.id}. ${esc(feat.title)}</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
      <div class="rm-feature-field">
        <span class="rm-feature-field-label">TECHNICAL SPECIFICATION</span>
        <span class="rm-feature-field-value">${esc(feat.technicalIntegration)}</span>
      </div>
      <div class="rm-feature-field">
        <span class="rm-feature-field-label">COMMERCIAL VALUE</span>
        <span class="rm-feature-field-value market">${esc(feat.marketValue)}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      openFeatureModal(feat, div);
    });

    return card;
  }

  // ── Phases Timeline ───────────────────────────────────────────────

  function renderPhasesTimeline() {
    timelinePhases.innerHTML = '';

    phases.forEach(phase => {
      const node = document.createElement('div');
      let phaseClass = `phase-node`;
      if (phase.inProgress) phaseClass += ' active';
      if (phase.completed) phaseClass += ' completed';
      node.className = phaseClass;

      const featTags = phase.features.map(fId => {
        return `<span class="phase-feature-tag" data-feature-id="${fId}">#${fId}</span>`;
      }).join(' ');

      node.innerHTML = `
        <div class="phase-indicator">${phase.id}</div>
        <div class="phase-details-card">
          <div class="phase-details-header">
            <h3>PHASE ${phase.id}: ${esc(phase.name)}</h3>
            <span class="phase-duration">${esc(phase.duration)}</span>
          </div>
          <div class="phase-focus">${esc(phase.focus)}</div>
          <div class="phase-goal"><b>Phase Target:</b> ${esc(phase.goal)}</div>
          <div class="phase-features-list">
            <span style="font-size: 0.6rem; color: #8888a0; font-family: 'JetBrains Mono', monospace; margin-right: 4px;">FEATURES INCLUDED:</span>
            ${featTags}
          </div>
        </div>
      `;

      // Click feature tags to jump to that feature
      node.querySelectorAll('.phase-feature-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
          e.stopPropagation();
          const fId = parseInt(tag.getAttribute('data-feature-id')!);
          const div = divisions.find(d => d.features.some(f => f.id === fId));
          if (div) {
            const feat = div.features.find(f => f.id === fId)!;
            activeDivisionId = div.id;
            switchRoadmapTab('divisions');
            renderDivisionsSidebar();
            renderFeaturesList();
            searchRoadmap.value = `#${fId}`;
            currentSearchQuery = `#${fId}`;
            renderFeaturesList();
            openFeatureModal(feat, div);
          }
        });
      });

      timelinePhases.appendChild(node);
    });
  }

  // ── Search ────────────────────────────────────────────────────────

  searchRoadmap.addEventListener('input', () => {
    currentSearchQuery = searchRoadmap.value.trim();
    renderFeaturesList();
  });

  // ── Initialize ────────────────────────────────────────────────────
  updateRoadmapStats();
  renderDivisionsSidebar();
  renderFeaturesList();
});
