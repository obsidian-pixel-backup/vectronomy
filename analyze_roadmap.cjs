const fs = require('fs');
const content = fs.readFileSync('e:/DEVELOPER PROJECTS/vectronomy/VECTRONOMY_ROADMAP_AND_DOCUMENTATION.md', 'utf8');
const lines = content.split('\n');
let shipped = 0;
let outstanding = 0;
let outstandingList = [];
const regex = /^(\d{1,3})\.\s+(✅ \[SHIPPED\]\s+)?\*\*(.+?)\*\*/;

for (const line of lines) {
  const match = line.match(regex);
  if (match) {
    const num = match[1];
    const isShipped = !!match[2];
    const title = match[3];
    if (isShipped) {
      shipped++;
    } else {
      outstanding++;
      outstandingList.push({ num, title });
    }
  }
}

const total = shipped + outstanding;
const percent = total > 0 ? (shipped / total * 100).toFixed(2) : 0;

console.log(`Total Features Found: ${total}`);
console.log(`Shipped: ${shipped}`);
console.log(`Outstanding: ${outstanding}`);
console.log(`Completion: ${percent}%`);
console.log('Outstanding Features:');
outstandingList.forEach(f => console.log(`- [ ] ${f.num}. ${f.title}`));
