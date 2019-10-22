const CronJob = require('cron').CronJob
const fetch = require('node-fetch')
const cheerio = require('cheerio')
const moment = require('moment')
const Trello = require("trello");
const {TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD} = require('./config')
let trello = new Trello(TRELLO_KEY, TRELLO_TOKEN);

const TRELLO_BOARD_ID = TRELLO_BOARD

const CALENDAR_URL = 'https://app.oncoursesystems.com/school/homework/:id?date=:date'
const HOMEPAGE_URL = 'https://app.oncoursesystems.com/school/webpage/:id'

const CLASSES = [
    // {name: 'Math - Mr. Thomson', homepageId: '11093960/937461', label: '7th Math', calendar: {id: 462891, header: 'body > div.navbar.navbar-inverse > div > div.navbar-header > span', body: 'body > div.container-fluid > div > div > ul'}},
    {name: 'Math - MR. CASEY', homepageId: '466786/429072', label: '7th Math', calendar: {id: 466786, header: 'body > div.navbar.navbar-inverse > div > div.navbar-header > span', body: 'body > div.container-fluid > div > div > ul'}},
    {name: 'English Language Arts', homepageId: '11093960/937461', label: 'English Language Arts'},
    {name: 'French', homepageId: '10869005/740325', label: 'French', calendar: {id: 10869005, header: 'body > div.navbar.navbar-inverse > div > div.navbar-header > span', body: 'body > div.container-fluid > div > div > ul'}},
    {
        name: 'Social Studies',
        homepageId: '497334/498920',
        label: 'Social Studies',
        calendar: {id: 497334, header: 'body > div.navbar.navbar-inverse > div > div.navbar-header > span', body: 'body > div.container-fluid > div > div > ul', filters: ['HOMEWORK', 'TB 1, 3, 4, 6:', 'E Group TB 7:']}
    },
    {name: 'Science', homepageId: '12562654/1183282', label: 'Science', calendar: {id: 12562654, header: 'body > div.navbar.navbar-inverse > div > div.navbar-header > span', body: 'body > div.container-fluid > div > div > ul'}},
    {name: 'Technology', homepageId: '12805023/1269830', label: undefined},
    {name: 'Health & Physical Education', homepageId: '10707140/704157', label: undefined},
]

// trello.getListsOnBoard(TRELLO_BOARD_ID)
//     .then(console.log)
//     .catch(console.error)

const trelloTools = {
    getLabelByName: async ({boardId = TRELLO_BOARD_ID, name}) => (await trello.getLabelsForBoard(boardId)).find(label => label.name === name),
}

const getTrelloListByName = async (name) => {
    let lists = await trello.getListsOnBoard(TRELLO_BOARD_ID)
    let filtered = lists.filter(ele => ele.name === name)
    return filtered.pop().id
}

const updateHomework = async (classData, listId) => {
    if (!classData.calendar) return
    let homeWork = []
    let startDate = moment()
    let {id, header, body} = classData.calendar
    for (let i = 0; i < 7; i++) {
        let date = startDate.add(i, 'days').format('MM/DD/YYYY')
        let url = CALENDAR_URL.replace(':id', id).replace(':date', date)
        let res = await fetch(url)
        let $ = cheerio.load(await res.text())
        // let header = `${date} ${classData.name} ${$('body > div.container-fluid > div > div > ul > li > div.content > strong').text()}`
        let name = `${classData.name} ${$(header).text()}`
        // let body = $('body > div.container-fluid > div > div > ul > li > div.content > span').text()
        let desc = $(body).text().trim().split('\n').map(ele => ele.trim()).filter(ele => ele > '').join('\n')
        let filtered = desc
        if (classData.calendar && classData.calendar.filters) classData.calendar.filters.forEach(filter => filtered = filtered.replace(filter, '').trim())
        if (filtered > '' && desc > '') {
            desc = `${desc}\n\n${url}`
            homeWork.push({name, desc})
            upsertTrelloCard({name, desc, listId, dueDate: undefined, labelName: classData.label}).catch(console.error)
        }
    }

    console.log(JSON.stringify(homeWork, null, 2))

}

