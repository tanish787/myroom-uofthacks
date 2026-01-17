import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f5f5); // Very light grey

// Camera
const camera = new THREE.PerspectiveCamera(
    75,
    Math.max(400, window.innerWidth - 280 - 260) / window.innerHeight, // Account for both panels, ensure minimum
    0.1,
    1000
);
// Initial camera position
const initialDistance = 60;
camera.position.set(40, 50, 60);
camera.lookAt(0, 0, 0);
let currentZoom = initialDistance; // Track zoom distance

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
const panelWidth = 280;
let rightPanelWidth = 260; // Will be updated
const canvasWidth = Math.max(400, window.innerWidth - panelWidth - rightPanelWidth); // Ensure minimum width
renderer.setSize(canvasWidth, window.innerHeight);
renderer.domElement.style.marginLeft = panelWidth + 'px';
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.shadowMap.enabled = false; // Disabled for cartoon style

// Ensure canvas container exists before appending
const canvasContainer = document.getElementById('canvas-container');
if (canvasContainer) {
    canvasContainer.appendChild(renderer.domElement);
} else {
    // If container doesn't exist yet, wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const container = document.getElementById('canvas-container');
            if (container) container.appendChild(renderer.domElement);
        });
    }
}

// Lighting (softer, more cartoon-like)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(30, 50, 30);
directionalLight.castShadow = false; // Disabled for cartoon style
scene.add(directionalLight);

// Room dimensions (reduced for more compact feel)
const ROOM_SIZE = 75;
const ROOM_HEIGHT = 60;
const FLOOR_SIZE = ROOM_SIZE;

// Floor (cartoon-like: flat color, no shadows)
const floorGeometry = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);
const floorMaterial = new THREE.MeshLambertMaterial({
    color: 0xe0e0e0
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = false;
scene.add(floor);

// Back wall (left wall in corner)
const backWallGeometry = new THREE.PlaneGeometry(FLOOR_SIZE, ROOM_HEIGHT);
const backWallMaterial = new THREE.MeshLambertMaterial({
    color: 0xa0a0ff
});
const backWall = new THREE.Mesh(backWallGeometry, backWallMaterial);
backWall.position.set(-FLOOR_SIZE / 2, ROOM_HEIGHT / 2, 0);
backWall.rotation.y = Math.PI / 2;
backWall.receiveShadow = false;
scene.add(backWall);

// Side wall (right wall in corner)
const sideWallGeometry = new THREE.PlaneGeometry(FLOOR_SIZE, ROOM_HEIGHT);
const sideWallMaterial = new THREE.MeshLambertMaterial({
    color: 0xffa0a0
});
const sideWall = new THREE.Mesh(sideWallGeometry, sideWallMaterial);
sideWall.position.set(0, ROOM_HEIGHT / 2, -FLOOR_SIZE / 2);
sideWall.receiveShadow = false;
scene.add(sideWall);

// Store room elements for regeneration
let roomElements = { floor, backWall, sideWall, floorMaterial, backWallMaterial, sideWallMaterial };

// Helper function to create objects
function createObject(type, color, position) {
    let geometry;
    
    switch(type) {
        case 'cube':
            geometry = new THREE.BoxGeometry(5, 5, 5);
            break;
        case 'sphere':
            geometry = new THREE.SphereGeometry(3, 16, 16);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(3, 3, 6, 16);
            break;
        case 'cone':
            geometry = new THREE.ConeGeometry(3, 6, 16);
            break;
        default:
            geometry = new THREE.BoxGeometry(5, 5, 5);
    }
    
    const material = new THREE.MeshLambertMaterial({
        color: color,
        flatShading: true
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    
    // IMPORTANT: Mark as game object for save functionality
    mesh.userData.isGameObject = true;
    mesh.userData.type = type;
    mesh.userData.name = type;
    mesh.userData.color = color;
    
    return mesh;
}

// Random seller names generator
const firstNames = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Blake', 'Cameron', 'Dakota', 'Emery', 'Finley', 'Harper'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas'];

function getRandomSellerName() {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${firstName} ${lastName}`;
}

function getRandomRating() {
    // Generate rating between 3.0 and 5.0, rounded to 0.5 increments
    return Math.round((Math.random() * 2 + 3) * 2) / 2;
}

function getRandomPrice() {
    // Generate price between $10 and $200, rounded to nearest dollar
    return Math.round(Math.random() * 190 + 10);
}

function getRandomContactInfo() {
    // Generate random phone number
    const phone = `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
    // Generate random email
    const emailDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)].toLowerCase();
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)].toLowerCase();
    const email = `${firstName}.${lastName}@${emailDomains[Math.floor(Math.random() * emailDomains.length)]}`;
    return { phone, email };
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) stars += '⭐'; // Half star (medium white star)
    stars += '☆'.repeat(emptyStars);
    
    return stars;
}

