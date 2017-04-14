

/*


    SERVER AND PAGE REQUESTS


*/


const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');
const url = require('url');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

// File imports
let index = fs.readFileSync(`${__dirname}/../client/index.html`);
const barry = fs.readFileSync(`${__dirname}/../client/images/barasketball.png`);
const hand = fs.readFileSync(`${__dirname}/../client/images/hand.png`);
const nic = fs.readFileSync(`${__dirname}/../client/images/nic.png`);
const arena = fs.readFileSync(`${__dirname}/../client/images/coliseum.jpg`);


// Returns page and images on request
const onRequest = (request, response) => {
  const parsedUrl = url.parse(request.url);

  console.log(`Requested: ${request.url}`);

  let data;
  let type;

  switch (parsedUrl.pathname) {
    case '/barry':
      data = barry;
      type = 'image/png';
      break;
    case '/hand':
      data = hand;
      type = 'image/png';
      break;
    case '/nic':
      data = nic;
      type = 'image/png';
      break;
    case '/arena':
      data = arena;
      type = 'image/jpeg';
      break;
    default:
      // Imports index each time so I don't have to restart server for html changes
      index = fs.readFileSync(`${__dirname}/../client/index.html`);
      data = index;
      type = 'text/html';
  }

  response.writeHead(200, { 'Content-Type': type });
  response.write(data);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1: ${port}`);


/*


    VARIABLES AND CONSTRUCTORS


*/


// The constructor function for objects in the game
const objMaker = (x, y, r, m, a, c) => Object.seal({
  x,
  y,
  radius: r,
  xSpeed: 0,
  ySpeed: 0,
  xAccel: 0,
  yAccel: a,
  drag: 0.5,
  mass: m,
  target: undefined,
  color: c,
});

// Canvas width and height
const WIDTH = 800;
const HEIGHT = 600;

// Players currently in the game - contains objects defined by objMaker
const players = {};

// The ball object
const ball = objMaker(
  WIDTH / 2,
  0,
  30,
  8,
  300,
  'orange');

// The "framerate" - updates 60 times a second
const frameTime = 1000 / 60;

// How many players on each team
const teamCount = [0, 0];

// The score for each team
const teamScore = [0, 0];


/*


    HELPERS


*/


// Gets a random color, but tinted blue if team1 and tinted red if team2
const getRandomColor = (team1) => {
  const r = (team1 === false) ? Math.floor(Math.random() * 100) + 155 : 0;
  const g = Math.floor(Math.random() * 100);
  const b = (team1 === true) ? Math.floor(Math.random() * 100) + 155 : 0;

  const string = `rgb(${r}, ${g},${b})`;

  return string;
};

const square = value => value * value;


/*


    SOCKETS


*/


const io = socketio(app);

io.sockets.on('connection', (socket) => {
  console.log('connected');

  // Upon recieving update from player, update player motion
  socket.on('update', (data) => {
    const obj = players[socket.id];
    if (!obj) return;
    obj.target = data;
  });

  // When the game is joined, puts user in a room and creates player object
  socket.on('joinGame', () => {
    socket.join('room1');

    const team = (teamCount[0] > teamCount[1]) ? 1 : 0;
    teamCount[team] += 1;

    players[socket.id] = objMaker(
      WIDTH / 2,
      HEIGHT,
      30,
      1,
      0,
      getRandomColor(team === 0));
    players[socket.id].team = team;
  });

  // On disconnect, removes player from players list and lowers their team member count
  socket.on('disconnect', () => {
    if (players[socket.id]) { teamCount[players[socket.id].team] -= 1; }
    delete players[socket.id];
    io.sockets.emit('delete', socket.id);
  });
});


console.log('Websocket server started');


/*


    PHYSICS


*/

// Moves ball to position at top middle
const respawnBall = () => {
  ball.y = 0;
  ball.x = WIDTH / 2;
  ball.xSpeed = 0;
  ball.ySpeed = 0;
};


// Checks collisions between two circle objects
const checkCollision = (obj1, obj2) => {
  // Makes sure a and b exist
  if (!obj1 || !obj2) return false;

  // Filters out colliders too far from each other to simplify calculations
  const maxDist = Math.max(obj1.radius, obj2.radius) * 2;
  if (Math.abs(obj1.x - obj2.x) > maxDist) return false;
  if (Math.abs(obj1.y - obj2.y) > maxDist) return false;

  // Checks distance between centers with squared values
  const distSqr = square(obj2.x - obj1.x) + square(obj2.y - obj1.y);
  const radiiSum = obj1.radius + obj2.radius;
  if (distSqr < square(radiiSum)) return true;
  return false;
};

// Checks if the ball collides with anything
// Players can knock it around
// Hitting the small spot inside the basket scores a point and resets everything
const ballCollisions = () => {
  const keys = Object.keys(players);
  for (let n = 0; n < keys.length; n += 1) {
    const p = players[keys[n]];
    if (checkCollision(ball, p) === true) {
      ball.xSpeed = ((ball.xSpeed * ball.mass) + (p.xSpeed * p.mass)) / ball.mass;
      ball.ySpeed = ((ball.ySpeed * ball.mass) + (p.ySpeed * p.mass)) / ball.mass;

      const pythag = Math.sqrt(square(ball.x - p.x) + square(ball.y - p.y));
      ball.x = p.x + (((ball.x - p.x) / pythag) * (p.radius + ball.radius));
      ball.y = p.y + (((ball.y - p.y) / pythag) * (p.radius + ball.radius));
    }
  }
  if (checkCollision(ball, players.redBasket) === true) {
    teamScore[1] += 1;
    respawnBall();
  }
  if (checkCollision(ball, players.blueBasket) === true) {
    teamScore[0] += 1;
    respawnBall();
  }
};

// Applies physics
// If there's a target, moves towards it
// Adds acceleration and drag to speed, and adds speed to position
// The ball has gravity applied to it, which might be the only use of acceleration here
const applyPhysics = (object) => {
  const obj = object;
  if (obj.target) {
    obj.xSpeed = (obj.target.x - obj.x) * 10;
    obj.ySpeed = (obj.target.y - obj.y) * 10;
  }

  obj.xSpeed += obj.xAccel * (frameTime / 1000);
  obj.xSpeed -= obj.xSpeed * obj.drag * (frameTime / 1000);

  obj.ySpeed += obj.yAccel * (frameTime / 1000);
  obj.ySpeed -= obj.ySpeed * obj.drag * (frameTime / 1000);

  obj.x += obj.xSpeed * (frameTime / 1000);
  obj.y += obj.ySpeed * (frameTime / 1000);
};

// Keeps the ball in boundaries
// Moving out of bounds on the left, right, or top
//  reverses the velocity in that direction so it looks like a bounce
// Moving out of bounds on the bottom resets the ball
const ballBoundaries = () => {
  if (ball.y > HEIGHT) { respawnBall(); }

  if ((ball.x < 0 && ball.xSpeed < 0) || (ball.x > WIDTH && ball.xSpeed > 0)) { ball.xSpeed *= -1; }
  if (ball.y < 0 && ball.ySpeed < 0) { ball.ySpeed *= -1; }
};


// Deals with physics
// Manages ball collisions with players, baskets, etc
// Moves players around, towards their targets (the corresponding mouse location)
// Keeps the ball onscreen
const doPhysics = () => {
  ballCollisions();
  applyPhysics(ball);

  const keys = Object.keys(players);
  for (let n = 0; n < keys.length; n += 1) {
    applyPhysics(players[keys[n]]);
  }

  ballBoundaries();
};


/*


    RUNNING THE GAME


*/


// Adds objects to players array that serve as baskets for the game,
// along with the invisible objects that the ball must hit inside the basket to gain a point
const addBaskets = () => {
  let topLeftX = 30;
  const topLeftY = 300;
  const rad = 10;
  const width = 100;
  let color = 'blue';
  players.basket1 = objMaker(topLeftX, topLeftY, rad, 10, 0, color);
  players.basket2 = objMaker(topLeftX, topLeftY + (rad * 4), rad, 10, 0, color);
  players.basket3 = objMaker(topLeftX + width, topLeftY, rad, 10, 0, color);
  players.basket4 = objMaker(topLeftX + width, topLeftY + (rad * 4), rad, 10, 0, color);
  players.basket5 = objMaker(topLeftX, topLeftY + (rad * 8), rad, 10, 0, color);
  players.basket6 = objMaker(topLeftX + width, topLeftY + (rad * 8), rad, 10, 0, color);
  players.basket7 = objMaker(topLeftX, topLeftY + (rad * 12), rad, 10, 0, color);
  players.basket8 = objMaker(topLeftX + width, topLeftY + (rad * 12), rad, 10, 0, color);
  players.basket9 = objMaker(topLeftX + (width / 2), topLeftY + (rad * 12),
    width / 3, 10, 0, color);
  players.redBasket = objMaker(topLeftX + (width / 2), topLeftY + (rad * 8),
    5, 10, 0, 'rgba(0,0,0,0)');

  topLeftX = 670;
  color = 'red';
  players.basket11 = objMaker(topLeftX, topLeftY, rad, 10, 0, color);
  players.basket12 = objMaker(topLeftX, topLeftY + (rad * 4), rad, 10, 0, color);
  players.basket13 = objMaker(topLeftX + width, topLeftY, rad, 10, 0, color);
  players.basket14 = objMaker(topLeftX + width, topLeftY + (rad * 4), rad, 10, 0, color);
  players.basket15 = objMaker(topLeftX, topLeftY + (rad * 8), rad, 10, 0, color);
  players.basket16 = objMaker(topLeftX + width, topLeftY + (rad * 8), rad, 10, 0, color);
  players.basket17 = objMaker(topLeftX, topLeftY + (rad * 12), rad, 10, 0, color);
  players.basket18 = objMaker(topLeftX + width, topLeftY + (rad * 12), rad, 10, 0, color);
  players.basket19 = objMaker(topLeftX + (width / 2), topLeftY + (rad * 12),
    width / 3, 10, 0, color);
  players.blueBasket = objMaker(topLeftX + (width / 2), topLeftY + (rad * 8), 5, 10, 0, 'rgba(0,0,0,0)');
};
addBaskets();


// Runs the game loop every time interval
// Applies physics and sends out newly updated positions for everything
const gameLoop = () => {
  doPhysics();
  const obj = {
    ball,
    players,
    teamScore,
  };
  io.sockets.emit('update', obj);
};
setInterval(gameLoop, frameTime);

