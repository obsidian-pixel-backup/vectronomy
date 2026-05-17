import json
import os

path = "SAMPLE DATA/$R8OGAWN.xcs"
with open(path, 'r') as f:
    data = json.load(f)

# The data structure is likely { canvas: { displays: [...] } } or just an array
# In our engine, we handle it as an array or a canvas object.
# Let's find the displays.

canvases = data.get('canvas', [])
if not isinstance(canvases, list):
    canvases = [canvases]
    
all_displays = []
for canvas in canvases:
    all_displays.extend(canvas.get('displays', []))

print(f"Total displays: {len(all_displays)}")

# Find CIRCLE elements
circles = [d for d in all_displays if d.get('type') == 'CIRCLE']
print(f"Found {len(circles)} circles")
for c in circles[:5]:
    print(json.dumps(c, indent=2))

# Find elements with paintType: hatch
hatch_elements = [d for d in all_displays if d.get('fill', {}).get('paintType') == 'hatch']
print(f"Found {len(hatch_elements)} hatch elements")
for h in hatch_elements[:5]:
    # Print only relevant fields to avoid base64 bloat
    h_print = {k: v for k, v in h.items() if k != 'base64'}
    print(json.dumps(h_print, indent=2))

# Check for elements with charJSONs but no text
char_only = [d for d in all_displays if d.get('charJSONs') and not d.get('text')]
print(f"Found {len(char_only)} elements with charJSONs but no text")

# Find hexagon (likely a PATH or PEN with many points)
hexagons = [d for d in all_displays if d.get('type') in ['PATH', 'PEN'] and d.get('dPath') and 'L' in d.get('dPath')]
print(f"Found {len(hexagons)} paths/pens")
for h in hexagons:
    # A hexagon usually has 6 segments
    if h.get('dPath', '').count('L') >= 5:
        print(f"Potential Hexagon: {h.get('id')} group: {h.get('groupTag')}")
        h_print = {k: v for k, v in h.items() if k not in ['base64', 'dPath']}
        print(json.dumps(h_print, indent=2))

# Find the group g-f67d4fad-a2dd-457c-81da-7f4e742b309c
group_tag = 'g-f67d4fad-a2dd-457c-81da-7f4e742b309c'
group_elements = [d for d in all_displays if d.get('groupTag') == group_tag]
print(f"Elements in group {group_tag}: {len(group_elements)}")
for ge in group_elements:
    print(f"  - {ge.get('id')} type: {ge.get('type')} zOrder: {ge.get('zOrder')}")

# Check groups data
groups_data = []
for canvas in canvases:
    groups_data.extend(canvas.get('groups', []))
print(f"Total groups in metadata: {len(groups_data)}")
for g in groups_data:
    if g.get('groupTag') == group_tag:
        print(f"Group Metadata for {group_tag}:")
        print(json.dumps(g, indent=2))
