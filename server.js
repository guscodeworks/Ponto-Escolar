require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

app.use(cors());

app.use(express.json({limit: '6mb'}));
app.use(express.urlencoded({extended: true, limit: '6mb'}));

app.use(express.static(path.join(__dirname, "views")));
app.use(express.static(path.join(__dirname, "public")));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json({limit: '6mb'}));


const port = process.env.PORT;
app.listen(port, () => {
    console.log(`Servidor rodando na ${port}`)
});

