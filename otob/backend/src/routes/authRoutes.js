const express = require('express');
const { login, logout } = require('../controllers/authController');
const { refreshToken } = require('../controllers/refreshToken');
const {createUser} = require("../controllers/userController");

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.post('/register', createUser);
module.exports = router;
