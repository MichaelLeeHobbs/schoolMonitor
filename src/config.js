const dotenv = require('dotenv')
dotenv.config()
module.exports = {
    TRELLO_KEY: process.env.TRELLO_KEY,
    TRELLO_TOKEN: process.env.TRELLO_TOKEN,
    TRELLO_BOARD: process.env.TRELLO_BOARD,
}
