require('proof')(11, prove)

function prove (okay) {
    var Descendent = require('..')
    var events = require('events')

    var expect = [{
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            to: [ 1 ],
            body: 'to top',
            path: [ 1, 2 ],
            cookie: 2
        }],
        message: 'to top'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            from: [ 1, 2 ],
            to: [],
            path: [ 1, 2, 1 ],
            body: 'to sibling'
        }],
        message: 'to sibling'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            to: [ 0 ],
            path: [ 1 ],
            body: 'up up and out'
        }],
        message: 'up up and out'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            to: [ 0 ],
            path: [ 1, 2 ],
            body: 'child up and out',
            cookie: 2
        }],
        message: 'child up and out'
    }, {
        vargs: [{
            module: 'descendent',
            from: [ 1, 2 ],
            method: 'up',
            cookie: 2,
            body: { a: 1 }
        }],
        message: 'up message'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            to: [],
            path: [ 1 ],
            body: 'parent to child'
        }],
        message: 'parent to child'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            from: [ 0 ],
            to: [ 0, 1 ],
            body: 'down received'
        }],
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
            method: 'route',
            name: 'hello:world',
            from: [ 1 ],
            to: [ 3 ],
            path: [ 1 ],
            body: 'down include self'
        }],
        message: 'down include self'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            from: [ 1 ],
            to: [ 3 ],
            path: [ 1 ],
            body: 'down without self'
        }],
        message: 'down without self'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            from: [],
            to: [ 1 ],
            body: 1
        }],
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
    child.emit('message', { module: 'descendent', method: 'route', to: [ 3 ], path: [] })

    // Send a message that defaults to the parent.
    descendent.on('hello:world', asExpected)
    child.emit('message', { module: 'descendent', method: 'route', name: 'hello:world', to: [ 1 ], path: [ 2 ], body: 'to top' })

    // See if you can send a message to a sibling.
    var sibling = new events.EventEmitter
    sibling.pid = 4
    descendent.addChild(sibling, 4)
    sibling.send = asExpected
    child.emit('message', { module: 'descendent', method: 'route', name: 'hello:world', to: [ 1, 4 ], path: [ 2 ], body: 'to sibling' })

    // Send message up out of parent.
    var parent = new events.EventEmitter
    parent.pid = 1
    parent.send = asExpected
    var descendent = new Descendent(parent)
    descendent.up(0, 'hello:world', 'up up and out')
    var child = new events.EventEmitter
    child.pid = 2
    descendent.addChild(child, 2)
    child.emit('message', { module: 'descendent', method: 'route', to: [ 0 ], path: [ 2 ], body: 'child up and out' })

    // Send a message up and out as a non-descendent message.
    descendent.on('up', asExpected)
    child.emit('message', { a: 1 })

    // Send a message down to the child.
    child.send = asExpected
    // This one goes nowhere.
    parent.emit('message', {
        module: 'descendent',
        method: 'route',
        to: [ 3 ],
        path: [],
        name: 'hello:world',
        body: 1
    })
    // This one goes to the child.
    parent.emit('message', {
        module: 'descendent',
        method: 'route',
        to: [ 2 ],
        path: [],
        name: 'hello:world',
        body: 'parent to child'
    })
    // This arrives at the descendent.
    descendent.on('hello:world', asExpected)
    parent.emit('message', {
        module: 'descendent',
        method: 'route',
        from: [ 0 ],
        to: [],
        path: [ 0 ],
        name: 'hello:world',
        body: 'down received'
    })
    // Non-descendent message coming down.
    descendent.on('down', asExpected)
    parent.emit('message', 3)

    descendent.down([ 1, 2, 3 ], 'hello:world', 'down include self')
    descendent.down([ 2, 3 ], 'hello:world', 'down without self')

    descendent.across('hello:world', 1)

    descendent.increment()
    descendent.decrement()
    descendent.decrement()
}
