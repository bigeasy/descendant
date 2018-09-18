var util = require('util')
var events = require('events')

var coalesce = require('extant')

var assert = require('assert')

// TODO Could use `-1` to mean go up one. `0` means root. Or else `-Infinity`
// means to the root. No, `0` because `-Infinity` is not valid JSON. Overshoot
// and it stops at the root.

function Descendent (process) {
    var descendent = this
    this.process = process
    this.children = {}
    this._listeners = {}
    this._counter = 0
    events.EventEmitter.call(this)
}
util.inherits(Descendent, events.EventEmitter)

Descendent.prototype.createMockProcess = function () {
    var process = new events.EventEmitter
    process.pid = 1
    process.env = { 'DESCENDENT_PROCESS_PATH': '0' }
    process.send = function (message, socket) {
        var vargs = Array.prototype.slice.call(arguments)
        vargs.unshift('descendent:sent')
        process.emit.apply(process, vargs)
    }
    process.connected = true
    this.process = process
}

function down (descendent) {
    return function (message) {
        var vargs = Array.prototype.slice.call(arguments)
        if (
            message.module == 'descendent' &&
            message.method == 'route' &&
            Array.isArray(message.to) &&
            Array.isArray(message.path)
        ) {
            message = JSON.parse(JSON.stringify(message))
            message.path.push(descendent.process.pid)
            if (message.to.length == 0) {
                vargs[0] = {
                    module: 'descendent',
                    method: 'route',
                    name: message.name,
                    from: message.from,
                    to: message.path,
                    body: message.body
                }
                vargs.unshift(message.name)
                descendent.emit.apply(descendent, vargs)
            } else {
                var child = descendent.children[message.to[0]]
                if (child != null) {
                    if (child.connected) {
                        message.to.shift()
                        vargs[0] = message
                        child.send.apply(child, vargs)
                    }
                    if (vargs[1] != null) {
                        vargs[1].destroy()
                    }
                }
            }
        } else {
            // We've made `"down"` a wrapped message to be consistent with
            // `"up"`, even though we don't really add any meaningful
            // information to the envelope.
            vargs[0] = {
                module: 'descendent',
                method: 'down',
                body: message
            }
            vargs.unshift('down')
            descendent.emit.apply(descendent, vargs)
        }
    }
}

Descendent.prototype.decrement = function () {
    if (--this._counter == 0) {
        this.process.removeListener('message', this._listener)
        Object.keys(this.children).forEach(function (pid) {
            this.removeChild(this.children[pid])
        }, this)
        if (this._parentProcessPath == null) {
            delete this.process.env.DESCENDENT_PROCESS_PATH
        } else {
            this.process.env.DESCENDENT_PROCESS_PATH = this._parentProcessPath
        }
        this.path = null
    }
}

Descendent.prototype.increment = function () {
    if (this._counter++ == 0) {
        this._parentProcessPath = coalesce(this.process.env.DESCENDENT_PROCESS_PATH)
        this.path = coalesce(this._parentProcessPath, '0').split(/\s+/).map(function (pid) {
            return +pid
        })
        if (this.path[0] === 0) {
            this.path = []
        }
        this.path.push(this.process.pid)
        this.process.env.DESCENDENT_PROCESS_PATH = this.path.join(' ')
        this.process.on('message', this._listener = down(this))
    }
}

Descendent.prototype._send = function (vargs) {
    if (this.process.connected) {
        this.process.send.apply(this.process, vargs)
    }
    if (vargs[1] != null) {
        vargs[1].destroy()
    }
}

