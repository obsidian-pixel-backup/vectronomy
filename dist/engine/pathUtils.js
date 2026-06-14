export function parseSvgPath(d) {
    const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    let match;
    const commands = [];
    while ((match = regex.exec(d))) {
        const type = match[1];
        const argsStr = match[2].replace(/(?<!e)-/ig, ' -').trim();
        const args = argsStr.split(/[\s,]+/).filter(s => s !== '').map(Number);
        commands.push({ type, args });
    }
    return commands;
}
export function stringifySvgPath(commands) {
    return commands.map(c => `${c.type}${c.args.join(' ')}`).join(' ');
}
export function absolutizePath(commands) {
    let cx = 0, cy = 0;
    let startX = 0, startY = 0;
    const absCommands = [];
    for (const cmd of commands) {
        const type = cmd.type;
        const args = [...cmd.args];
        const isRel = type.toLowerCase() === type;
        const upper = type.toUpperCase();
        if (upper === 'Z') {
            cx = startX;
            cy = startY;
            absCommands.push({ type: 'Z', args: [] });
            continue;
        }
        if (upper === 'H') {
            for (let i = 0; i < args.length; i++) {
                cx = isRel ? cx + args[i] : args[i];
                absCommands.push({ type: 'L', args: [cx, cy] });
            }
            continue;
        }
        if (upper === 'V') {
            for (let i = 0; i < args.length; i++) {
                cy = isRel ? cy + args[i] : args[i];
                absCommands.push({ type: 'L', args: [cx, cy] });
            }
            continue;
        }
        let pairCount = 2;
        if (upper === 'Q' || upper === 'S')
            pairCount = 4;
        if (upper === 'C')
            pairCount = 6;
        if (upper === 'A')
            pairCount = 7;
        if (args.length === 0 && upper !== 'Z') {
            absCommands.push({ type: upper, args: [] });
            continue;
        }
        for (let i = 0; i < args.length; i += pairCount) {
            const chunk = args.slice(i, i + pairCount);
            if (chunk.length < pairCount)
                break; // invalid path chunk
            if (upper === 'A') {
                if (isRel) {
                    chunk[5] += cx;
                    chunk[6] += cy;
                }
                cx = chunk[5];
                cy = chunk[6];
            }
            else {
                for (let j = 0; j < chunk.length; j += 2) {
                    if (isRel) {
                        chunk[j] += cx;
                        chunk[j + 1] += cy;
                    }
                    if (j === chunk.length - 2) {
                        cx = chunk[j];
                        cy = chunk[j + 1];
                    }
                }
            }
            if (upper === 'M' && i === 0) {
                startX = cx;
                startY = cy;
            }
            absCommands.push({ type: upper, args: chunk });
        }
    }
    return absCommands;
}
export function extractNodes(commands) {
    const nodes = [];
    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        if (cmd.type === 'Z')
            continue;
        // The anchor node is always the LAST pair in the args
        // e.g. for C x1 y1 x2 y2 x y, the anchor is x y.
        if (cmd.args.length >= 2) {
            const argIndexX = cmd.args.length - 2;
            const argIndexY = cmd.args.length - 1;
            nodes.push({
                cmdIndex: i,
                argIndexX,
                argIndexY,
                x: cmd.args[argIndexX],
                y: cmd.args[argIndexY]
            });
        }
    }
    return nodes;
}
//# sourceMappingURL=pathUtils.js.map