// Create draggable objects
const objects = [];
const objectData = [];

// Add some objects to the room (adjusted for smaller room)
const objectConfigs = [
    { type: 'cube', color: 0xff6b6b, position: { x: -12, y: 2.5, z: -12 } },
    { type: 'sphere', color: 0x4ecdc4, position: { x: 0, y: 3, z: -12 } },
    { type: 'cylinder', color: 0x95e1d3, position: { x: 12, y: 3, z: -12 } },
    { type: 'cone', color: 0xfce38a, position: { x: -12, y: 3, z: 0 } },
    { type: 'cube', color: 0xf38181, position: { x: 12, y: 2.5, z: 0 } },
    { type: 'sphere', color: 0xaa96da, position: { x: 0, y: 3, z: 0 } }
];

objectConfigs.forEach(config => {
    const obj = createObject(config.type, config.color, config.position);
    objects.push(obj);
    scene.add(obj);
    
    // Store metadata for panel
    const contactInfo = getRandomContactInfo();
    objectData.push({
        name: config.type,
        seller: getRandomSellerName(),
        rating: getRandomRating(),
        price: getRandomPrice(),
        phone: contactInfo.phone,
        email: contactInfo.email
    });
});

// Function to create a preview image for an object
function createObjectPreview(type, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    
    // Convert hex color to RGB
    const r = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const b = color & 255;
    const colorStr = `rgb(${r}, ${g}, ${b})`;
    
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 80, 80);
    
    ctx.fillStyle = colorStr;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    
    const centerX = 40;
    const centerY = 40;
    
    switch(type) {
        case 'cube':
            // Draw cube with perspective
            ctx.beginPath();
            ctx.moveTo(25, 20);
            ctx.lineTo(55, 20);
            ctx.lineTo(60, 30);
            ctx.lineTo(30, 30);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(55, 20);
            ctx.lineTo(60, 30);
            ctx.lineTo(60, 50);
            ctx.lineTo(55, 60);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(25, 20);
            ctx.lineTo(30, 30);
            ctx.lineTo(30, 50);
            ctx.lineTo(25, 60);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
        case 'sphere':
            const gradient = ctx.createRadialGradient(centerX - 10, centerY - 10, 5, centerX, centerY, 20);
            gradient.addColorStop(0, `rgba(${r + 40}, ${g + 40}, ${b + 40}, 1)`);
            gradient.addColorStop(1, colorStr);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
        case 'cylinder':
            ctx.beginPath();
            ctx.ellipse(centerX, 25, 18, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(22, 25);
            ctx.lineTo(22, 55);
            ctx.lineTo(58, 55);
            ctx.lineTo(58, 25);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.ellipse(centerX, 55, 18, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
        case 'cone':
            ctx.beginPath();
            ctx.moveTo(centerX, 20);
            ctx.lineTo(25, 60);
            ctx.lineTo(55, 60);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.ellipse(centerX, 60, 15, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
    }
    
    return canvas.toDataURL();
}

// Create items panel
function createItemsPanel() {
    const itemsList = document.getElementById('items-list');
    itemsList.innerHTML = ''; // Clear existing items
    
    objectData.forEach((data, index) => {
        const obj = objects[index];
        const previewUrl = createObjectPreview(data.name, obj.userData.color);
        
        const card = document.createElement('div');
        card.className = 'item-card';
        card.dataset.index = index;
        card.innerHTML = `
            <div class="item-image-container">
                <img src="${previewUrl}" alt="${data.name}" class="item-image">
            </div>
            <div class="item-name">${data.name}</div>
            <div class="item-price">$${data.price}</div>
            <div class="item-seller">Seller: ${data.seller}</div>
            <div class="item-rating">
                <span class="stars">${renderStars(data.rating)}</span>
                <span class="rating-text">${data.rating.toFixed(1)}</span>
            </div>
            <button class="buy-btn" data-item-index="${index}">Buy</button>
        `;
        itemsList.appendChild(card);
        
        // Add click handler for Buy button
        const buyBtn = card.querySelector('.buy-btn');
        buyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemIndex = parseInt(buyBtn.dataset.itemIndex);
            navigateToCheckout(itemIndex);
        });
        
    });
}

