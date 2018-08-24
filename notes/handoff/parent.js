var children = require('child_process')
var path = require('path')

var child = children.spawn('node', [ path.join(__dirname, 'child.js') ], {
    stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ]
})

console.log(child.pid)

child.on('close', function () { console.log('did close') })

setTimeout(function () {
    var other = children.spawn('node', [ path.join(__dirname, 'other.js') ], {
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
        console.log('send to child')
        other.stdio[3].on('close', function () { console.log('yes close') })
        other.stdio[3].on('error', function (e) { console.log(e.stack) })
        console.log(Object.keys(other.stdio[3]), other.stdio[3].readable)
        other.stdio[3].write('x')
        console.log('explicit close', other.stdio[3].readable)
        child.send({}, other.stdio[3])
        console.log('explicit close', other.stdio[3].readable)
        other.stdio[3].destroy()
    }, 3000)
}, 7000)
