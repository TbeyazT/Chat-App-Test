const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development, customize as needed
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json()); // For handling JSON in REST API requests

// In-memory storage for users and rooms
const users = {};
const rooms = {};
const roomDeletionTimers = {}; // To track timers for room deletion

// Grace period before deleting an empty room (in milliseconds)
const ROOM_DELETION_GRACE_PERIOD = 5000; // 5 seconds

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining a room
  socket.on('join room', ({ username, room }) => {
    if (roomDeletionTimers[room]) {
      clearTimeout(roomDeletionTimers[room]);
      delete roomDeletionTimers[room];
    }

    socket.join(room);

    if (!rooms[room]) rooms[room] = [];
    rooms[room].push({ id: socket.id, username });

    users[socket.id] = { username, room };

    console.log(`${username} joined room: ${room}`);
    
    io.to(room).emit('room message', {
      user: 'System',
      message: `${username} has joined the room.`,
    });

    io.emit('room list updated', Object.keys(rooms));
  });

  // Handle user leaving a room
  socket.on('leave room', ({ username, room }) => {
    if (rooms[room]) {
      rooms[room] = rooms[room].filter((u) => u.id !== socket.id);
      delete users[socket.id];

      console.log(`${username} left room: ${room}`);

      socket.leave(room);

      io.to(room).emit('room message', {
        user: 'System',
        message: `${username} has left the room.`,
      });

      if (rooms[room].length === 0) {
        roomDeletionTimers[room] = setTimeout(() => {
          if (rooms[room].length === 0) {
            delete rooms[room];
            console.log(`Room ${room} deleted after grace period`);
            io.emit('room list updated', Object.keys(rooms));
          }
        }, ROOM_DELETION_GRACE_PERIOD);
      }

      io.emit('room list updated', Object.keys(rooms));
    }
  });

  // Handle chat message in a room
  socket.on('chat message', (msg) => {
    const user = users[socket.id];
    if (user && user.room) {
      io.to(user.room).emit('chat message', {
        user: user.username, // Use the actual username
        message: msg,
      });
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      const room = user.room;
      // Remove user from room
      rooms[room] = rooms[room].filter((u) => u.id !== socket.id);
      delete users[socket.id];

      console.log(`${user.username} disconnected from room: ${room}`);

      // Notify others in the room that the user has left
      io.to(room).emit('room message', {
        user: 'System',
        message: `${user.username} has left the room.`,
      });

      // If the room is empty, start a timer to delete the room
      if (rooms[room].length === 0) {
        roomDeletionTimers[room] = setTimeout(() => {
          if (rooms[room] && rooms[room].length === 0) {
            delete rooms[room];
            console.log(`Room ${room} deleted after grace period`);
            // Notify all clients about the updated room list
            io.emit('room list updated', Object.keys(rooms));
          }
        }, ROOM_DELETION_GRACE_PERIOD);
      }

      // Notify all clients about the updated room list
      io.emit('room list updated', Object.keys(rooms));
    }
  });
});

// REST API Endpoints (Optional)

// Get list of users in a room
app.get('/rooms/:room/users', (req, res) => {
  const room = req.params.room;
  if (rooms[room]) {
    res.json(rooms[room]);
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

// Get list of all rooms
app.get('/rooms', (req, res) => {
  res.json({ rooms: Object.keys(rooms) });
});

// Delete room manually via REST API
app.delete('/rooms/:room', (req, res) => {
  const room = req.params.room;
  if (rooms[room]) {
    delete rooms[room];
    io.emit('room list updated', Object.keys(rooms)); // Notify clients about the room deletion
    res.json({ success: `Room '${room}' has been deleted.` });
    console.log(`Room '${room}' was deleted manually via API.`);
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

// Root route (optional)
app.get('/', (req, res) => {
  res.send('Chat API is running');
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