const getHomepage = async (data) => {
    let url = HOMEPAGE_URL.replace(':id', data.homepageId)
    let res = await fetch(url)
    let $ = cheerio.load(await res.text())
    return `${$('#contents > div.body-content').text().trim()}\n\n${url}`
}

const upsertTrelloCard = async ({name, desc, listId, dueDate, labelName}) => {
    // console.log(`upsertTrelloCard({name, desc, listId, dueDate}) : ${JSON.stringify({name, desc, listId, dueDate})}`)
    let cards = await trello.getCardsOnBoard(TRELLO_BOARD_ID)
    let card = cards.find(ele => ele.name === name)
    let updateLabel = await trelloTools.getLabelByName({name: '**UPDATED**'})
    let label = await trelloTools.getLabelByName({name: labelName})

    // need update
    if (card && card.desc !== desc) {
        // trello.updateCardDescription(cardId, description)
        await trello.updateCardDescription(card.id, desc).catch(console.error)
        await trello.addLabelToCard(card.id, updateLabel.id).catch(console.error)
        // trello.updateCardList(cardId, listId)
        await trello.updateCardList(card.id, listId).catch(console.error)
        if (label) await trello.addLabelToCard(card.id, label.id).catch(console.error)
        if (dueDate) await trello.addDueDateToCard(card.id).catch(console.error)
    }
    // need card
    if (!card) {
        card = await trello.addCard(name, desc, listId).catch(console.error)
        if (!card) return void console.error('FAILED TO CREATED CARD!', JSON.stringify({name, desc, listId, dueDate, label}))
        await trello.addLabelToCard(card.id, updateLabel.id).catch(console.error)
        if (label) await trello.addLabelToCard(card.id, label.id).catch(console.error)
        if (dueDate) await trello.addDueDateToCard(card.id).catch(console.error)
    }
}

const updateHomepage = async (classData, listId) => {
    let name = `${classData.name} HomePage`
    let desc = await getHomepage(classData)
    return upsertTrelloCard({name, desc, listId, labelName: classData.label})
}


const main = async () => {
    let isaiahTodoListId = await getTrelloListByName('Isaiah To Do')
    CLASSES.forEach(classData => {
        updateHomepage(classData, isaiahTodoListId).catch(console.error)
        updateHomework(classData, isaiahTodoListId).catch(console.error)
    })

}


// d7bc227118ce92e835ad23b964d7d1ae


// fetch('https://app.oncoursesystems.com/school/webpage/497334/498920')
//     .then(res=>res.body.text())
//     .then(console.log)
//     .catch(console.error)
// fetch("https://app.oncoursesystems.com/school/webpage/497334/498920", {"credentials":"include","headers":{"accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3","accept-language":"en-US,en;q=0.9","cache-control":"max-age=0","sec-ch-ua":"Google Chrome 76","sec-fetch-dest":"document","sec-fetch-mode":"navigate","sec-fetch-site":"none","sec-fetch-user":"?1","sec-origin-policy":"0","upgrade-insecure-requests":"1"},"referrer":"https://app.oncoursesystems.com/school/webpage/497334","referrerPolicy":"no-referrer-when-downgrade","body":null,"method":"GET","mode":"cors"})
// fetch("https://app.oncoursesystems.com/school/homework/497334?date=09/11/2019")
// fetch("https://app.oncoursesystems.com/school/homework/497334?date=09/09/2019")
//     .then(async res => {
//         let $ = cheerio.load(await res.text())
//         let header = $('body > div.container-fluid > div > div > ul > li > div.content > strong').text()
//         let body = $('body > div.container-fluid > div > div > ul > li > div.content > span').text()
//
//         // console.log($('body > div.container-fluid > div > div > ul > li > div.content').html())
//         // console.log($('body > div.container-fluid > div > div > ul > li > div.content').text())
//         console.log(header)
//         console.log(body)
//     })
//     .catch(console.error)

// main()
main()
new CronJob('0 15 * * *', () => main(), null, true, 'America/New_York')
