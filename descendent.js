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
    this._children = {}
    this._counter = 0
    events.EventEmitter.call(this)
}
util.inherits(Descendent, events.EventEmitter)

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
                var entry = descendent._children[message.to[0]]
                if (entry != null) {
                    message.to.shift()
                    vargs[0] = message
                    entry.child.send.apply(entry.child, vargs)
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
        Object.keys(this._children).forEach(function (pid) {
            this.removeChild(this._children[pid].child)
        }, this)
    }
}

Descendent.prototype.increment = function () {
    if (this._counter++ == 0) {
        this.process.on('message', this._listener = down(this))
    }
}

Descendent.prototype._send = function (vargs) {
    if (this.process.send) {
        this.process.send.apply(this.process, vargs)
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
        var entry = descendent._children[child.pid]
        descendent.removeChild(child)
        // Pretend that the child announced it's own exit.
        entry.message.call(null, {
            module: 'descendent',
            method: 'route',
            name: 'descendent:close',
            to: [ 0 ],
            path: [ child.pid ],
            body: { exitCode: exitCode, signal: signal }
        })
    }
}

Descendent.prototype.addChild = function (child, cookie) {
    var descendent = this
    var entry = this._children[child.pid] = {
        child: child,
        message: up(this,  cookie, child.pid),
        close: close(this, cookie, child)
    }
    child.on('message', entry.message)
    child.on('close', entry.close)

}

Descendent.prototype.removeChild = function (child) {
    var entry = this._children[child.pid]
    delete this._children[child.pid]
    entry.child.removeListener('message', entry.message)
    entry.child.removeListener('close', entry.close)
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
