import * as webllm from '@mlc-ai/web-llm';
import paper from 'paper';
export class AIEngine {
    constructor(commitCallback) {
        this.engine = null;
        this.isModelLoaded = false;
        this.commitCallback = commitCallback;
    }
    async loadModel(progressCallback) {
        try {
            this.engine = new webllm.MLCEngine();
            const initProgressCallback = (report) => {
                if (progressCallback) {
                    progressCallback(report.progress, report.text);
                }
            };
            this.engine.setInitProgressCallback(initProgressCallback);
            // Using Llama-3-8B-Instruct-q4f32_1-MLC 
            await this.engine.reload('Llama-3-8B-Instruct-q4f32_1-MLC');
            this.isModelLoaded = true;
            return true;
        }
        catch (err) {
            console.error('Failed to load AI model via WebLLM:', err);
            return false;
        }
    }
    async executePrompt(prompt) {
        if (!this.engine || !this.isModelLoaded) {
            throw new Error("AI Model is not loaded. Please wait for initialization.");
        }
        const systemPrompt = `You are an expert Paper.js CAD drawing assistant.
The user will describe a shape or drawing.
You must reply with ONLY a valid JSON object representing the CAD commands. No conversational text.
Do NOT wrap the output in markdown code blocks.
Supported shape types in the JSON: "Rectangle", "Circle", "Star", "Polygon".

Example format:
{
  "commands": [
    { "type": "Rectangle", "x": 0, "y": 0, "width": 100, "height": 100 },
    { "type": "Circle", "x": 50, "y": 50, "radius": 50 },
    { "type": "Star", "x": 100, "y": 100, "points": 5, "radius1": 25, "radius2": 50 },
    { "type": "Polygon", "x": 0, "y": 0, "sides": 6, "radius": 50 }
  ]
}
Return ONLY raw JSON.`;
        const request = {
            stream: false,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
        };
        const reply = await this.engine.chat.completions.create(request);
        const responseText = reply.choices[0].message.content;
        if (!responseText) {
            throw new Error("Received empty response from AI model");
        }
        try {
            this.interpretAndDraw(responseText);
            return "Success: Drawing applied to canvas.";
        }
        catch (err) {
            console.error("Failed to parse or draw AI response:", err);
            throw new Error("Failed to interpret AI response: " + err.message);
        }
    }
    interpretAndDraw(jsonString) {
        if (!paper.project)
            return;
        let cleanJson = jsonString.trim();
        if (cleanJson.startsWith('```json'))
            cleanJson = cleanJson.substring(7);
        else if (cleanJson.startsWith('```'))
            cleanJson = cleanJson.substring(3);
        if (cleanJson.endsWith('```'))
            cleanJson = cleanJson.substring(0, cleanJson.length - 3);
        const payload = JSON.parse(cleanJson);
        if (!payload || !payload.commands || !Array.isArray(payload.commands)) {
            throw new Error("Invalid CAD payload structure.");
        }
        for (const cmd of payload.commands) {
            let shape = null;
            switch (cmd.type) {
                case 'Rectangle':
                    shape = new paper.Path.Rectangle(new paper.Point(cmd.x || 0, cmd.y || 0), new paper.Size(cmd.width || 100, cmd.height || 100));
                    break;
                case 'Circle':
                    shape = new paper.Path.Circle(new paper.Point(cmd.x || 0, cmd.y || 0), cmd.radius || 50);
                    break;
                case 'Star':
                    shape = new paper.Path.Star(new paper.Point(cmd.x || 0, cmd.y || 0), cmd.points || 5, cmd.radius1 || 25, cmd.radius2 || 50);
                    break;
                case 'Polygon':
                    shape = new paper.Path.RegularPolygon(new paper.Point(cmd.x || 0, cmd.y || 0), cmd.sides || 6, cmd.radius || 50);
                    break;
                default:
                    console.warn('Unknown shape type from AI:', cmd.type);
            }
            if (shape) {
                shape.strokeColor = new paper.Color(0, 0, 0, 1);
                shape.strokeWidth = 1;
                shape.fillColor = new paper.Color(0, 0, 0, 0);
                // By default paper.js adds to activeLayer which VectorEditor manages.
            }
        }
        // Trigger history commit
        this.commitCallback();
    }
}
//# sourceMappingURL=aiEngine.js.map