createItemsPanel();

// Navigate to checkout page
function navigateToCheckout(itemIndex) {
    const item = objectData[itemIndex];
    // Store item data in localStorage for checkout page
    localStorage.setItem('checkoutItem', JSON.stringify({
        index: itemIndex,
        name: item.name,
        price: item.price,
        seller: item.seller,
        phone: item.phone,
        email: item.email,
        rating: item.rating
    }));
    // Navigate to checkout page
    window.location.href = 'checkout.html';
}

// Drag and drop interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedObject = null;
let isDragging = false;
let dragOffset = new THREE.Vector3();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// Mouse events
function onMouseDown(event) {
    // Don't handle clicks on the panels
    if (event.clientX < panelWidth || event.clientX > window.innerWidth - rightPanelWidth) return;
    
    // Adjust mouse coordinates to account for panel
    const adjustedX = event.clientX - panelWidth;
    mouse.x = (adjustedX / (window.innerWidth - panelWidth - rightPanelWidth)) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects);
    
    if (intersects.length > 0) {
        selectedObject = intersects[0].object;
        isDragging = true;
        
        // No offset needed - object will follow cursor directly
        dragOffset.set(0, 0, 0);
        
        document.body.style.cursor = 'grabbing';
        renderer.domElement.style.cursor = 'grabbing';
    }
}

// Tooltip element
const tooltip = document.getElementById('tooltip');
let hoveredObject = null;

function onMouseMove(event) {
    // Don't handle mouse events over the panels
    if (event.clientX < panelWidth || event.clientX > window.innerWidth - rightPanelWidth) {
        if (hoveredObject) {
            hoveredObject = null;
            tooltip.style.display = 'none';
        }
        return;
    }
    
    // Adjust mouse coordinates to account for panel
    const adjustedX = event.clientX - panelWidth;
    
    if (!isDragging || !selectedObject) {
        // Update cursor on hover and show tooltip
        mouse.x = (adjustedX / (window.innerWidth - panelWidth - rightPanelWidth)) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(objects);
        
        if (intersects.length > 0) {
            const currentObject = intersects[0].object;
            if (currentObject !== hoveredObject) {
                hoveredObject = currentObject;
                const objectName = currentObject.userData.name || 'object';
                tooltip.textContent = objectName.charAt(0).toUpperCase() + objectName.slice(1);
                tooltip.style.display = 'block';
            }
            // Update tooltip position
            tooltip.style.left = (event.clientX + 15) + 'px';
            tooltip.style.top = (event.clientY - 30) + 'px';
            renderer.domElement.style.cursor = 'grab';
        } else {
            if (hoveredObject) {
                hoveredObject = null;
                tooltip.style.display = 'none';
            }
            renderer.domElement.style.cursor = 'default';
        }
        return;
    }
    
    mouse.x = (adjustedX / (window.innerWidth - panelWidth - rightPanelWidth)) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Intersect with floor plane - follow cursor directly
    const intersectPoint = new THREE.Vector3();
    
    if (raycaster.ray.intersectPlane(floorPlane, intersectPoint)) {
        // Directly use intersection point (no offset for smoother following)
        // Constrain to room bounds (with margin for object size)
        const halfSize = FLOOR_SIZE / 2 - 4;
        intersectPoint.x = Math.max(-halfSize, Math.min(halfSize, intersectPoint.x));
        intersectPoint.z = Math.max(-halfSize, Math.min(halfSize, intersectPoint.z));
        
        // Keep object above floor
        const boundingBox = new THREE.Box3().setFromObject(selectedObject);
        const objectHeight = boundingBox.max.y - boundingBox.min.y;
        intersectPoint.y = objectHeight / 2;
        
        // Update object position directly
        selectedObject.position.copy(intersectPoint);
    }
}

