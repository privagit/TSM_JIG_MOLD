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
    origin: JSON.parse(CORS_URL), // Replace with the actual URL of your main server
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

//* JIG ROUTES
let jigSettingRouter = require('./routes/jig/setting');
let jigSparepartRouter = require('./routes/jig/sparepart');
let jigRepairRouter = require('./routes/jig/repair');
let jigCreationRouter = require('./routes/jig/creation');
let jigOverviewRouter = require('./routes/jig/overview');
let jigDashboardRouter = require('./routes/jig/dashboad');
app.use('/jig/setting', jigSettingRouter);
app.use('/jig/sparepart', jigSparepartRouter);
app.use('/jig/repair', jigRepairRouter);
app.use('/jig/creation', jigCreationRouter);
app.use('/jig/overview', jigOverviewRouter);
app.use('/jig/dashboard', jigDashboardRouter);

//* MOLD ROUTES
let moldSettingRouter = require('./routes/mold/setting');
let moldSparepartRouter = require('./routes/mold/sparepart');
let moldRepairRouter = require('./routes/mold/repair'); //TODO
app.use('/mold/setting', moldSettingRouter);
app.use('/mold/sparepart', moldSparepartRouter);
app.use('/mold/repair', moldRepairRouter);


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
    apis: ['./routes/jig/*.js']
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
    cors: JSON.parse(CORS_URL)
});
app.set('socketio', io);

module.exports = app;