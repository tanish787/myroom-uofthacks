import { RoomData, VoxelObject } from "../types";

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const BASE_RULES = `
The style must strictly match "Classic Detailed Voxel Art".
Sub-parts MUST touch or overlap (structural integrity).
Use vibrant, clean colors that represent the real object's materials.
`;

const ROOM_PROMPT = (sizeFeet: number) => `
Analyze this room photo and reconstruct it as a 3D modular isometric voxel environment.
The room is approximately ${sizeFeet}x${sizeFeet} feet.
${BASE_RULES}
Assign objects positions on a grid where 1 unit = 1 foot.
Ensure major furniture pieces are correctly scaled relative to each other and the ${sizeFeet}ft room size.
Return JSON with wallColor, floorColor, and objects array.
`;

const OBJECT_PROMPT = `
Analyze the MAIN SINGLE OBJECT in this photo. Reconstruct it as a high-fidelity 3D voxel module with a "Voxel Toy" aesthetic.
${BASE_RULES}
Scaling: Assume the object is a standard size for its type (e.g., a chair is ~1.5x1.5x3 units, a desk is ~4x2x2.5 units). 1 unit = 1 foot.
Focus on EXAGGERATING and EMPHASIZING the object's unique silhouettes and most recognizable features.
Instead of raw complexity, use 20-40 well-placed blocks to create a stylized, cartoonish version.
The goal is to create a premium-looking modular game asset that captures the "soul" of the object through its geometry.
Ignore the background environment completely.
Return JSON with a single object definition (name, type, parts, color, description).
`;

const ROOM_SCHEMA = {
  type: "object",
  properties: {
    wallColor: { type: "string" },
    floorColor: { type: "string" },
    objects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          type: { type: "string" },
          position: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
          rotation: { type: "number" },
          color: { type: "string" },
          description: { type: "string" },
          parts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                offset: { type: "array", items: { type: "number" } },
                dimensions: { type: "array", items: { type: "number" } },
                color: { type: "string" }
              },
              required: ["offset", "dimensions", "color"]
            }
          }
        },
        required: ["name", "type", "position", "parts"]
      }
    }
  },
  required: ["wallColor", "floorColor", "objects"]
};

const OBJECT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string" },
    color: { type: "string" },
    description: { type: "string" },
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          offset: { type: "array", items: { type: "number" } },
          dimensions: { type: "array", items: { type: "number" } },
          color: { type: "string" }
        },
        required: ["offset", "dimensions", "color"]
      }
    }
  },
  required: ["name", "type", "parts"]
};

async function callOpenRouter(base64Image: string, prompt: string, model: string, schema: any): Promise<any> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Voxel Room Architect'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${prompt}\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in response');
  }

  return JSON.parse(content);
}

export const analyzeRoomImage = async (base64Image: string, sizeFeet: number): Promise<RoomData> => {
  try {
    // Use Google Gemini Flash via OpenRouter
    const result = await callOpenRouter(
      base64Image,
      ROOM_PROMPT(sizeFeet),
      'google/gemini-3-flash-preview',
      ROOM_SCHEMA
    );

    return {
      wallColor: result.wallColor || '#cbd5e1',
      floorColor: result.floorColor || '#94a3b8',
      dimensions: { width: sizeFeet, depth: sizeFeet },
      objects: (result.objects || []).map((obj: any, idx: number) => ({
        ...obj,
        id: obj.id || `room-obj-${idx}-${Date.now()}`,
        rotation: obj.rotation || 0,
        visible: true,
        parts: obj.parts || []
      }))
    };
  } catch (error) {
    console.error("OpenRouter Error:", error);
    throw error;
  }
};

export const analyzeSingleObject = async (base64Image: string, spawnPosition: [number, number, number]): Promise<VoxelObject> => {
  try {
    // Use Google Gemini Pro via OpenRouter
    const obj = await callOpenRouter(
      base64Image,
      OBJECT_PROMPT,
      'google/gemini-3-flash-preview',
      OBJECT_SCHEMA
    );

    return {
      ...obj,
      id: `toolbox-${Date.now()}`,
      position: spawnPosition,
      rotation: 0,
      visible: true,
      parts: obj.parts || []
    };
  } catch (error) {
    console.error("OpenRouter Error:", error);
    throw error;
  }
};
