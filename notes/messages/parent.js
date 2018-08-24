var children = require('child_process')
var path = require('path')

var child = children.spawn('node', [ path.join(__dirname, 'child.js') ], {
    stdio: [ 'inherit', 'inherit', 'inherit', 'pipe', 'ipc' ]
})

child.on('close', function () { console.log('did close') })

child.stdio[3].on('close', function () { console.log('more close') })
child.stdio[3].on('end', function () { console.log('end') })

setTimeout(function () { child.kill() }, 1000)
setTimeout(function () {
    var other = children.spawn('node', [ path.join(__dirname, 'child.js') ], {
        stdio: [ 'inherit', 'inherit', 'inherit', 'pipe' ]
    })
    console.log('created a child, send in three seconds')
    child.on('error', function (e) {
        console.log(arguments)
        console.log(e.message)
        console.log(e.code)
    })
    console.log(child.connected)
    setTimeout(function () {
        console.log('send to killed child')
        child.send({}, other.stdio[3])
        setTimeout(function () {
            console.log('explicit close')
            other.stdio[3].destroy()
        }, 3000)
    }, 3000)
}, 3000)
