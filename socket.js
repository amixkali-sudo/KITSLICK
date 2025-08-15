// socket.js - Socket.IO setup and event handling
const { Server } = require('socket.io');

let io;

// Initialize Socket.IO with the HTTP server
function initSocket(server) {
    io = new Server(server, {
        cors: {
            origin: '*', // In production, replace with your frontend URL
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        console.log('A user connected');

        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });

    return io;
}

// Emit a new snap to all connected clients
function emitNewSnap(snapData) {
    if (io) {
        io.emit('new_snap', snapData);
    }
}

module.exports = {
    initSocket,
    emitNewSnap
};