function onMouseUp(event) {
    if (isDragging) {
        isDragging = false;
        selectedObject = null;
        document.body.style.cursor = 'default';
        renderer.domElement.style.cursor = 'default';
        // Hide tooltip while dragging ends
        tooltip.style.display = 'none';
        hoveredObject = null;
    }
}

// Touch events for mobile
function onTouchStart(event) {
    // Don't handle touches on the panel
    if (event.touches[0].clientX < panelWidth) return;
    event.preventDefault();
    const touch = event.touches[0];
    const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY
    };
    onMouseDown(mouseEvent);
}

function onTouchMove(event) {
    if (!isDragging) return;
    event.preventDefault();
    const touch = event.touches[0];
    const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY
    };
    onMouseMove(mouseEvent);
}

function onTouchEnd(event) {
    event.preventDefault();
    onMouseUp(event);
}

// Zoom controls
const minZoom = 30;
const maxZoom = 120;

// Zoom implementation
function handleWheelZoom(event) {
    // Don't zoom if over panels
    if (event.clientX < panelWidth || event.clientX > window.innerWidth - rightPanelWidth) {
        return;
    }
    
    event.preventDefault();
    
    const zoomSpeed = 2;
    const zoomDelta = event.deltaY > 0 ? zoomSpeed : -zoomSpeed;
    
    // Calculate current distance from origin
    const currentDistance = camera.position.length();
    const newDistance = currentDistance + zoomDelta;
    
    // Clamp zoom
    const clampedDistance = Math.max(minZoom, Math.min(maxZoom, newDistance));
    currentZoom = clampedDistance;
    
    // Normalize current position and scale to new distance
    const normalizedPosition = camera.position.clone().normalize();
    camera.position.copy(normalizedPosition.multiplyScalar(clampedDistance));
    camera.lookAt(0, 0, 0);
}

// Event listeners
renderer.domElement.addEventListener('mousedown', onMouseDown);
renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mouseup', onMouseUp);
renderer.domElement.addEventListener('wheel', handleWheelZoom, { passive: false });
renderer.domElement.addEventListener('touchstart', onTouchStart);
renderer.domElement.addEventListener('touchmove', onTouchMove);
renderer.domElement.addEventListener('touchend', onTouchEnd);

// Handle window resize
window.addEventListener('resize', () => {
    const canvasWidth = Math.max(400, window.innerWidth - panelWidth - rightPanelWidth);
    camera.aspect = canvasWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvasWidth, window.innerHeight);
    renderer.domElement.style.marginLeft = panelWidth + 'px';
});

// Room generation system
let selectedColors = ['#ff6b6b', '#4ecdc4', '#95e1d3'];
let selectedStyle = 'eclectic';

// Convert hex to Three.js color
function hexToColor(hex) {
    return parseInt(hex.replace('#', ''), 16);
}

