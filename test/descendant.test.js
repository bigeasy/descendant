describe('descendant', () => {
    const assert = require('assert')
    const Descendant = require('../descendant')
    const events = require('events')
    const expect = [{
        vargs: [{
            module: 'descendant',
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
            module: 'descendant',
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
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            from: [ 1, 2 ],
            to: [],
            path: [ 1 ],
            body: 'to sibling'
        }],
        message: 'to sibling'
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            to: [ 9 ],
            path: [ 1 ],
            body: 'up up and out'
        }],
        message: 'up up and out'
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            to: [ 9 ],
            path: [ 1 ],
            body: 'up up and out array'
        }],
        message: 'up up and out array'
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            to: [ 0 ],
            path: [ 1 ],
            body: 'up up and out broadcast'
        }],
        message: 'up up and out broadcast'
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            to: [ 9 ],
            path: [ 1, 2 ],
            body: 'child up and out',
            cookie: 2
        }],
        message: 'child up and out'
    }, {
        vargs: [{
            module: 'descendant',
            from: [ 1, 2 ],
            method: 'up',
            cookie: 2,
            body: { a: 1 }
        }],
        message: 'up message'
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            to: [],
            path: [ 1 ],
            body: 'parent to child'
        }],
        message: 'parent to child'
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            from: [ 9 ],
            to: [ 9, 1 ],
            body: 'down received'
        }],
        message: 'down received'
    }, {
        vargs: [{
            module: 'descendant',
            method: 'down',
            body: 3
        }],
        message: 'down non-descent message'
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            from: [ 1 ],
            to: [ 3 ],
            path: [ 1 ],
            body: 'down include self'
        }],
        message: 'down include self',
        callback: []
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            from: [ 1 ],
            to: [ 3 ],
            path: [ 1 ],
            body: 'down without self'
        }],
        message: 'down without self',
        callback: [ new Error('error') ]
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            from: [],
            to: [ 1 ],
            body: 1
        }],
        message: 'across'
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            name: 'descendant:close',
            to: [ 0 ],
            from: [ 1, 2 ],
            body: { exitCode: 0, signal: null },
            cookie: 2
        }],
        message: 'close handler'
    }, {
        vargs: [{
            module: 'descendant',
            method: 'route',
            name: 'descendant:close',
            to: [ 0 ],
            path: [ 1, 2 ],
            body: { exitCode: 0, signal: null },
            cookie: 2
        }],
        message: 'close'
    }]

    function asExpected (...vargs) {
        const expected = expect.shift()
        let callback = null
        if (typeof vargs[vargs.length - 1] == 'function') {
            callback = vargs.pop()
            vargs.pop()
        }
        assert.deepStrictEqual(vargs, expected.vargs, expected.message)
        if (callback != null) {
            callback.apply(null, expected.callback)
        }
    }

    const parent = new events.EventEmitter
    parent.pid = 1
    parent.env = {}

    it('can send messages to parents, children and siblings', () => {
        const descendant = new Descendant(parent)
        descendant.increment()
        assert.deepStrictEqual(parent.env, { DESCENDANT_PROCESS_PATH: '1' }, 'path set at root env')
        assert.deepStrictEqual(descendant.path, [ 1 ], 'path at root')
        descendant.up(9, 'hello:world', 1)
        const child = new events.EventEmitter
        child.pid = 2
        descendant.addChild(child, 2)
        child.emit('message', { module: 'descendant', method: 'route', to: [ 3 ], path: [] })
        descendant.on('hello:world', asExpected)
        // Send a message that defaults to the parent.
        child.emit('message', {
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            to: [ 1 ],
            path: [ 2 ],
            body: 'to top'
        })
        child.emit('message', {
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            to: [ 0 ],
            path: [ 2 ],
            body: 'everyone on the way up'
        })
        // See if you can send a message to a sibling.
        const sibling = new events.EventEmitter
        sibling.pid = 4
        descendant.addChild(sibling, 4)
        sibling.send = asExpected
        sibling.connected = true
        child.emit('message', {
            module: 'descendant',
            method: 'route',
            name: 'hello:world',
            to: [ 1, 4 ],
            path: [ 2 ],
            body: 'to sibling'
        })
        descendant.decrement()
        assert(descendant.path == null, 'path at root restored')
        assert.deepStrictEqual(descendant.process.env, {}, 'path at root env restored')
    })
    it('can do other stuff', () => {
        // Send message up out of parent.
        const parent = new events.EventEmitter
        parent.pid = 1
        parent.env = { DESCENDANT_PROCESS_PATH: '8' }
        parent.send = asExpected
        parent.connected = true
        const descendant = new Descendant(parent)
        descendant.increment()
        assert.deepStrictEqual(descendant.path, [ 8, 1 ], 'path with parent')
        assert.deepStrictEqual(parent.env, { DESCENDANT_PROCESS_PATH: '8 1' }, 'path with parent env')
        descendant.up(9, 'hello:world', 'up up and out')
        descendant.up([ 9 ], 'hello:world', 'up up and out array')
        descendant.up([ 0 ], 'hello:world', 'up up and out broadcast')
        const child = new events.EventEmitter
        child.pid = 2
        descendant.addChild(child, 2)
        child.emit('message', {
            module: 'descendant',
            method: 'route',
            to: [ 9 ],
            path: [ 2 ],
            body: 'child up and out'
        })

        // Send a message up and out as a non-descendant message.
        descendant.on('up', asExpected)
        child.emit('message', { a: 1 })

        // Send a message down to the child.
        child.send = asExpected
        child.connected = true
        // This one goes nowhere.
        parent.emit('message', {
            module: 'descendant',
            method: 'route',
            to: [ 3 ],
            path: [],
            name: 'hello:world',
            body: 1
        })
        // This one goes to the child.
        parent.emit('message', {
            module: 'descendant',
            method: 'route',
            to: [ 2 ],
            path: [],
            name: 'hello:world',
            body: 'parent to child'
        })
        // This arrives at the descendant.
        descendant.on('hello:world', asExpected)
        parent.emit('message', {
            module: 'descendant',
            method: 'route',
            from: [ 9 ],
            to: [],
            path: [ 9 ],
            name: 'hello:world',
            body: 'down received'
        })
        // Non-descendant message coming down.
        descendant.on('down', asExpected)
        parent.emit('message', 3)

        descendant.down([ 1, 2, 3 ], 'hello:world', 'down include self', {
            destroy: function () { throw new Error }
        })
        const destroyed = []
        descendant.down([ 2, 3 ], 'hello:world', 'down without self', {
            destroy: () => destroyed.push(true)
        })
        assert.deepStrictEqual(destroyed.splice(0), [ true ], 'destroyed')

        descendant.across('hello:world', 1)

        descendant.on('descendant:close', asExpected)

        child.connected = false
        child.emit('close', 0, null)

        parent.connected = false
        descendant.up([ 9 ], 'hello:world', 'up up and out array', {
            destroy: () => destroyed.push(true)
        })
        assert.deepStrictEqual(destroyed.splice(0), [ true ], 'destroyed')

        child.connected = false
        descendant.addChild(child, 3)
        descendant.down([ 2, 3 ], 'hello:world', 'down disconneted', {
            destroy: () => destroyed.push(true)
        })
        assert.deepStrictEqual(destroyed.splice(0), [ true ], 'destroyed')

        descendant.increment()
        descendant.decrement()
        descendant.decrement()
        assert.equal(descendant.path, null, 'path with parent restored')
        assert.deepStrictEqual(descendant.process.env, {
            DESCENDANT_PROCESS_PATH: '8'
        }, 'path with parent env restored')
    })
    it('can mock a descendant', () => {
        const test = []
        const descendant = new Descendant
        descendant.createMockProcess()
        descendant.increment()
        descendant.process.once('descendant:sent', (message) => test.push(message))
        descendant.up([ 1 ], 'up', 1)
        assert.deepStrictEqual(test.splice(0), [{
            method: 'route',
            module: 'descendant',
            path: [ 2 ],
            to: [ 1 ],
            name: 'up',
            body: 1
        }], 'mock parent')
        descendant.addMockChild(3, {})
        descendant.children[3].once('descendant:sent', message => test.push(message))
        descendant.down([ 2, 3 ], 'down', 1)
        assert.deepStrictEqual(test.splice(0), [{
            method: 'route',
            module: 'descendant',
            from: [ 2 ],
            path: [ 2 ],
            to: [],
            name: 'down',
            body: 1
        }], 'mock parent')
        descendant.removeChild(3)
        assert(! descendant.children[3], 'remove child by pid')
        descendant.decrement()
    })
})
