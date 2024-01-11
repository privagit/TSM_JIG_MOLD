require("dotenv").config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3003;
const CORS_URL = process.env.CORS_URL;
const cors = require('cors');
const morgan = require("morgan");

app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({extended: false}));
app.use(express.json()); //body-parser for get
app.use(morgan('dev'));
app.use(cors({
    origin: CORS_URL, // Replace with the actual URL of your main server
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
})

const swaggerUI = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

let indexRouter = require('./routes/index');
app.use('/api', indexRouter);

//* MOLD ROUTES
let moldSettingRouter = require('./routes/mold/setting');
app.use('/mold/setting', moldSettingRouter);

//* JIG ROUTES
let jigSettingRouter = require('./routes/jig/setting');
app.use('/jig/setting', jigSettingRouter);

// Swagger definition
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Documentation',
            version: '1.0.0',
            description: 'A simple API Documentation'
        },
        servers: [
            {
                url: 'http://localhost:3003',
            },
        ],
    },
    apis: ['./routes/*.js', './routes/jig/*.js', './routes/mold/*.js']
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));

app.all('*', (req, res) => {
    res.status(404).send('<h1>resource not found</h1>')
})

let server = app.listen(PORT, () => {
    let date = new Date()
    console.log(`Listening on port ${PORT}... ${date}`);
})

const io = require('socket.io')(server, {
    cors: CORS_URL
});
app.set('socketio', io);

module.exports = app;