// Generate color variations based on style
function getStyleColors(colors, style) {
    const baseColors = colors.map(hex => hexToColor(hex));
    
    switch(style) {
        case 'modern':
            // Modern: High contrast, bold colors
            return baseColors.map(c => {
                const r = (c >> 16) & 255;
                const g = (c >> 8) & 255;
                const b = c & 255;
                // Increase saturation
                return ((Math.min(255, r + 20) << 16) | (Math.min(255, g + 20) << 8) | Math.min(255, b + 20));
            });
        case 'classic':
            // Classic: Muted, warm tones
            return baseColors.map(c => {
                const r = (c >> 16) & 255;
                const g = (c >> 8) & 255;
                const b = c & 255;
                // Warm, muted tones
                return ((Math.min(255, r * 0.9) << 16) | (Math.min(255, g * 0.85) << 8) | Math.min(255, b * 0.8));
            });
        case 'minimalist':
            // Minimalist: Light, pastel colors
            return baseColors.map(c => {
                const r = (c >> 16) & 255;
                const g = (c >> 8) & 255;
                const b = c & 255;
                // Lighten colors
                return (((r + 255) / 2 << 16) | ((g + 255) / 2 << 8) | (b + 255) / 2);
            });
        case 'rustic':
            // Rustic: Earthy, desaturated colors
            return baseColors.map(c => {
                const r = (c >> 16) & 255;
                const g = (c >> 8) & 255;
                const b = c & 255;
                // Earthy tones
                return ((Math.min(255, r * 0.7 + 30) << 16) | (Math.min(255, g * 0.7 + 20) << 8) | Math.min(255, b * 0.6 + 10));
            });
        default: // eclectic
            return baseColors;
    }
}

// Generate furniture layout based on style
function generateFurnitureLayout(style, colors) {
    const styleColors = getStyleColors(colors, style);
    const layouts = {
        modern: [
            { type: 'cube', color: styleColors[0], position: { x: -15, y: 2.5, z: -15 } },
            { type: 'cube', color: styleColors[1], position: { x: 15, y: 2.5, z: -15 } },
            { type: 'sphere', color: styleColors[2], position: { x: 0, y: 3, z: -12 } },
            { type: 'cylinder', color: styleColors[0], position: { x: -15, y: 3, z: 0 } },
            { type: 'cone', color: styleColors[1], position: { x: 15, y: 3, z: 0 } },
            { type: 'sphere', color: styleColors[2], position: { x: 0, y: 3, z: 8 } }
        ],
        classic: [
            { type: 'cylinder', color: styleColors[0], position: { x: -12, y: 3, z: -15 } },
            { type: 'cylinder', color: styleColors[1], position: { x: 12, y: 3, z: -15 } },
            { type: 'cube', color: styleColors[2], position: { x: 0, y: 2.5, z: -8 } },
            { type: 'cone', color: styleColors[0], position: { x: -12, y: 3, z: 4 } },
            { type: 'cone', color: styleColors[1], position: { x: 12, y: 3, z: 4 } }
        ],
        minimalist: [
            { type: 'sphere', color: styleColors[0], position: { x: -8, y: 3, z: -12 } },
            { type: 'sphere', color: styleColors[1], position: { x: 8, y: 3, z: -12 } },
            { type: 'cube', color: styleColors[2], position: { x: 0, y: 2.5, z: 0 } },
            { type: 'cylinder', color: styleColors[0], position: { x: -8, y: 3, z: 8 } },
            { type: 'cylinder', color: styleColors[1], position: { x: 8, y: 3, z: 8 } }
        ],
        eclectic: [
            { type: 'cube', color: styleColors[0], position: { x: -12, y: 2.5, z: -12 } },
            { type: 'sphere', color: styleColors[1], position: { x: 0, y: 3, z: -12 } },
            { type: 'cylinder', color: styleColors[2], position: { x: 12, y: 3, z: -12 } },
            { type: 'cone', color: styleColors[0], position: { x: -12, y: 3, z: 0 } },
            { type: 'cube', color: styleColors[1], position: { x: 12, y: 2.5, z: 0 } },
            { type: 'sphere', color: styleColors[2], position: { x: 0, y: 3, z: 0 } }
        ],
        rustic: [
            { type: 'cylinder', color: styleColors[0], position: { x: -14, y: 3, z: -14 } },
            { type: 'cube', color: styleColors[1], position: { x: 0, y: 2.5, z: -14 } },
            { type: 'cylinder', color: styleColors[2], position: { x: 14, y: 3, z: -14 } },
            { type: 'cone', color: styleColors[0], position: { x: -14, y: 3, z: 0 } },
            { type: 'cube', color: styleColors[1], position: { x: 14, y: 2.5, z: 0 } }
        ]
    };
    
    return layouts[style] || layouts.eclectic;
}

