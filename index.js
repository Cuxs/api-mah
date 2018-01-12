require('dotenv').config();

const express = require('express');
const Graphql = require('graphql').graphql;
const jwt = require('express-jwt');
const bodyParser = require('body-parser');

const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');

/* const socketioJwt = require('socketio-jwt'); */
const cors = require('cors');
const schema = require('./schema');
const {
  login, createPublication, uploadAgencyImages, getFiltersAndTotalResult,
} = require('./routes');
const multer = require('multer');

const { execute, subscribe } = require('graphql');
const { createServer } = require('http');
const { SubscriptionServer } = require('subscriptions-transport-ws');

const upload = multer({ dest: './images' });
const app = express();

// SERVER CONFIGURATION ----------------------------------------------
app.use(cors());
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.use('/graphql', bodyParser.json(), graphqlExpress({ schema }));
app.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
  subscriptionsEndpoint: 'ws://localhost:4000/subscriptions',
}));

const ws = createServer(app);

// Set up the WebSocket for handling GraphQL subscriptions
app.listen(process.env.PORT || 4000, () => {
  console.log(`Running a GraphQL API server at http://localhost:${process.env.PORT || 4000}/graphiql`);

  SubscriptionServer.create({
    execute,
    subscribe,
    schema,
  }, {
    server: ws,
    path: '/subscriptions',
  });
});


const httpGraphQLHandler = (req, res) => {
  const { query, variables, rootVals } = req.query;
  const authToken = req.user || {};
  return Graphql(schema, query, { authToken, rootVals }, variables)
    .then(result => res.send(result))
    .catch(err => console.log(err));
};
app.post('/', httpGraphQLHandler);
app.use('/images', express.static(`${__dirname}/images`));

app.use(jwt({ secret: 'MAH2018!#' }).unless({
  path: [
    '/subscriptions',
    '/graphql',
    '/login',
    '/getFiltersAndTotalResult',
    /^\/images/,
  ],
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

/* console.log(schema.getSubscriptionType().getFields().messageAdded) */

// ===================================================================

// SOCKETS ------------------------------------------------------------
/* const socketServer = require('http').createServer(app);
const io = require('socket.io')(socketServer);

socketServer.listen(process.env.PORT || 4100);

io.use((socket, next) => {
  const handShake = socket.handshake;
  const { token } = handShake.query;
  if (jsonwt.verify(token, 'MAH2018!#')) {
    next();
  }
  next(new Error('No autorizado'));
});

io.of('/offerChat').on('connection', (socket) => {
  const id = socket.handshake.query.offerId;
  const sockets = {};
  if (id !== '') {
    sockets[id] = socket;
  }
  socket.on('sellerTyping', () => {
    socket.broadcast.emit('sellerTyping');
  });
  socket.on('sellerStopTyping', () => {
    socket.broadcast.emit('sellerStopTyping');
  });
  socket.on('buyerTyping', () => {
    socket.broadcast.emit('buyerTyping');
  });
  socket.on('buyerStopTyping', () => {
    socket.broadcast.emit('buyerStopTyping');
  }); */

/*   socket.on('newMessage', (data) => {
    createMessage(data.id_from, data.id_to, data.messageThread_id, data.content)
      .then((res) => {
        socket.emit('messageCreated', res);
        socket.broadcast.emit('messageCreated', res);
      });
  });
});
*/
// ===================================================================

// ROUTES --------------------------------------------------------------
app.post('/login', login);
app.post('/createPublication', upload.array('imageGroup', 8), createPublication);
app.post('/getFiltersAndTotalResult', getFiltersAndTotalResult);
app.post('/uploadAgencyImages/:id', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), uploadAgencyImages);
// ===================================================================

