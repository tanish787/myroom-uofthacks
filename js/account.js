const modal = document.getElementById('accountModal');
const accountBtn = document.getElementById('accountBtn');
const closeBtn = document.querySelector('.close');

// Open account modal
if (accountBtn) {
  accountBtn.onclick = async () => {
    modal.style.display = 'block';
    if (authManager.isLoggedIn()) {
      await loadUserProfile();
    } else {
      document.getElementById('notLoggedIn').style.display = 'block';
      document.getElementById('loggedInContent').style.display = 'none';
    }
  };
}

// Close modal
if (closeBtn) {
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };
}

// Close when clicking outside
window.onclick = (event) => {
  if (event.target === modal) {
    modal.style.display = 'none';
  }
};

// Load user profile
async function loadUserProfile() {
  const profile = await authManager.getUserProfile();
  if (profile) {
    document.getElementById('notLoggedIn').style.display = 'none';
    document.getElementById('loggedInContent').style.display = 'block';
    document.getElementById('profileFullName').textContent = profile.fullName;
    document.getElementById('profileEmail').textContent = profile.email;
    document.getElementById('profilePhone').textContent = profile.phone;
    
    displaySavedRooms(profile.savedRooms);
    displayListedItems(profile.listedItems);
  }
}

function displaySavedRooms(rooms) {
  const roomsList = document.getElementById('savedRoomsList');
  roomsList.innerHTML = '';
  if (rooms.length === 0) {
    roomsList.innerHTML = '<p>No saved rooms yet</p>';
    return;
  }
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = 'room-item';
    div.innerHTML = `
      <strong>${room.roomName}</strong>
      <p>${new Date(room.savedAt).toLocaleDateString()}</p>
      <button onclick="loadSavedRoom('${room.roomName}')" class="load-room-btn">Load Room</button>
    `;
    roomsList.appendChild(div);
  });
}

function displayListedItems(items) {
  const itemsList = document.getElementById('listedItemsList');
  itemsList.innerHTML = '';
  if (items.length === 0) {
    itemsList.innerHTML = '<p>No items listed yet</p>';
    return;
  }
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `
      <img src="http://localhost:5000${item.itemImage}" alt="${item.itemName}" style="width:100px;">
      <h4>${item.itemName}</h4>
      <p>${item.itemDescription}</p>
      <p><strong>$${item.itemPrice}</strong></p>
    `;
    itemsList.appendChild(div);
  });
}

function openTab(event, tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');
}

async function handleItemUpload() {
  const itemName = document.getElementById('itemName').value;
  const itemPrice = document.getElementById('itemPrice').value;
  const itemDescription = document.getElementById('itemDescription').value;
  const itemImage = document.getElementById('itemImage').files[0];

  if (!itemName || !itemPrice || !itemImage) {
    alert('Please fill in all required fields');
    return;
  }

  const result = await authManager.uploadItem(itemName, itemPrice, itemDescription, itemImage);
  alert(result.message);
  
  if (result.success) {
    document.getElementById('itemName').value = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemDescription').value = '';
    document.getElementById('itemImage').value = '';
    await loadUserProfile();
  }
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    authManager.logout();
    location.reload();
  }
}