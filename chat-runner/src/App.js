import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const { ipcRenderer } = window.require('electron');

function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState('');
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [usernameSet, setUsernameSet] = useState(false);

  const chatBoxRef = useRef(null);

  useEffect(() => {
    const fetchRooms = async () => {
      const roomList = await ipcRenderer.invoke('fetch-rooms');
      setRooms(roomList);
    };

    fetchRooms();

    ipcRenderer.on('chat-message', (event, msg) => {
      setMessages((prevMessages) => [...prevMessages, `${msg.user}: ${msg.message}`]);
    });

    ipcRenderer.on('room-message', (event, msg) => {
      setMessages((prevMessages) => [...prevMessages, `* ${msg.user}: ${msg.message}`]);
    });

    ipcRenderer.on('room-list-updated', (event, updatedRooms) => {
      setRooms(updatedRooms);
    });

    return () => {
      ipcRenderer.removeAllListeners('chat-message');
      ipcRenderer.removeAllListeners('room-message');
      ipcRenderer.removeAllListeners('room-list-updated');
    };
  }, []);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [messages]);

  const setUsernameHandler = (e) => {
    e.preventDefault();
    if (username) {
      setUsernameSet(true);
    }
  };

  const createRoom = (e) => {
    e.preventDefault();
    if (newRoomName && username) {
      ipcRenderer.send('create-room', { username, roomName: newRoomName });
      setRoom(newRoomName);
      setJoined(true);
      setNewRoomName('');
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (room && username) {
      ipcRenderer.send('join-room', { username, room });
      setJoined(true);
    }
  };

  const leaveRoom = () => {
    if (room && username) {
      ipcRenderer.send('leave-room', { username, room });
        setJoined(false);
        setRoom('');
        setMessage('');
        setMessages([]);
    }
  };  

  const sendMessage = (e) => {
    e.preventDefault();
    if (message) {
      ipcRenderer.send('send-message', message);
      setMessage('');
    }
  };

  return (
    <div className="container">
      {!usernameSet ? (
        <form onSubmit={setUsernameHandler} className="form">
          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="input"
          />
          <button type="submit" className="button">✔</button>
        </form>
      ) : !joined ? (
        <>
          <h3>Available Rooms</h3>
          <ul className="room-list">
            {rooms.length > 0 ? (
              rooms.map((roomName, index) => (
                <li key={index} className="room-list-item">
                  <button onClick={() => setRoom(roomName)}>{roomName}</button>
                </li>
              ))
            ) : (
              <li>No rooms available</li>
            )}
          </ul>

          <form onSubmit={joinRoom} className="form">
            <button type="submit" className="button" disabled={!room}>Join Selected Room</button>
          </form>

          <form onSubmit={createRoom} className="form">
            <input
              type="text"
              placeholder="Create new room"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              required
              className="input"
            />
            <button type="submit" className="button">+</button>
          </form>
        </>
      ) : (
        <>
          <h2>Room: {room}</h2>
          <button onClick={leaveRoom} className="button">⬅</button>
          <div className="chat-box" ref={chatBoxRef}>
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.user === username ? 'sent' : 'received'}`}>
                {msg}
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="message-input">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              required
              className="input"
            />
            <button type="submit" className="button">➤</button>
          </form>
        </>
      )}
    </div>
  );
}

export default App;
