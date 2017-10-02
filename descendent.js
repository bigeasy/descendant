var cadence = require('extant')
var util = require('util')
var events = require('events')

function Descendent (process) {
    var descendent = this
    this._process = process
    this._children = {}
    this._process.on('message', this._listener = function (message) {
        var vargs = Array.prototype.slice.call(arguments)
        if (
            message.module == 'descendent' &&
            Array.isArray(message.to) &&
            Array.isArray(message.path)
        ) {
            message = JSON.parse(JSON.stringify(message))
            message.path.push(descendent._process.pid)
            if (message.to.length == 0) {
                vargs[0] = message.body
                vargs.unshift(message.name, message.path)
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
            descendent.emit.apply(descendent, [ 'down' ].concat(vargs))
        }
    })
    events.EventEmitter.call(this)
}
util.inherits(Descendent, events.EventEmitter)

Descendent.prototype.destroy = function () {
    this._process.removeListener('message', this._listener)
    Object.keys(this._children).forEach(function (pid) {
        this.removeChild(this._children[pid].child)
    }, this)
}

Descendent.prototype.addChild = function (child, cookie) {
    var descendent = this
    var entry = this._children[child.pid] = {
        child: child,
        listener: function (message) {
            var vargs = Array.prototype.slice.call(arguments)
            if (
                message.module == 'descendent' &&
                typeof message.to == 'number' &&
                Array.isArray(message.path)
            ) {
                message = JSON.parse(JSON.stringify(message))
                message.path.unshift(descendent._process.pid)
                if (
                    message.to == descendent._process.pid ||
                    (message.to == 0 && descendent._process.send == null)
                ) {
                    vargs[0] = message.body
                    vargs.unshift(message.name, message.path, cookie)
                    descendent.emit.apply(descendent, vargs)
                } else if (descendent._process.send) {
                    vargs[0] = message
                    descendent._process.send.apply(descendent._process, vargs)
                }
            } else {
                vargs.unshift('up', cookie)
                descendent.emit.apply(descendent, vargs)
            }
        }
    }
    child.on('message', entry.listener)
}

Descendent.prototype.removeChild = function (child) {
    var entry = this._children[child.pid]
    delete this._children[child.pid]
    entry.child.removeListener('message', entry.listener)
}

Descendent.prototype.up = function (pid, name, message) {
    if (this._process.send) {
        var vargs = Array.prototype.slice.call(arguments, 2)
        vargs[0] = {
            module: 'descendent',
            name: name,
            to: pid,
            path: [ this._process.pid ],
            body: message
        }
        this._process.send.apply(this._process, vargs)
    }
}

Descendent.prototype.down = function (path, name, message) {
    var vargs = Array.prototype.slice.call(arguments, 2)
    var envelope = vargs[0] = {
        module: 'descendent',
        name: name,
        to: path.slice(),
        path: [],
        body: message
    }
    if (envelope.to[0] == this._process.pid) {
        envelope.to.shift()
    }
    this._listener.apply(null, vargs)
}

module.exports = Descendent
