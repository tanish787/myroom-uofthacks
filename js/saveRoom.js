const saveRoomModal = document.getElementById('saveRoomModal');
const saveRoomBtn = document.getElementById('saveRoomBtn');
const closeSaveBtn = document.querySelector('.close-save');
const roomNameInput = document.getElementById('roomNameInput');
const saveMessage = document.getElementById('saveMessage');

let pendingRoomState = null;

// Open save room modal
if (saveRoomBtn) {
  saveRoomBtn.onclick = () => {
    if (!authManager.isLoggedIn()) {
      alert('Please log in to save your room');
      window.location.href = 'auth.html';
      return;
    }

    // Capture the current room state
    pendingRoomState = getCurrentRoomState();
    roomNameInput.value = '';
    saveMessage.textContent = '';
    saveRoomModal.style.display = 'block';
  };
}

// Close modal
if (closeSaveBtn) {
  closeSaveBtn.onclick = () => {
    saveRoomModal.style.display = 'none';
  };
}

// Close when clicking outside
window.onclick = (event) => {
  if (event.target === saveRoomModal) {
    saveRoomModal.style.display = 'none';
  }
};

// Confirm save room
async function confirmSaveRoom() {
  const roomName = roomNameInput.value.trim();
  
  if (!roomName) {
    saveMessage.textContent = 'Please enter a room name';
    saveMessage.className = 'error';
    return;
  }

  if (!pendingRoomState) {
    saveMessage.textContent = 'Error: Could not capture room state';
    saveMessage.className = 'error';
    return;
  }

  saveMessage.textContent = 'Saving...';
  saveMessage.className = '';

  const result = await authManager.saveRoom(roomName, pendingRoomState);
  
  if (result.success) {
    saveMessage.textContent = `Room "${roomName}" saved successfully!`;
    saveMessage.className = 'success';
    
    setTimeout(() => {
      saveRoomModal.style.display = 'none';
      pendingRoomState = null;
    }, 1500);
  } else {
    saveMessage.textContent = result.message || 'Error saving room';
    saveMessage.className = 'error';
  }
}

// Cancel save room
function cancelSaveRoom() {
  saveRoomModal.style.display = 'none';
  pendingRoomState = null;
}

// Load a saved room from account modal
async function loadSavedRoom(roomName) {
  if (!authManager.isLoggedIn()) {
    alert('Please log in to load rooms');
    return;
  }

  const profile = await authManager.getUserProfile();
  const savedRoom = profile.savedRooms.find(room => room.roomName === roomName);

  if (savedRoom) {
    loadRoomState(savedRoom.roomData);
    alert(`Loaded room: ${roomName}`);
    document.getElementById('accountModal').style.display = 'none';
  } else {
    alert('Room not found');
  }
}