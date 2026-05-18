export interface Feature {
  id: number;
  title: string;
  technicalIntegration: string;
  marketValue: string;
}

export interface Division {
  id: number;
  title: string;
  icon: string;
  technicalIntro: string;
  features: Feature[];
}

export interface Phase {
  id: number;
  name: string;
  duration: string;
  focus: string;
  features: number[];
  goal: string;
}

export function parseRoadmap(md: string) {
  const divisions: Division[] = [];
  const phases: Phase[] = [];
  
  const lines = md.split('\n');
  
  let currentDivision: Division | null = null;
  let currentFeature: Feature | null = null;
  let currentPhase: Phase | null = null;
  
  let parsingPhases = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check if we hit the phases section
    if (line.includes('## 🛠️ RECOMMENDED DEVELOPMENT PHASES')) {
      parsingPhases = true;
      continue;
    }
    
    if (!parsingPhases) {
      // Match e.g.: "### 📐 Division 1: Vector Drawing & Geometry Creation (Illustrator-Grade)"
      const divMatch = line.match(/^###?\s+(.*?)\s+Division\s+(\d+):\s*(.*)$/i);
      if (divMatch) {
        currentDivision = {
          id: parseInt(divMatch[2]),
          icon: divMatch[1].trim(),
          title: divMatch[3].trim(),
          technicalIntro: '',
          features: []
        };
        divisions.push(currentDivision);
        currentFeature = null;
        continue;
      }
      
      // Technical intro bullet points before features start
      if (currentDivision && line.startsWith('* ') && currentDivision.features.length === 0) {
        currentDivision.technicalIntro += (currentDivision.technicalIntro ? '\n' : '') + line.replace(/^\*\s+/, '');
        continue;
      }
      
      // Match e.g.: "1. **Feature Title**" or "111. **Interactive 2.5D Path Extruder**"
      const featMatch = line.match(/^(\d+)\.\s+\*\*(.*?)\*\*/);
      if (featMatch && currentDivision) {
        currentFeature = {
          id: parseInt(featMatch[1]),
          title: featMatch[2].trim(),
          technicalIntegration: '',
          marketValue: ''
        };
        currentDivision.features.push(currentFeature);
        continue;
      }
      
      // Feature details
      if (currentFeature) {
        if (line.includes('*Technical Integration*') || line.includes('Technical Integration:')) {
          currentFeature.technicalIntegration = line.replace(/^.*\*Technical Integration\*:\s*/i, '').replace(/^.*Technical Integration:\s*/i, '').trim();
        } else if (line.includes('*Market Value*') || line.includes('Market Value:')) {
          currentFeature.marketValue = line.replace(/^.*\*Market Value\*:\s*/i, '').replace(/^.*Market Value:\s*/i, '').trim();
        }
      }
    } else {
      // Match e.g.: "### Phase 1: Project Management & User Interface (Weeks 1-3)"
      const phaseMatch = line.match(/^###\s+Phase\s+(\d+):\s*(.*?)\s*\((Weeks\s+.*?)\)/i);
      if (phaseMatch) {
        currentPhase = {
          id: parseInt(phaseMatch[1]),
          name: phaseMatch[2].trim(),
          duration: phaseMatch[3].trim(),
          focus: '',
          features: [],
          goal: ''
        };
        phases.push(currentPhase);
        continue;
      }
      
      if (currentPhase) {
        if (line.startsWith('*') && line.includes('Features:')) {
          const featsStr = line.replace(/^.*Features:\s*/i, '').trim();
          const ids = featsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
          currentPhase.features = ids;
        } else if (line.startsWith('*') && line.includes('Goal:')) {
          currentPhase.goal = line.replace(/^.*Goal:\s*/i, '').trim();
        } else if (!line.startsWith('###') && !line.startsWith('---') && !line.startsWith('<')) {
          currentPhase.focus = (currentPhase.focus ? ' ' : '') + line;
        }
      }
    }
  }
  
  return { divisions, phases };
}
