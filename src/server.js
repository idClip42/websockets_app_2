const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

let index = fs.readFileSync(`${__dirname}/../client/index.html`);

const onRequest = (request, response) => {
  // Reloads web page on each request to preserve developer sanity
  index = fs.readFileSync(`${__dirname}/../client/index.html`);

  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1: ${port}`);

const io = socketio(app);

io.sockets.on('connection', (socket) => {
  console.log('connected');

  // When an answer is recieved from the client, it puts it in the answers array
  socket.on('update', (data) => {

  });

  // When the game is joined, puts user in a room and acts depending on current game state
  socket.on('joinGame', () => {
    socket.join('room1');
  });
});


console.log('Websocket server started');


// / Checks collisions between two circles, with given points and radii
const checkCollision = (p1, r1, p2, r2) => {

};
