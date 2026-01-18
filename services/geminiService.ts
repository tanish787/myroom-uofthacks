import { RoomData, VoxelObject } from "../types";

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Debug: Check if API key is loaded
if (!OPENROUTER_API_KEY) {
  console.warn('⚠️ VITE_OPENROUTER_API_KEY is not set! Please check your .env file and restart the dev server.');
} else {
  console.log('✅ OpenRouter API Key loaded successfully');
}

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

const DECORATION_PROMPT = (roomJson: string, userRequest: string) => `
You are an expert interior designer and 3D voxel artist.
Current Room Data: ${roomJson}
User Request: ${userRequest}

Your task is to analyze the room and the user's request, then suggest modifications.
You can ADD, REMOVE, or MODIFY objects.
For NEW objects, provide full VoxelObject definitions.
For REMOVALS, specify the IDs.
For MODIFICATIONS, provide the updated VoxelObject.

Always maintain the 1 unit = 1 foot scale and ensure objects are placed realistically.
Return JSON with three optional arrays: 'add', 'remove' (IDs), and 'update'.
`;

const DECORATION_SCHEMA = {
  type: "object",
  properties: {
    add: { type: "array", items: OBJECT_SCHEMA },
    remove: { type: "array", items: { type: "string" } },
    update: { type: "array", items: { ...OBJECT_SCHEMA, properties: { ...OBJECT_SCHEMA.properties, id: { type: "string" } } } },
    assistantMessage: { type: "string" }
  }
};

const REFINEMENT_PROMPT = (objectJson: string) => `
You are a Quality Control Agent for 3D Voxel Assets.
Current Object Data: ${objectJson}

Evaluate this object's geometry and color:
1. Are structural parts (legs, arms, supports) connected to the main body?
2. Is the vertical stacking logical (e.g., table tops shouldn't float)?
3. Are the proportions realistic (e.g., a chair back shouldn't be 10ft tall)?
4. Is the color palette cohesive?

If there are issues, fix the 'parts' array. Move, resize, or add parts to ensure a high-quality, professional voxel look.
Ensure the object is centered at [0, 0, 0] offset-wise (relative to its position).
Return the corrected JSON.
`;

async function callOpenRouter(base64Image: string | null, prompt: string, model: string, schema: any): Promise<any> {
  const content: any[] = [{ type: 'text', text: `${prompt}\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}` }];
  
  if (base64Image) {
    content.push({
      type: 'image_url',
      image_url: {
        url: base64Image
      }
    });
  }

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
          content: content
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
  const contentResponse = data.choices[0]?.message?.content;

  if (!contentResponse) {
    throw new Error('No content in response');
  }

  return JSON.parse(contentResponse);
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

export const autoDecorate = async (roomData: RoomData, userRequest: string): Promise<any> => {
  try {
    const result = await callOpenRouter(
      null,
      DECORATION_PROMPT(JSON.stringify(roomData), userRequest),
      'google/gemini-3-flash-preview',
      DECORATION_SCHEMA
    );
    return result;
  } catch (error) {
    console.error("Auto Decorate Error:", error);
    throw error;
  }
};

export const refineObject = async (base64Image: string, object: VoxelObject): Promise<VoxelObject> => {
  try {
    const result = await callOpenRouter(
      base64Image,
      REFINEMENT_PROMPT(JSON.stringify(object)),
      'google/gemini-3-flash-preview',
      OBJECT_SCHEMA
    );

    return {
      ...object,
      ...result,
      id: object.id, // Preserve ID
      position: object.position, // Preserve position
      rotation: object.rotation, // Preserve rotation
      visible: true
    };
  } catch (error) {
    console.error("Refinement Error:", error);
    throw error;
  }
};
export const generateRoomFromDescription = async (description: string, sizeFeet: number): Promise<RoomData> => {
  const prompt = `
You are an expert interior designer and 3D voxel artist.
Based on this room description, create a complete room design in 3D voxel format.

Room Description: "${description}"
Room Size: ${sizeFeet}x${sizeFeet} feet
${BASE_RULES}

Create appropriate furniture and objects that would be found in this type of room.
Position objects on a grid where 1 unit = 1 foot.
Ensure all objects are positioned within the room bounds (0 to ${sizeFeet} on X and Z axes).
Maximum wall height is 8 feet.

Return JSON with wallColor, floorColor, and objects array.
Each object should have: id (unique), name, type, position [x, y, z], rotation, color, description, and parts array.
`;

  try {
    console.log('🔄 Calling OpenRouter API for room generation...');
    const result = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    }).then(r => r.json());

    console.log('📥 API Response received:', result);

    if (result.error) {
      console.error('OpenRouter API Error:', result.error);
      throw new Error(result.error.message || 'API Error');
    }

    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      console.error('❌ No content in response. Full result:', result);
      throw new Error('No content in API response');
    }

    console.log('📄 Extracted content:', content.substring(0, 200));

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON found in content');
      throw new Error('No JSON found in response');
    }

    const roomData = JSON.parse(jsonMatch[0]) as RoomData;
    console.log('✅ JSON parsed successfully:', roomData);

    // Ensure dimensions are set
    if (!roomData.dimensions) {
      roomData.dimensions = { width: sizeFeet, depth: sizeFeet };
    }

    // Ensure all objects are within bounds
    roomData.objects = (roomData.objects || []).map(obj => ({
      ...obj,
      position: [
        Math.max(0.5, Math.min(sizeFeet - 0.5, obj.position[0] || sizeFeet / 2)),
        obj.position[1] || 0,
        Math.max(0.5, Math.min(sizeFeet - 0.5, obj.position[2] || sizeFeet / 2))
      ] as [number, number, number],
      id: obj.id || `obj-${Date.now()}-${Math.random()}`,
      visible: true
    }));

    console.log('✅ Final room data prepared:', roomData);
    return roomData;
  } catch (error) {
    console.error('❌ Room Generation Error:', error);
    throw error;
  }
};