require('proof')(29, prove)

function prove (okay) {
    var Descendent = require('../descendent')
    var events = require('events')

    var expect = [{
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            to: [ 1 ],
            body: 'to top',
            from: [ 1, 2 ],
            cookie: 2
        }],
        message: 'to top'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            to: [ 0 ],
            body: 'everyone on the way up',
            from: [ 1, 2 ],
            cookie: 2
        }],
        message: 'everyone on the way up'
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
            to: [ 9 ],
            path: [ 1 ],
            body: 'up up and out'
        }],
        message: 'up up and out'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            to: [ 9 ],
            path: [ 1 ],
            body: 'up up and out array'
        }],
        message: 'up up and out array'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'hello:world',
            to: [ 0 ],
            path: [ 1 ],
            body: 'up up and out broadcast'
        }],
        message: 'up up and out broadcast'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            to: [ 9 ],
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
            from: [ 9 ],
            to: [ 9, 1 ],
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
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'descendent:close',
            to: [ 0 ],
            from: [ 1, 2 ],
            body: { exitCode: 0, signal: null },
            cookie: 2
        }],
        message: 'close handler'
    }, {
        vargs: [{
            module: 'descendent',
            method: 'route',
            name: 'descendent:close',
            to: [ 0 ],
            path: [ 1, 2 ],
            body: { exitCode: 0, signal: null },
            cookie: 2
        }],
        message: 'close'
    }]

    function asExpected (value) {
        var expected = expect.shift()
        okay(Array.prototype.slice.call(arguments), expected.vargs, expected.message)
    }

    // Send messages past the parent that should do nothing.
    var parent = new events.EventEmitter
    parent.pid = 1
    parent.env = {}
    var descendent = new Descendent(parent)
    descendent.increment()
    okay(descendent.path, [ 1 ], 'path at root')
    okay(parent.env, { DESCENDENT_PROCESS_PATH: '1' }, 'path at root env')
    descendent.up(9, 'hello:world', 1)
    var child = new events.EventEmitter
    child.pid = 2
    descendent.addChild(child, 2)
    child.emit('message', { module: 'descendent', method: 'route', to: [ 3 ], path: [] })

    // Send a message that defaults to the parent.
    descendent.on('hello:world', asExpected)
    child.emit('message', { module: 'descendent', method: 'route', name: 'hello:world', to: [ 1 ], path: [ 2 ], body: 'to top' })
    child.emit('message', { module: 'descendent', method: 'route', name: 'hello:world', to: [ 0 ], path: [ 2 ], body: 'everyone on the way up' })

    // See if you can send a message to a sibling.
    var sibling = new events.EventEmitter
    sibling.pid = 4
    descendent.addChild(sibling, 4)
    sibling.send = asExpected
    sibling.connected = true
    child.emit('message', { module: 'descendent', method: 'route', name: 'hello:world', to: [ 1, 4 ], path: [ 2 ], body: 'to sibling' })

    descendent.decrement()
    okay(descendent.path, null, 'path at root restored')
    okay(descendent.process.env, {}, 'path at root env restored')

    // Send message up out of parent.
    var parent = new events.EventEmitter
    parent.pid = 1
    parent.env = { DESCENDENT_PROCESS_PATH: '8' }
    parent.send = asExpected
    parent.connected = true
    var descendent = new Descendent(parent)
    descendent.increment()
    okay(descendent.path, [ 8, 1 ], 'path with parent')
    okay(parent.env, { DESCENDENT_PROCESS_PATH: '8 1' }, 'path with parent env')
    descendent.up(9, 'hello:world', 'up up and out')
    descendent.up([ 9 ], 'hello:world', 'up up and out array')
    descendent.up([ 0 ], 'hello:world', 'up up and out broadcast')
    var child = new events.EventEmitter
    child.pid = 2
    descendent.addChild(child, 2)
    child.emit('message', { module: 'descendent', method: 'route', to: [ 9 ], path: [ 2 ], body: 'child up and out' })

    // Send a message up and out as a non-descendent message.
    descendent.on('up', asExpected)
    child.emit('message', { a: 1 })

    // Send a message down to the child.
    child.send = asExpected
    child.connected = true
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
        from: [ 9 ],
        to: [],
        path: [ 9 ],
        name: 'hello:world',
        body: 'down received'
    })
    // Non-descendent message coming down.
    descendent.on('down', asExpected)
    parent.emit('message', 3)

    descendent.down([ 1, 2, 3 ], 'hello:world', 'down include self')
    descendent.down([ 2, 3 ], 'hello:world', 'down without self')

    descendent.across('hello:world', 1)

    descendent.on('descendent:close', asExpected)

    child.connected = false
    child.emit('close', 0, null)

    parent.connected = false
    descendent.up([ 9 ], 'hello:world', 'up up and out array', {
        destroy: function () {
            okay(true, 'up destroyed')
        }
    })

    child.connected = false
    descendent.addChild(child, 3)
    descendent.down([ 2, 3 ], 'hello:world', 'down disconneted', {
        destroy: function () {
            okay(true, 'down destroyed')
        }
    })

    descendent.increment()
    descendent.decrement()
    descendent.decrement()
    okay(descendent.path, null, 'path with parent restored')
    okay(descendent.process.env, { DESCENDENT_PROCESS_PATH: '8' }, 'path with parnet env restored')

    descendent.createMockProcess()
    descendent.increment()

    descendent.process.once('descendent:sent', function (message) {
        okay({
            name: message.name,
            body: message.body
        }, {
            name: 'up',
            body: 1
        }, 'mock parent')
    })
    descendent.up([ 1 ], 'up', 1)

    descendent.addMockChild(3, {})
    descendent.children[3].once('descendent:sent', function (message) {
        okay({
            name: message.name,
            body: message.body
        }, {
            name: 'down',
            body: 1
        }, 'mock child')
    })
    descendent.down([ 2, 3 ], 'down', 1)
    descendent.removeChild(3)
    okay(! descendent.children[3], 'remove child by pid')

    descendent.decrement()
}
