var children = require('child_process')
var path = require('path')

var child = children.spawn('node', [ path.join(__dirname, 'child.js') ], {
    stdio: [ 'inherit', 'inherit', 'inherit', 'pipe', 'ipc' ]
})

child.on('close', function () { console.log('did close') })

child.stdio[3].on('close', function () { console.log('more close') })
child.stdio[3].on('end', function () { console.log('end') })

setTimeout(function () { child.kill() }, 5000)
setTimeout(function () {
    var child = children.spawn('node', [ path.join(__dirname, 'child.js') ], {
        stdio: [ 'inherit', 'inherit', 'inherit', 'pipe' ]
    })
}, 15000)