// Update room colors
function updateRoomColors(colors, style) {
    const styleColors = getStyleColors(colors, style);
    
    // Update floor - use first color, muted
    const floorColor = styleColors[0];
    const floorR = (floorColor >> 16) & 255;
    const floorG = (floorColor >> 8) & 255;
    const floorB = floorColor & 255;
    roomElements.floorMaterial.color.setRGB(floorR / 255 * 0.5, floorG / 255 * 0.5, floorB / 255 * 0.5);
    
    // Update back wall - use second color
    const wall1Color = styleColors[1] || styleColors[0];
    const wall1R = (wall1Color >> 16) & 255;
    const wall1G = (wall1Color >> 8) & 255;
    const wall1B = wall1Color & 255;
    roomElements.backWallMaterial.color.setRGB(wall1R / 255, wall1G / 255, wall1B / 255);
    
    // Update side wall - use third color or first if not available
    const wall2Color = styleColors[2] || styleColors[0];
    const wall2R = (wall2Color >> 16) & 255;
    const wall2G = (wall2Color >> 8) & 255;
    const wall2B = wall2Color & 255;
    roomElements.sideWallMaterial.color.setRGB(wall2R / 255, wall2G / 255, wall2B / 255);
}

// Generate new room
function generateRoom() {
    // Remove old objects
    objects.forEach(obj => {
        scene.remove(obj);
        obj.geometry.dispose();
        obj.material.dispose();
    });
    objects.length = 0;
    objectData.length = 0;
    
    // Update room colors
    updateRoomColors(selectedColors, selectedStyle);
    
    // Generate new furniture layout
    const newLayout = generateFurnitureLayout(selectedStyle, selectedColors);
    
    // Create new objects
    newLayout.forEach(config => {
        const obj = createObject(config.type, config.color, config.position);
        objects.push(obj);
        scene.add(obj);
        
        // Store metadata for panel
        const contactInfo = getRandomContactInfo();
        objectData.push({
            name: config.type,
            seller: getRandomSellerName(),
            rating: getRandomRating(),
            price: getRandomPrice(),
            phone: contactInfo.phone,
            email: contactInfo.email
        });
    });
    
    // Update items panel
    createItemsPanel();
}

// Update room surface colors directly
function updateRoomSurfaceColors() {
    const floorColorPicker = document.getElementById('floor-color');
    const wall1ColorPicker = document.getElementById('wall1-color');
    const wall2ColorPicker = document.getElementById('wall2-color');
    
    if (floorColorPicker) {
        const floorColor = floorColorPicker.value;
        const hex = parseInt(floorColor.replace('#', ''), 16);
        const r = ((hex >> 16) & 255) / 255;
        const g = ((hex >> 8) & 255) / 255;
        const b = (hex & 255) / 255;
        roomElements.floorMaterial.color.setRGB(r, g, b);
    }
    
    if (wall1ColorPicker) {
        const wall1Color = wall1ColorPicker.value;
        const hex = parseInt(wall1Color.replace('#', ''), 16);
        const r = ((hex >> 16) & 255) / 255;
        const g = ((hex >> 8) & 255) / 255;
        const b = (hex & 255) / 255;
        roomElements.backWallMaterial.color.setRGB(r, g, b);
    }
    
    if (wall2ColorPicker) {
        const wall2Color = wall2ColorPicker.value;
        const hex = parseInt(wall2Color.replace('#', ''), 16);
        const r = ((hex >> 16) & 255) / 255;
        const g = ((hex >> 8) & 255) / 255;
        const b = (hex & 255) / 255;
        roomElements.sideWallMaterial.color.setRGB(r, g, b);
    }
}

