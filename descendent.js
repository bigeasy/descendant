const events = require('events')
const coalesce = require('extant')
const assert = require('assert')

function send (destination, vargs) {
    if (vargs[1] != null) {
        vargs.push(function (error) {
            if (error) {
                vargs[1].destroy()
            }
        })
    }
    if (destination.connected) {
        destination.send.apply(destination, vargs)
    } else if (vargs[1] != null) {
        vargs[1].destroy()
    }
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
                    message.to.shift()
                    vargs[0] = message
                    send(child, vargs)
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
                        path: [],
                        body: message.body
                    }
                    descendent._listener.apply(null, vargs)
                }
            }
            if (
                message.to[0] !== descendent.process.pid
            ) {
                vargs[0] = message
                send(descendent.process, vargs)
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

// TODO Could use `-1` to mean go up one. `0` means root. Or else `-Infinity`
// means to the root. No, `0` because `-Infinity` is not valid JSON. Overshoot
// and it stops at the root.

class Descendent extends events.EventEmitter {
    constructor (process) {
        super()
        var descendent = this
        this.process = process
        this.children = {}
        this._listeners = {}
        this._counter = 0
        events.EventEmitter.call(this)
    }

    createMockProcess () {
        var process = new events.EventEmitter
        process.pid = 2
        process.env = { 'DESCENDENT_PROCESS_PATH': '1' }
        process.send = function (message, socket) {
            var vargs = Array.prototype.slice.call(arguments)
            vargs.unshift('descendent:sent')
            process.emit.apply(process, vargs)
        }
        process.connected = true
        this.process = process
    }


    decrement () {
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

    increment () {
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

    addMockChild (pid, cookie) {
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

    addChild (child, cookie) {
        this.children[child.pid] = child
        var listeners = this._listeners[child.pid] = {
            message: up(this,  cookie, child.pid),
            close: close(this, cookie, child)
        }
        child.on('message', listeners.message)
        child.on('close', listeners.close)

    }

    removeChild (child) {
        if (Number.isInteger(child)) {
            child = this.children[child]
        }
        var listeners = this._listeners[child.pid]
        delete this.children[child.pid]
        delete this._listeners[child.pid]
        child.removeListener('message', listeners.message)
        child.removeListener('close', listeners.close)
    }

    up (to, name, message) {
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
        send(this.process, vargs)
    }

    // Send a message down to a child. Path is the full path to the child with an
    // entry for each process in the path to the child, so that we are able to
    // address children of children and their children and so on. The `name` is the
    // name of the event emitted on the `Descendent` object in the child.
    down (path, name, message) {
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
    across (name, message) {
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
}

module.exports = Descendent
