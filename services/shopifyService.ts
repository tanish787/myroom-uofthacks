import fetch from 'node-fetch';

interface ShopifyProduct {
  id: string;
  title: string;
  description?: string;
  images?: Array<{ src: string }>;
  variants?: Array<{ price: string; inventory_quantity: number }>;
}

interface TransformedShopifyItem {
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  color: string;
  type: string;
  creator: string;
  data: {
    id: string;
    name: string;
    type: string;
    position: [number, number, number];
    rotation: number;
    parts: Array<{
      offset: [number, number, number];
      dimensions: [number, number, number];
      color?: string;
    }>;
    color: string;
    description: string;
    visible: boolean;
    isUserCreated: boolean;
  };
  source: 'shopify';
}

const DEFAULT_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#34495e',
  '#95a5a6'
];

const IMAGE_DOWNLOAD_TIMEOUT = 5000; // 5 seconds

async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT);

    const response = await fetch(imageUrl, { signal: controller.signal as any });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.buffer();
    const base64 = (buffer as Buffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`⚠️ [Shopify] Failed to download image ${imageUrl}:`, error);
    return ''; // Return empty string if download fails
  }
}

function getRandomColor(): string {
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
}

function createGenericVoxelData(name: string, color: string): TransformedShopifyItem['data'] {
  return {
    id: `shopify-${Date.now()}-${Math.random()}`,
    name,
    type: 'decor',
    position: [0, 0, 0],
    rotation: 0,
    parts: [
      {
        offset: [0, 0, 0],
        dimensions: [1, 1, 1],
        color
      }
    ],
    color,
    description: name,
    visible: true,
    isUserCreated: false
  };
}

export async function fetchShopifyProducts(): Promise<TransformedShopifyItem[]> {
  try {
    const storeName = process.env.SHOPIFY_STORE_NAME;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!storeName || !accessToken) {
      throw new Error('Missing SHOPIFY_STORE_NAME or SHOPIFY_ACCESS_TOKEN in environment variables');
    }

    console.log(`🛒 [Shopify] Fetching products from store: ${storeName}`);

    const graphqlQuery = `
      query {
        products(first: 250) {
          edges {
            node {
              id
              title
              description
              images(first: 1) {
                edges {
                  node {
                    src
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    priceV2 {
                      amount
                    }
                    quantityAvailable
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${storeName}.myshopify.com/api/2025-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Storefront-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: graphqlQuery })
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    if (data.errors) {
      throw new Error(`GraphQL error: ${data.errors.map((e: any) => e.message).join(', ')}`);
    }

    const products = data.data?.products?.edges || [];

    console.log(`📦 [Shopify] Retrieved ${products.length} products`);

    const transformedItems: TransformedShopifyItem[] = [];

    for (const { node: product } of products) {
      try {
        // Get price and inventory from first variant (Storefront API format)
        const variant = product.variants?.edges?.[0]?.node;
        const price = variant?.priceV2?.amount ? parseFloat(variant.priceV2.amount) : 0;
        const inventoryQuantity = variant?.quantityAvailable || 0;

        // Get image (Storefront API uses 'src' instead of 'originalSrc')
        let imageUrl = '';
        const image = product.images?.edges?.[0]?.node;
        if (image?.src) {
          const base64Image = await downloadImageAsBase64(image.src);
          imageUrl = base64Image;
        }

        const color = getRandomColor();

        const item: TransformedShopifyItem = {
          name: product.title,
          price,
          description: product.description || `${product.title} from Shopify store`,
          imageUrl,
          color,
          type: 'decor',
          creator: storeName,
          data: createGenericVoxelData(product.title, color),
          source: 'shopify'
        };

        transformedItems.push(item);
        console.log(`✅ [Shopify] Transformed: ${product.title} ($${price})`);
      } catch (error) {
        console.error(`❌ [Shopify] Failed to transform product ${product.title}:`, error);
        continue;
      }
    }

    console.log(`✨ [Shopify] Successfully transformed ${transformedItems.length} items`);
    return transformedItems;
  } catch (error) {
    console.error('❌ [Shopify] Error fetching products:', error);
    throw error;
  }
}
