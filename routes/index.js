const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
    res.status(200).send({ message: 'JIG & MOLD Server works fine' });
})

module.exports = router;