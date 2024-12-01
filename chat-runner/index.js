const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const axios = require("axios")
const io = require("socket.io-client");

let mainWindow;
const socket = io("http://localhost:5000")

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // to play media
    },
    autoHideMenuBar: true,
  });
  socket.on('connect', () => {
    console.log('Connected to the Socket.IO server');
  });

  socket.on('room list updated', (updatedRooms) => {
    mainWindow.webContents.send('room-list-updated', updatedRooms);
  });

  ipcMain.handle('fetch-rooms', async () => {
    try {
      const response = await axios.get('http://localhost:5000/rooms'); // Fetch the rooms from your API
      return response.data.rooms; // Return the list of rooms to the renderer
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  });

  socket.on('chat message', (message) => {
    mainWindow.webContents.send('chat-message', message);
  });

  socket.on('room message', (message) => {
    mainWindow.webContents.send('room-message', message);
  });
  mainWindow.loadURL('http://localhost:3000');
}

app.on('ready', createWindow);

ipcMain.handle('upload-files', async (event, fileData) => {
  const userDataPath = app.getPath('userData');
  const audioPath = path.join(userDataPath, 'audioFiles');

  if (!Array.isArray(fileData) || fileData.length === 0) {
    throw new Error('No file data provided.');
  }

  if (!fs.existsSync(audioPath)) {
    fs.mkdirSync(audioPath, { recursive: true });
  }

  try {
    fileData.forEach(({ name, buffer }) => {
      const destPath = path.join(audioPath, name);
      fs.writeFileSync(destPath, buffer); // Write the buffer to the file
    });
    return 'Upload successful';
  } catch (error) {
    throw new Error(`Failed to upload files: ${error.message}`);
  }
});

ipcMain.on('send-message', (event, message) => {
  socket.emit('chat message', message); // Send message to Socket.IO server
});

ipcMain.on('create-room', (event, { username, roomName }) => {
  socket.emit('create room', roomName); // Send the create room event to the server
  socket.emit('join room', { username, room: roomName }); // Use the provided username to join the room
});

ipcMain.on('leave-room', (event, { username, room }) => {
  socket.emit('leave room', { username, room }); // Emit "leave room" event to the server
});

ipcMain.on('join-room', (event, { username, room }) => {
  socket.emit('join room', { username, room });
});

ipcMain.handle('delete-file', async (event, filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }

  try {
    fs.unlinkSync(filePath);
    return 'File deleted successfully';
  } catch (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
});

ipcMain.on('send-image', (event, { buffer, room, username, fileName }) => {
  const userDataPath = app.getPath('userData');
  const imagePath = path.join(userDataPath, 'images', fileName);

  if (!fs.existsSync(path.dirname(imagePath))) {
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  }

  fs.writeFile(imagePath, Buffer.from(buffer), (err) => {
    if (err) {
      console.error('Failed to save image:', err);
    } else {
      const base64Image = fs.readFileSync(imagePath, 'base64');
      socket.emit('room message', { room, user: username, image: base64Image });
    }
  });
});

ipcMain.on('get-user-data-path', (event) => {
  event.returnValue = app.getPath('userData');
});