// Event listeners for room controls (set up after DOM is ready)
function setupRoomControls() {
    // Room surface color pickers
    const roomColorPickers = ['floor-color', 'wall1-color', 'wall2-color'];
    roomColorPickers.forEach(id => {
        const picker = document.getElementById(id);
        if (picker) {
            picker.addEventListener('input', updateRoomSurfaceColors);
        }
    });
    
    // Furniture color pickers
    const colorPickers = ['color1', 'color2', 'color3'];
    colorPickers.forEach((id, index) => {
        const picker = document.getElementById(id);
        if (picker) {
            picker.addEventListener('input', (e) => {
                selectedColors[index] = e.target.value;
            });
        }
    });
    
    // Style options
    const styleOptions = document.querySelectorAll('.style-option');
    styleOptions.forEach(option => {
        option.addEventListener('click', () => {
            styleOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedStyle = option.dataset.style;
        });
    });
    
    // Generate button
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateRoom);
    }
}

// Setup controls when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupRoomControls();
        setupInfoPanel();
        setupRoomNameEditing();
    });
} else {
    setupRoomControls();
    setupInfoPanel();
    setupRoomNameEditing();
}

// Setup minimize/maximize for info panel
function setupInfoPanel() {
    const infoPanel = document.getElementById('info');
    const minimizeBtn = document.getElementById('minimize-btn');
    let isMinimized = false;
    
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            isMinimized = !isMinimized;
            if (isMinimized) {
                infoPanel.classList.add('minimized');
                minimizeBtn.textContent = '+';
            } else {
                infoPanel.classList.remove('minimized');
                minimizeBtn.textContent = '−';
            }
        });
    }
}

// Setup room name editing
function setupRoomNameEditing() {
    const roomNameInput = document.getElementById('room-name-input');
    if (roomNameInput) {
        roomNameInput.addEventListener('blur', () => {
            // Save room name (could be stored in localStorage)
            localStorage.setItem('roomName', roomNameInput.value);
        });
        
        // Load saved room name
        const savedName = localStorage.getItem('roomName');
        if (savedName) {
            roomNameInput.value = savedName;
        }
    }
}

// Add this function to capture the current room state
function getCurrentRoomState() {
  const roomState = {
    objects: [],
    roomName: document.getElementById('room-name-input')?.value || 'My Room'
  };

  // Iterate through all objects in the scene and capture their properties
  objects.forEach(child => {
    roomState.objects.push({
      type: child.userData.type,
      position: {
        x: child.position.x,
        y: child.position.y,
        z: child.position.z
      },
      rotation: {
        x: child.rotation.x,
        y: child.rotation.y,
        z: child.rotation.z
      },
      scale: {
        x: child.scale.x,
        y: child.scale.y,
        z: child.scale.z
      },
      color: child.userData.color
    });
  });

  return roomState;
}

// Function to load a saved room state
function loadRoomState(roomState) {
  // Remove all existing objects from the scene
  const objectsToRemove = [];
  objects.forEach(obj => {
    scene.remove(obj);
    obj.geometry.dispose();
    obj.material.dispose();
    objectsToRemove.push(obj);
  });
  
  // Clear objects array
  objects.length = 0;
  objectData.length = 0;

  // Recreate objects from saved state
  roomState.objects.forEach(objData => {
    let geometry;

    switch(objData.type) {
      case 'cube':
        geometry = new THREE.BoxGeometry(5, 5, 5);
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(3, 16, 16);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(3, 3, 6, 16);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(3, 6, 16);
        break;
      default:
        geometry = new THREE.BoxGeometry(5, 5, 5);
    }

    const material = new THREE.MeshLambertMaterial({ 
      color: objData.color,
      flatShading: true
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(objData.position.x, objData.position.y, objData.position.z);
    mesh.rotation.set(objData.rotation.x, objData.rotation.y, objData.rotation.z);
    mesh.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);

    mesh.userData.isGameObject = true;
    mesh.userData.type = objData.type;
    mesh.userData.color = objData.color;
    mesh.userData.name = objData.type;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    objects.push(mesh);
    scene.add(mesh);
    
    // Recreate object data
    objectData.push({
      name: objData.type,
      seller: getRandomSellerName(),
      rating: getRandomRating(),
      price: getRandomPrice(),
      phone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      email: `user${Math.floor(Math.random() * 10000)}@example.com`
    });
  });
  
  // Update items panel
  createItemsPanel();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Block-style: no rotation, objects stay in place
    // Objects remain static for block-style appearance
    
    renderer.render(scene, camera);
}

animate();
