require('proof')(10, prove)

function prove (okay) {
    var Descendent = require('..')
    var events = require('events')

    var expect = [{
        vargs: [ [ 1, 2 ], 2, 1 ],
        message: 'to top'
    }, {
        vargs: [{
            module: 'descendent',
            name: 'hello:world',
            to: 0,
            path: [ 1 ],
            body: 1
        }],
        message: 'up up and out'
    }, {
        vargs: [{
            module: 'descendent',
            to: 0,
            path: [ 1, 2 ],
            body: 1
        }],
        message: 'child up and out'
    }, {
        vargs: [{
            module: 'descendent',
            path: [ 1, 2 ],
            method: 'up',
            cookie: 2,
            body: { a: 1 }
        }],
        message: 'up message'
    }, {
        vargs: [{
            module: 'descendent',
            name: 'hello:world',
            to: [],
            path: [ 1 ],
            body: 1
        }],
        message: 'parent to child'
    }, {
        vargs: [ [ 0, 1 ], 1 ],
        message: 'down received'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'down',
            body: 3
        }],
        message: 'down non-descent message'
    }, {
        vargs: [{
            module: 'descendent',
            name: 'hello:world',
            to: [ 3 ],
            path: [ 1 ],
            body: 1
        }],
        message: 'down method message'
    }, {
        vargs: [{
            module: 'descendent',
            name: 'hello:world',
            to: [ 3 ],
            path: [ 1 ],
            body: 1
        }],
        message: 'down method message'
    }, {
        vargs: [ [ 1 ], 1 ],
        message: 'across'
    }]

    function asExpected (value) {
        var expected = expect.shift()
        okay(Array.prototype.slice.call(arguments), expected.vargs, expected.message)
    }

    // Send messages past the parent that should do nothing.
    var parent = new events.EventEmitter
    parent.pid = 1
    var descendent = new Descendent(parent)
    descendent.up(0, 'hello:world', 1)
    var child = new events.EventEmitter
    child.pid = 2
    descendent.addChild(child, 2)
    child.emit('message', { module: 'descendent', to: 3, path: [] })

    // Send a message that defaults to the parent.
    descendent.on('hello:world', asExpected)
    child.emit('message', { module: 'descendent', name: 'hello:world', to: 0, path: [ 2 ], body: 1 })

    // Send message up out of parent.
    var parent = new events.EventEmitter
    parent.pid = 1
    parent.send = asExpected
    var descendent = new Descendent(parent)
    descendent.up(0, 'hello:world', 1)
    var child = new events.EventEmitter
    child.pid = 2
    descendent.addChild(child, 2)
    child.emit('message', { module: 'descendent', to: 0, path: [ 2 ], body: 1 })

    // Send a message up and out as a non-descendent message.
    descendent.on('up', asExpected)
    child.emit('message', { a: 1 })

    // Send a message down to the child.
    child.send = asExpected
    // This one goes nowhere.
    parent.emit('message', {
        module: 'descendent',
        to: [ 3 ],
        path: [],
        name: 'hello:world',
        body: 1
    })
    // This one goes to the child.
    parent.emit('message', {
        module: 'descendent',
        to: [ 2 ],
        path: [],
        name: 'hello:world',
        body: 1
    })
    // This arrives at the descendent.
    descendent.on('hello:world', asExpected)
    parent.emit('message', {
        module: 'descendent',
        to: [],
        path: [ 0 ],
        name: 'hello:world',
        body: 1
    })
    // Non-descendent message coming down.
    descendent.on('down', asExpected)
    parent.emit('message', 3)

    descendent.down([ 1, 2, 3 ], 'hello:world', 1)
    descendent.down([ 2, 3 ], 'hello:world', 1)
    descendent.across('hello:world', 1)

    descendent.increment()
    descendent.decrement()
    descendent.decrement()
}