function up (descendent, cookie, pid) {
    return function (message) {
        var vargs = Array.prototype.slice.call(arguments)
        if (
            message.module == 'descendent' &&
            message.method == 'route' &&
            Array.isArray(message.to) &&
            Array.isArray(message.path)
        ) {
            message = JSON.parse(JSON.stringify(message))
            if (message.path.length == 1) {
                message.cookie = coalesce(cookie)
            }
            // Was using zero to mean go to the root, but that doesn't mean
            // anything because we could be running underneath a Node.js
            // supervisor of some sort that enabled `'ipc'`, so is that
            // anonymous process the root? We should always specify a PID
            // for the destination, which can be set in an environment
            // variable. We could visit everyone on the way up, but if we
            // have a handle and a visitor consumes it, but then we
            // propagate it, then the visitor loses the handle. Well, we
            // could assert that if we're going up with `0` that no handle
            // is passed, so we could revisit this.
            message.path.unshift(descendent.process.pid)
            if (
                message.to[0] === descendent.process.pid ||
                message.to[0] === 0
            ) {
                // TODO What sort of path information do you add to a
                // redirect?
                if (message.to.length == 1) {
                    vargs[0] = {
                        module: 'descendent',
                        method: 'route',
                        name: message.name,
                        to: message.to,
                        from: message.path,
                        body: message.body,
                        cookie: message.cookie
                    }
                    vargs.unshift(message.name)
                    descendent.emit.apply(descendent, vargs)
                    vargs.shift()
                } else {
                    vargs[0] = {
                        module: 'descendent',
                        method: 'route',
                        name: message.name,
                        to: message.to.slice(1),
                        from: message.path.slice(),
                        path: message.path.slice(),
                        body: message.body
                    }
                    descendent._listener.apply(null, vargs)
                }
            }
            if (
                message.to[0] !== descendent.process.pid
            ) {
                vargs[0] = message
                descendent._send(vargs)
            }
        } else {
            vargs[0] = {
                module: 'descendent',
                method: 'up',
                from: [ descendent.process.pid, pid ],
                cookie: coalesce(cookie),
                body: message
            }
            vargs.unshift('up')
            descendent.emit.apply(descendent, vargs)
        }
    }
}

function close (descendent, cookie, child) {
    return function (exitCode, signal) {
        assert(!child.connected, 'child is still connected')
        var listeners = descendent._listeners[child.pid]
        descendent.removeChild(child)
        // Pretend that the child announced it's own exit.
        listeners.message.call(null, {
            module: 'descendent',
            method: 'route',
            name: 'descendent:close',
            to: [ 0 ],
            path: [ child.pid ],
            body: { exitCode: exitCode, signal: signal }
        })
    }
}

Descendent.prototype.addMockChild = function (pid, cookie) {
    var child = new events.EventEmitter
    child.pid = pid
    child.connected = true
    child.send = function () {
        var vargs = Array.prototype.slice.call(arguments)
        vargs.unshift('descendent:sent')
        this.emit.apply(this, vargs)
    }
    this.addChild(child, cookie)
    return child
}

Descendent.prototype.addChild = function (child, cookie) {
    this.children[child.pid] = child
    var listeners = this._listeners[child.pid] = {
        message: up(this,  cookie, child.pid),
        close: close(this, cookie, child)
    }
    child.on('message', listeners.message)
    child.on('close', listeners.close)

}

Descendent.prototype.removeChild = function (child) {
    if (Number.isInteger(child)) {
        child = this.children[child]
    }
    var listeners = this._listeners[child.pid]
    delete this.children[child.pid]
    delete this._listeners[child.pid]
    child.removeListener('message', listeners.message)
    child.removeListener('close', listeners.close)
}

Descendent.prototype.up = function (to, name, message) {
    var vargs = Array.prototype.slice.call(arguments, 2)
    if (!Array.isArray(to)) {
        to = [ to ]
    }
    assert(to[0] !== 0 || vargs.length === 1, 'cannot broadcast a handle')
    vargs[0] = {
        module: 'descendent',
        method: 'route',
        name: name,
        to: to,
        path: [ this.process.pid ],
        body: message
    }
    this._send(vargs)
}

// Send a message down to a child. Path is the full path to the child with an
// entry for each process in the path to the child, so that we are able to
// address children of children and their children and so on. The `name` is the
// name of the event emitted on the `Descendent` object in the child.
Descendent.prototype.down = function (path, name, message) {
    var vargs = Array.prototype.slice.call(arguments, 2)
    var envelope = vargs[0] = {
        module: 'descendent',
        method: 'route',
        name: name,
        to: path.slice(),
        from: [ this.process.pid ],
        path: [],
        body: message
    }
    if (envelope.to[0] == this.process.pid) {
        envelope.to.shift()
    }
    this._listener.apply(null, vargs)
}

// Useful for unit testing, sending a message across means sending it directly.
// We can't just use `down` nor `up` because they will remove a reference to
// self as a convenience.
Descendent.prototype.across = function (name, message) {
    var vargs = Array.prototype.slice.call(arguments, 1)
    var envelope = vargs[0] = {
        module: 'descendent',
        method: 'route',
        name: name,
        from: [],
        to: [],
        path: [],
        body: message
    }
    vargs.unshift('message')
    this.process.emit.apply(this.process, vargs)
}

module.exports = Descendent
