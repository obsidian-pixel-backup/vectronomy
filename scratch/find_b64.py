import json

def find_b64(obj, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and 'base64' in v[:100]:
                print(f"Path: {path}.{k if path else k}")
                print(f"Data snippet: {v[:50]}...")
            else:
                find_b64(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            find_b64(v, f"{path}[{i}]")

with open('SAMPLE DATA/$R8OGAWN.xcs', 'r') as f:
    data = json.load(f)
    find_b64(data)
